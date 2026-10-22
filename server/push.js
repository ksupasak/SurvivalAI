const { Expo } = require('expo-server-sdk');

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

/**
 * Fan a notification out to every subscriber.
 *
 * Expo returns a per-message ticket. A `DeviceNotRegistered` ticket means the
 * app was uninstalled or the token was rotated — those rows are dropped so the
 * subscription table does not accumulate dead tokens forever.
 */
async function sendPushToAll(db, title, body, data = {}) {
  const subs = db.prepare('SELECT token FROM subscriptions').all();

  const validTokens = subs.map((s) => s.token).filter((token) => Expo.isExpoPushToken(token));
  if (validTokens.length === 0) return;

  // Tokens that failed validation outright are never going to work.
  const invalidTokens = subs.map((s) => s.token).filter((token) => !Expo.isExpoPushToken(token));

  const messages = validTokens.map((token) => ({
    to: token,
    sound: 'default',
    title,
    body,
    data,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let cursor = 0;

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        const token = validTokens[cursor + i];
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(token);
        } else if (ticket.status === 'error') {
          console.warn('[Push] Ticket error for token:', ticket.message);
        }
      });
    } catch (err) {
      console.error('[Push] Error sending chunk:', err);
    }
    cursor += chunk.length;
  }

  if (invalidTokens.length > 0) {
    const stmt = db.prepare('DELETE FROM subscriptions WHERE token = ?');
    const prune = db.transaction((tokens) => tokens.forEach((t) => stmt.run(t)));
    prune(invalidTokens);
    console.log(`[Push] Pruned ${invalidTokens.length} dead subscription token(s)`);
  }
}

module.exports = { sendPushToAll };
