const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { sendPushToAll } = require('../push');
const { postLimiter, deleteLimiter, reportLimiter } = require('../middleware/rate-limit');

const CATEGORIES = ['general', 'emergency', 'supplies', 'weather', 'rescue', 'intel'];

const MAX_TITLE = 200;
const MAX_CONTENT = 2000;
const MAX_AUTHOR = 60;
const MAX_LOCATION = 120;
const MAX_LIMIT = 100;
const MAX_REASON = 300;

/**
 * Reports needed before a message is hidden pending review. The board is
 * unauthenticated, so this is a blunt instrument — but leaving abusive content
 * up until a human wakes is worse, and an admin can unhide.
 */
const AUTO_HIDE_REPORTS = parseInt(process.env.AUTO_HIDE_REPORTS, 10) || 3;

/**
 * Strip `author_token` (a delete credential) before a message leaves the server,
 * and replace it with an `is_own` flag computed against the caller's own token.
 * Returning the raw token would let any reader delete any message.
 */
function toPublic(row, callerToken) {
  const { author_token, hidden, report_count, ...rest } = row;
  return {
    ...rest,
    is_own: Boolean(author_token && callerToken && author_token === callerToken),
  };
}

function callerTokenOf(req) {
  const header = req.get('X-Author-Token');
  return typeof header === 'string' && header.trim() ? header.trim() : null;
}

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function optionalString(value, maxLen) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function optionalCoord(value, bound) {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n) || Math.abs(n) > bound) return null;
  return n;
}

module.exports = (db, broadcast) => {
  const router = express.Router();

  // GET / - list messages
  router.get('/', (req, res) => {
    try {
      const callerToken = callerTokenOf(req);
      const rawCategory = req.query.category;
      const category = CATEGORIES.includes(rawCategory) ? rawCategory : null;
      const limit = clampInt(req.query.limit, 50, 1, MAX_LIMIT);
      const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);

      if (rawCategory && !category) {
        return res.status(400).json({ error: 'Unknown category' });
      }

      let total;
      let rows;

      if (category) {
        total = db
          .prepare('SELECT COUNT(*) as c FROM messages WHERE category = ? AND hidden = 0')
          .get(category).c;
        rows = db
          .prepare(
            'SELECT * FROM messages WHERE category = ? AND hidden = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?'
          )
          .all(category, limit, offset);
      } else {
        total = db.prepare('SELECT COUNT(*) as c FROM messages WHERE hidden = 0').get().c;
        rows = db
          .prepare('SELECT * FROM messages WHERE hidden = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?')
          .all(limit, offset);
      }

      const messages = rows.map((row) => toPublic(row, callerToken));
      res.json({ messages, total, hasMore: offset + messages.length < total });
    } catch (err) {
      console.error('[Messages] GET / error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /:id - get single message
  router.get('/:id', (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM messages WHERE id = ? AND hidden = 0').get(req.params.id);
      if (!row) {
        return res.status(404).json({ error: 'Message not found' });
      }
      res.json({ message: toPublic(row, callerTokenOf(req)) });
    } catch (err) {
      console.error('[Messages] GET /:id error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST / - create message
  router.post('/', postLimiter, async (req, res) => {
    try {
      const body = req.body || {};

      const title = optionalString(body.title, MAX_TITLE + 1);
      const content = optionalString(body.content, MAX_CONTENT + 1);

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      if (title.length > MAX_TITLE) {
        return res.status(400).json({ error: `Title must be ${MAX_TITLE} characters or less` });
      }
      if (content.length > MAX_CONTENT) {
        return res.status(400).json({ error: `Content must be ${MAX_CONTENT} characters or less` });
      }

      const category = CATEGORIES.includes(body.category) ? body.category : 'general';
      const author = optionalString(body.author, MAX_AUTHOR) || 'Anonymous';
      const location = optionalString(body.location, MAX_LOCATION);
      const platform = optionalString(body.platform, 32);
      const authorToken = optionalString(body.author_token, 128) || callerTokenOf(req);
      const latitude = optionalCoord(body.latitude, 90);
      const longitude = optionalCoord(body.longitude, 180);

      const id = uuidv4();
      const created_at = Date.now();

      db.prepare(
        `INSERT INTO messages (id, title, content, author, author_token, category, location, latitude, longitude, platform, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        title,
        content,
        author,
        authorToken,
        category,
        location,
        latitude,
        longitude,
        platform,
        created_at
      );

      const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
      const publicMessage = toPublic(row, null);

      // Push notify all subscribers (never blocks the response)
      sendPushToAll(
        db,
        `New message: ${row.title}`,
        `${row.author}: ${row.content.substring(0, 100)}${row.content.length > 100 ? '...' : ''}`,
        { messageId: id, category: row.category }
      ).catch((err) => console.error('[Messages] Push error:', err));

      broadcast('new_message', publicMessage);

      res.status(201).json({ message: toPublic(row, authorToken) });
    } catch (err) {
      console.error('[Messages] POST / error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /:id/report - flag a message for moderation
  router.post('/:id/report', reportLimiter, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
      if (!row) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const reporter = callerTokenOf(req) || optionalString((req.body || {}).author_token, 128);
      if (!reporter) {
        return res.status(400).json({ error: 'Reporter token is required' });
      }

      const reason = optionalString((req.body || {}).reason, MAX_REASON);
      const now = Date.now();

      // The PK on (message_id, reporter_token) makes this idempotent, so one
      // device cannot stack reports to force a hide on its own.
      const result = db
        .prepare(
          `INSERT INTO reports (message_id, reporter_token, reason, created_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(message_id, reporter_token) DO NOTHING`
        )
        .run(req.params.id, reporter, reason, now);

      if (result.changes === 0) {
        return res.json({ reported: true, alreadyReported: true });
      }

      const count = db
        .prepare('SELECT COUNT(*) as c FROM reports WHERE message_id = ?')
        .get(req.params.id).c;

      db.prepare('UPDATE messages SET report_count = ? WHERE id = ?').run(count, req.params.id);

      let hidden = Boolean(row.hidden);
      if (!hidden && count >= AUTO_HIDE_REPORTS) {
        db.prepare('UPDATE messages SET hidden = 1 WHERE id = ?').run(req.params.id);
        hidden = true;
        broadcast('delete_message', { id: req.params.id });
        console.warn(`[Messages] Auto-hid ${req.params.id} after ${count} reports`);
      }

      res.json({ reported: true, hidden });
    } catch (err) {
      console.error('[Messages] POST /:id/report error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /:id - delete own message (or any message, with the admin token)
  router.delete('/:id', deleteLimiter, (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
      if (!row) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const supplied = optionalString((req.body || {}).author_token, 128) || callerTokenOf(req);
      const adminToken = process.env.ADMIN_TOKEN;
      const isAdmin = Boolean(adminToken && supplied && supplied === adminToken);

      // A message is only deletable by the token that created it. Messages stored
      // without a token (legacy rows) are not deletable except by an admin.
      const isAuthor = Boolean(row.author_token && supplied && row.author_token === supplied);

      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ error: 'Not authorized to delete this message' });
      }

      db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
      broadcast('delete_message', { id: req.params.id });

      res.json({ success: true });
    } catch (err) {
      console.error('[Messages] DELETE /:id error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
