const rateLimit = require('express-rate-limit');

/**
 * Rate limits for the write endpoints.
 *
 * The board is unauthenticated by design — anyone running the app can post.
 * Posting fans a push notification out to every subscriber, so an unthrottled
 * POST is a spam amplifier. These caps keep a single source from flooding it.
 *
 * Tune with env vars when deploying behind a shared NAT (e.g. a relief camp
 * where many devices share one egress IP).
 */

const num = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const common = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
};

const postLimiter = rateLimit({
  ...common,
  windowMs: num(process.env.POST_RATE_WINDOW_MS, 10 * 60 * 1000),
  limit: num(process.env.POST_RATE_MAX, 10),
});

const deleteLimiter = rateLimit({
  ...common,
  windowMs: num(process.env.DELETE_RATE_WINDOW_MS, 10 * 60 * 1000),
  limit: num(process.env.DELETE_RATE_MAX, 30),
});

const subscribeLimiter = rateLimit({
  ...common,
  windowMs: num(process.env.SUBSCRIBE_RATE_WINDOW_MS, 60 * 60 * 1000),
  limit: num(process.env.SUBSCRIBE_RATE_MAX, 20),
});

const reportLimiter = rateLimit({
  ...common,
  windowMs: num(process.env.REPORT_RATE_WINDOW_MS, 10 * 60 * 1000),
  limit: num(process.env.REPORT_RATE_MAX, 20),
});

const readLimiter = rateLimit({
  ...common,
  windowMs: num(process.env.READ_RATE_WINDOW_MS, 60 * 1000),
  limit: num(process.env.READ_RATE_MAX, 300),
});

module.exports = { postLimiter, deleteLimiter, subscribeLimiter, reportLimiter, readLimiter };
