const crypto = require('crypto');

/**
 * Optional API-key gate for the board API.
 *
 * Set `API_KEY` to require callers to present it as an `X-API-Key` header (an
 * `Authorization: Bearer <key>` is accepted too, for tools that only speak
 * bearer auth). Leave it unset and the API stays open, which keeps local
 * development and existing deployments working unchanged.
 *
 * `/api/health` is always reachable so uptime checks and load balancers do not
 * need the secret.
 *
 * Set `API_KEY_ALLOW_PUBLIC_READ=true` to keep GET requests open while still
 * requiring the key for anything that writes — useful when the board should be
 * readable by all but only writable by your own app builds.
 *
 * This is a shared secret shipped inside a mobile app, so treat it as a spam
 * barrier, not as real authentication: anyone who unpacks the binary can read
 * it. Per-message ownership is still enforced by the author token, and
 * moderation by ADMIN_TOKEN.
 */

const OPEN_PATHS = new Set(['/api/health']);

/** Constant-time compare so a wrong key cannot be found by timing the response. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function presentedKey(req) {
  const header = req.get('X-API-Key');
  if (typeof header === 'string' && header.trim()) return header.trim();

  const auth = req.get('Authorization');
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return null;
}

function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;

  // No key configured: the API is open, as before.
  if (!expected) return next();

  if (OPEN_PATHS.has(req.path)) return next();

  const allowPublicRead =
    String(process.env.API_KEY_ALLOW_PUBLIC_READ || '').toLowerCase() === 'true';
  if (allowPublicRead && (req.method === 'GET' || req.method === 'HEAD')) {
    return next();
  }

  const supplied = presentedKey(req);
  if (!supplied || !safeEqual(supplied, expected)) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  return next();
}

module.exports = { requireApiKey };
