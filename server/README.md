# SurvivalAI Board Server

REST + WebSocket API backing the in-app community message board.

Node + Express + SQLite (`better-sqlite3`), with Expo push fan-out to
subscribers. Single process, single file database — it is meant to be cheap to
run and easy to relocate, not to scale horizontally.

## Running it

```bash
npm install
cp .env.example .env   # then fill in ADMIN_TOKEN at minimum
npm start
```

`npm run dev` runs the same thing under nodemon.

The database is created on first boot at `server/data/board.db` (gitignored,
along with its WAL sidecars).

## Configuration

Everything is environment driven — see `.env.example` for the full list.
The ones that matter before you expose this publicly:

| Variable | Why it matters |
|---|---|
| `API_KEY` | When set, callers must send it as `X-API-Key` (or `Authorization: Bearer`). Leave empty to keep the API open. |
| `API_KEY_ALLOW_PUBLIC_READ` | `true` keeps GETs open while still requiring the key for writes. |
| `ADMIN_TOKEN` | Without it there is no way to remove an abusive post, or to un-hide one that was auto-hidden unfairly. Generate with `openssl rand -hex 32`. |
| `AUTO_HIDE_REPORTS` | Distinct devices that must report a message before it is hidden. Defaults to 3. |
| `TRUST_PROXY` | Set to `1` behind Fly/Render/nginx/Cloudflare. Rate limiting is per-IP and sees only the proxy's address otherwise, so one abuser throttles everyone. |
| `ALLOWED_ORIGINS` | Only needed if you host the Expo web build. The native app sends no `Origin`. |
| `EXPO_ACCESS_TOKEN` | Only if your Expo project has Enhanced Security for Push Notifications enabled. |

## Authorization model

The board is deliberately unauthenticated — anyone running the app can post,
because requiring sign-up during an emergency defeats the point.

Deletion is gated by a per-install secret:

- The app generates a random `author_token` on first launch and stores it
  locally. It is sent as the `X-Author-Token` header.
- The server records it against each message and **never returns it**. Reads
  instead carry a computed `is_own` boolean, so a client can show its own
  delete affordance without ever learning anyone else's credential.
- `DELETE` succeeds only when the presented token matches the stored one, or
  equals `ADMIN_TOKEN`.

Messages stored without a token (rows predating this scheme) are deletable by
the admin token only.

> Returning `author_token` in read responses — as an earlier revision did —
> lets any reader harvest every credential and delete the whole board. If you
> add an endpoint that selects from `messages`, route it through `toPublic()`
> in `routes/messages.js`.

## Moderation

The board carries user-generated content, which both app stores require to be
reportable and blockable.

- `POST /api/messages/:id/report` records one report per device, keyed on
  `(message_id, reporter_token)` so a single device cannot stack reports.
- Once `AUTO_HIDE_REPORTS` distinct devices have reported a message it is
  hidden: dropped from listings, `404` on direct fetch, and a `delete_message`
  event is broadcast so open clients remove it immediately.
- Hiding is reversible. Nothing is deleted, so a false positive can be undone:

  ```sql
  UPDATE messages SET hidden = 0, report_count = 0 WHERE id = '<id>';
  DELETE FROM reports WHERE message_id = '<id>';
  ```

- Blocking is client-side. The board has no accounts, so the app hides posts by
  display name on that device only. It is a "stop showing me this" control, not
  an access control — do not describe it as one.

Review the queue with:

```sql
SELECT m.id, m.report_count, m.title, m.author
FROM messages m WHERE m.hidden = 1 ORDER BY m.report_count DESC;
```

## API key

The board has no accounts, so by default anyone who can reach the server can
read and post. Setting `API_KEY` puts a shared secret in front of it:

```bash
API_KEY=$(openssl rand -hex 32) npm start
```

- Callers send `X-API-Key: <key>`, or `Authorization: Bearer <key>`.
- `/api/health` is always reachable, so uptime checks need no secret.
- `API_KEY_ALLOW_PUBLIC_READ=true` leaves GETs open and gates only writes.
- Comparison is constant-time, so a wrong key cannot be recovered by timing.
- Unset `API_KEY` and everything behaves exactly as before.

The app reads its key from `app.json` → `expo.extra.boardApiKey`, or from a
value saved on the device, and attaches it to every request.

> This is a spam barrier, not authentication. A key shipped inside a mobile app
> can be extracted from the binary by anyone who cares to. It raises the cost of
> drive-by abuse; it does not make the board private. Per-message ownership is
> still enforced by the author token, and moderation by `ADMIN_TOKEN`.

## Rate limits

Posting fans a push notification out to every subscriber, which makes an
unthrottled `POST` a spam amplifier. Defaults:

| Endpoint | Limit |
|---|---|
| `POST /api/messages` | 10 per 10 min per IP |
| `DELETE /api/messages/:id` | 30 per 10 min per IP |
| `POST /api/subscriptions` | 20 per hour per IP |
| `POST /api/messages/:id/report` | 20 per 10 min per IP |
| all reads | 300 per min per IP |

Raise them via env vars when many devices share one egress IP — a relief camp
behind a single NAT will otherwise hit the POST cap collectively.

## API

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/messages` | `?category=`, `?limit=` (max 100), `?offset=` |
| `GET` | `/api/messages/:id` | |
| `POST` | `/api/messages` | `title` (≤200), `content` (≤2000) required |
| `POST` | `/api/messages/:id/report` | Flags a message; idempotent per device |
| `DELETE` | `/api/messages/:id` | Requires the owning token or `ADMIN_TOKEN` |
| `GET` | `/api/subscriptions/count` | |
| `POST` | `/api/subscriptions` | Expo push token, validated |
| `DELETE` | `/api/subscriptions/:token` | |
| `GET` | `/api/health` | Never requires the API key |
| `GET` | `/api/stats` | Totals by category |

Unknown `category` values are rejected on read and coerced to `general` on
write. Out-of-range or non-numeric coordinates are dropped rather than stored.

A WebSocket on the same port pushes `new_message` and `delete_message` events.
Dead clients — phones that lost signal without closing — are reaped by a 30s
ping/pong heartbeat.

## Deploying

Any host that runs a Node process with a persistent disk works. The database is
a file, so the disk must survive restarts; a platform with ephemeral storage
will silently lose every post on redeploy.

Serve it over HTTPS. The Android client blocks cleartext to anything other than
loopback, the emulator host and `.local` names (see
`plugins/withLocalNetworkSecurity.js`), so a plain-`http` public server will not
be reachable from a release build.

Point the app at it by setting `expo.extra.boardServerUrl` in `app.json`, or per
device in the board screen's settings sheet.
