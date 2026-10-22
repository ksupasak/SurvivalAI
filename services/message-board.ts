/**
 * Message Board Service
 * REST API client for the SurvivalAI community message board.
 */
import Constants from 'expo-constants';
import { getSetting, setSetting } from './settings';

export type MessageCategory = 'general' | 'emergency' | 'supplies' | 'weather' | 'rescue' | 'intel';

export interface BoardMessage {
  id: string;
  title: string;
  content: string;
  author: string;
  /**
   * Computed by the server against the caller's X-Author-Token header.
   * The raw token is never returned — it is the credential that authorises
   * deleting a message.
   */
  is_own?: boolean;
  category: MessageCategory;
  location?: string;
  latitude?: number;
  longitude?: number;
  platform?: string;
  created_at: number;
}

export interface MessagesResponse {
  messages: BoardMessage[];
  total: number;
  hasMore: boolean;
}

export interface PostMessageInput {
  title: string;
  content: string;
  author?: string;
  category?: MessageCategory;
  location?: string;
  latitude?: number;
  longitude?: number;
  platform?: string;
}

const REQUEST_TIMEOUT_MS = 8000;

/** Configured at build time via app.json → expo.extra.boardServerUrl. */
const CONFIGURED_BOARD_URL: string =
  (Constants.expoConfig?.extra as { boardServerUrl?: string } | undefined)?.boardServerUrl ?? '';

/** Optional build-time key, for a board server that sets API_KEY. */
const CONFIGURED_BOARD_API_KEY: string =
  (Constants.expoConfig?.extra as { boardApiKey?: string } | undefined)?.boardApiKey ?? '';

// ─── Server URL ───────────────────────────────────────────────────────────────

export async function getBoardUrl(): Promise<string> {
  const saved = await getSetting('board_server_url');
  return (saved || CONFIGURED_BOARD_URL).replace(/\/+$/, '');
}

export async function setBoardUrl(url: string): Promise<void> {
  await setSetting('board_server_url', url.trim().replace(/\/+$/, ''));
}

/** False when neither the build nor the user has supplied a board server. */
export async function isBoardConfigured(): Promise<boolean> {
  return (await getBoardUrl()).length > 0;
}

export function getDefaultBoardUrl(): string {
  return CONFIGURED_BOARD_URL;
}

// ─── API key ──────────────────────────────────────────────────────────────────

/**
 * Shared secret for a board server started with API_KEY set. Falls back to the
 * build-time value so a shipped app can talk to its own server without the user
 * entering anything.
 *
 * This is a spam barrier, not authentication — it ships inside the app binary.
 */
export async function getBoardApiKey(): Promise<string> {
  const saved = await getSetting('board_api_key');
  return (saved || CONFIGURED_BOARD_API_KEY).trim();
}

export async function setBoardApiKey(key: string): Promise<void> {
  await setSetting('board_api_key', key.trim());
}

// ─── Author token ─────────────────────────────────────────────────────────────

/**
 * A random per-install secret. The server stores it alongside each message and
 * only honours a delete when the caller presents the same value, so it must
 * never be rendered or shared.
 */
export async function getAuthorToken(): Promise<string> {
  const existing = await getSetting('author_token');
  if (existing) return existing;
  const generated =
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36);
  await setSetting('author_token', generated);
  return generated;
}

async function authedHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'X-Author-Token': await getAuthorToken(), ...extra };
  const apiKey = await getBoardApiKey();
  if (apiKey) headers['X-API-Key'] = apiKey;
  return headers;
}

async function parseError(res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(body.error || `HTTP ${res.status}`);
}

async function requireBase(): Promise<string> {
  const base = await getBoardUrl();
  if (!base) throw new Error('No board server configured');
  return base;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(
  category?: MessageCategory | 'all',
  limit = 50,
  offset = 0
): Promise<MessagesResponse> {
  const base = await requireBase();
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (category && category !== 'all') params.set('category', category);
  const res = await fetch(`${base}/api/messages?${params}`, {
    headers: await authedHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function postMessage(input: PostMessageInput): Promise<BoardMessage> {
  const base = await requireBase();
  const res = await fetch(`${base}/api/messages`, {
    method: 'POST',
    headers: await authedHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) await parseError(res);
  const data = await res.json();
  return data.message;
}

/**
 * Flag a message for moderation. Reports are idempotent per device, and the
 * server hides a message once enough distinct devices have reported it.
 */
export async function reportMessage(
  id: string,
  reason?: string
): Promise<{ reported: boolean; hidden?: boolean; alreadyReported?: boolean }> {
  const base = await requireBase();
  const res = await fetch(`${base}/api/messages/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    headers: await authedHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ reason }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

// ─── Blocked authors ──────────────────────────────────────────────────────────

/**
 * Names the user has chosen to hide, stored on-device. The board has no
 * accounts, so blocking can only be by display name and is best-effort — it is
 * a "stop showing me this" control, not an access control.
 */
export async function getBlockedAuthors(): Promise<string[]> {
  const raw = await getSetting('board_blocked_authors');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function blockAuthor(author: string): Promise<string[]> {
  const name = author.trim();
  if (!name) return getBlockedAuthors();
  const current = await getBlockedAuthors();
  if (current.includes(name)) return current;
  const next = [...current, name];
  await setSetting('board_blocked_authors', JSON.stringify(next));
  return next;
}

export async function unblockAuthor(author: string): Promise<string[]> {
  const next = (await getBlockedAuthors()).filter((a) => a !== author);
  await setSetting('board_blocked_authors', JSON.stringify(next));
  return next;
}

export async function deleteMessage(id: string): Promise<void> {
  const base = await requireBase();
  const res = await fetch(`${base}/api/messages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authedHeaders({ 'Content-Type': 'application/json' }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) await parseError(res);
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function subscribeBoard(
  token: string,
  deviceName: string,
  platform: string
): Promise<void> {
  const base = await requireBase();
  const res = await fetch(`${base}/api/subscriptions`, {
    method: 'POST',
    headers: await authedHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ token, device_name: deviceName, platform }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) await parseError(res);
  await setSetting('board_subscribed', '1');
}

export async function unsubscribeBoard(token: string): Promise<void> {
  const base = await requireBase();
  const res = await fetch(`${base}/api/subscriptions/${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: await authedHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) await parseError(res);
  await setSetting('board_subscribed', '');
}

export async function isBoardSubscribed(): Promise<boolean> {
  return (await getSetting('board_subscribed')) === '1';
}

export async function getBoardStats(): Promise<{ total: number; subscribers: number }> {
  const base = await requireBase();
  const res = await fetch(`${base}/api/stats`, {
    headers: await authedHeaders(),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

// ─── Live updates ─────────────────────────────────────────────────────────────

export interface BoardSocketHandlers {
  onNewMessage: (msg: BoardMessage) => void;
  onDeleteMessage?: (id: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export async function connectWebSocket(handlers: BoardSocketHandlers): Promise<WebSocket | null> {
  try {
    const base = await getBoardUrl();
    if (!base) return null;
    const wsUrl = base.replace(/^http/, 'ws');
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => handlers.onConnect?.();
    ws.onclose = () => handlers.onDisconnect?.();
    ws.onerror = () => {};
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string);
        if (payload.type === 'new_message') {
          handlers.onNewMessage(payload.data as BoardMessage);
        } else if (payload.type === 'delete_message') {
          handlers.onDeleteMessage?.((payload.data as { id: string }).id);
        }
      } catch {
        /* ignore malformed frames */
      }
    };
    return ws;
  } catch {
    return null;
  }
}
