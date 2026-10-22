const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { WebSocketServer } = require('ws');
const { getDb } = require('./database');
const { readLimiter } = require('./middleware/rate-limit');
const { requireApiKey } = require('./middleware/api-key');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Behind a reverse proxy (Fly, Render, nginx, Cloudflare) the client IP arrives
// in X-Forwarded-For. Rate limiting is per-IP, so this has to be right or every
// request looks like it comes from the proxy. Set TRUST_PROXY=1 when deployed.
const trustProxy = process.env.TRUST_PROXY;
app.set('trust proxy', trustProxy ? (isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy)) : false);

app.use(helmet());

// The app is a native client and sends no Origin header, so a wildcard costs
// nothing there. Set ALLOWED_ORIGINS to lock down the web build if you host one.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length
      ? {
          origin: (origin, cb) =>
            !origin || allowedOrigins.includes(origin)
              ? cb(null, true)
              : cb(new Error('Origin not allowed')),
        }
      : {}
  )
);

app.use(express.json({ limit: '64kb' }));
app.use(readLimiter);
app.use(requireApiKey);

const db = getDb();

// Broadcast helper
function broadcast(eventType, data) {
  const payload = JSON.stringify({ type: eventType, data, timestamp: Date.now() });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

// Routes
app.use('/api/messages', require('./routes/messages')(db, broadcast));
app.use('/api/subscriptions', require('./routes/subscriptions')(db));

// Health
app.get('/api/health', (req, res) => {
  try {
    const msgCount = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
    const subCount = db.prepare('SELECT COUNT(*) as c FROM subscriptions').get().c;
    res.json({ status: 'ok', messages: msgCount, subscribers: subCount, uptime: process.uptime() });
  } catch (err) {
    console.error('[Health] error:', err);
    res.status(500).json({ status: 'error' });
  }
});

// Stats
app.get('/api/stats', (req, res) => {
  try {
    const categories = db
      .prepare('SELECT category, COUNT(*) as count FROM messages GROUP BY category ORDER BY count DESC')
      .all();
    const total = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
    const subscribers = db.prepare('SELECT COUNT(*) as c FROM subscriptions').get().c;
    res.json({ total, subscribers, categories });
  } catch (err) {
    console.error('[Stats] error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((err, req, res, next) => {
  if (err && err.message === 'Origin not allowed') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// WebSocket — clients that vanish without a close frame (phones losing signal,
// which is the normal case here) are reaped by this heartbeat.
const HEARTBEAT_MS = 30000;

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.on('error', () => {});
  console.log('[WS] Client connected, total:', wss.clients.size);
  ws.on('close', () => console.log('[WS] Client disconnected, total:', wss.clients.size));
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_MS);

wss.on('close', () => clearInterval(heartbeat));

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`SurvivalAI Board API listening on http://${HOST}:${PORT}`);
  console.log(`WebSocket ready on ws://${HOST}:${PORT}`);
  if (!process.env.ADMIN_TOKEN) {
    console.warn('[Server] ADMIN_TOKEN is not set — no moderator deletes available.');
  }
  if (process.env.API_KEY) {
    const scope =
      String(process.env.API_KEY_ALLOW_PUBLIC_READ || '').toLowerCase() === 'true'
        ? 'writes only (reads are public)'
        : 'all endpoints';
    console.log(`[Server] API key required for ${scope}.`);
  } else {
    console.warn('[Server] API_KEY is not set — the API is open to anyone who can reach it.');
  }
});

function shutdown(signal) {
  console.log(`\n[Server] ${signal} received, shutting down...`);
  clearInterval(heartbeat);
  wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
  server.close(() => {
    try {
      db.close();
    } catch {
      /* already closed */
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
