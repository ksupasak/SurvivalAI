const express = require('express');
const { Expo } = require('expo-server-sdk');
const { subscribeLimiter } = require('../middleware/rate-limit');

const MAX_DEVICE_NAME = 60;

function optionalString(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : null;
}

module.exports = (db) => {
  const router = express.Router();

  // GET /count - returns count of active subscriptions
  router.get('/count', (req, res) => {
    try {
      const result = db.prepare('SELECT COUNT(*) as count FROM subscriptions').get();
      res.json({ count: result.count });
    } catch (err) {
      console.error('[Subscriptions] GET /count error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST / - subscribe
  router.post('/', subscribeLimiter, (req, res) => {
    try {
      const { token, device_name, platform } = req.body || {};

      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        return res.status(400).json({ error: 'Push token is required' });
      }

      if (!Expo.isExpoPushToken(token.trim())) {
        return res.status(400).json({ error: 'Invalid Expo push token' });
      }

      const now = Date.now();

      db.prepare(
        `INSERT INTO subscriptions (token, device_name, platform, created_at, last_active)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET
           device_name = excluded.device_name,
           platform = excluded.platform,
           last_active = excluded.last_active`
      ).run(
        token.trim(),
        optionalString(device_name, MAX_DEVICE_NAME),
        optionalString(platform, 32),
        now,
        now
      );

      res.json({ subscribed: true });
    } catch (err) {
      console.error('[Subscriptions] POST / error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /:token - unsubscribe
  router.delete('/:token', (req, res) => {
    try {
      db.prepare('DELETE FROM subscriptions WHERE token = ?').run(req.params.token);
      res.json({ unsubscribed: true });
    } catch (err) {
      console.error('[Subscriptions] DELETE /:token error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
