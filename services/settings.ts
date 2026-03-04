/**
 * Settings Service
 *
 * Manages app settings persisted to device storage via expo-file-system.
 * Falls back to in-memory cache so reads are synchronous after first load.
 */

import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';

// ─── Storage path ─────────────────────────────────────────────────────────────

const SETTINGS_FILE = `${documentDirectory}survival_ai_settings.json`;

// ─── In-memory cache ──────────────────────────────────────────────────────────

let cache: Record<string, string> = {};
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const info = await getInfoAsync(SETTINGS_FILE);
    if (info.exists) {
      const raw = await readAsStringAsync(SETTINGS_FILE, {
        encoding: EncodingType.UTF8,
      });
      cache = JSON.parse(raw) as Record<string, string>;
    }
  } catch {
    // File missing or corrupt — start with empty cache
    cache = {};
  }
  loaded = true;
}

async function persist(): Promise<void> {
  try {
    await writeAsStringAsync(SETTINGS_FILE, JSON.stringify(cache), {
      encoding: EncodingType.UTF8,
    });
  } catch (e) {
    console.warn('[Settings] Failed to persist settings:', e);
  }
}

// ─── API Key helpers ──────────────────────────────────────────────────────────

export async function getApiKey(provider: 'openai' | 'anthropic'): Promise<string | null> {
  await ensureLoaded();
  return cache[`api_key_${provider}`] || null;
}

export async function setApiKey(provider: 'openai' | 'anthropic', apiKey: string): Promise<void> {
  await ensureLoaded();
  const key = `api_key_${provider}`;
  if (apiKey.trim()) {
    cache[key] = apiKey.trim();
  } else {
    delete cache[key];
  }
  await persist();
}

export async function hasApiKey(provider: 'openai' | 'anthropic'): Promise<boolean> {
  await ensureLoaded();
  return !!cache[`api_key_${provider}`];
}

// ─── Custom server helpers ────────────────────────────────────────────────────

export async function getCustomServerUrl(): Promise<string | null> {
  await ensureLoaded();
  return cache['custom_server_url'] || null;
}

export async function setCustomServerUrl(url: string): Promise<void> {
  await ensureLoaded();
  if (url.trim()) {
    cache['custom_server_url'] = url.trim();
  } else {
    delete cache['custom_server_url'];
  }
  await persist();
}

export async function getCustomModel(): Promise<string | null> {
  await ensureLoaded();
  return cache['custom_model'] || null;
}

export async function setCustomModel(model: string): Promise<void> {
  await ensureLoaded();
  if (model.trim()) {
    cache['custom_model'] = model.trim();
  } else {
    delete cache['custom_model'];
  }
  await persist();
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  await ensureLoaded();
  return cache[key] || null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureLoaded();
  if (value) {
    cache[key] = value;
  } else {
    delete cache[key];
  }
  await persist();
}
