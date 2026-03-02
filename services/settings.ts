/**
 * Settings Service
 *
 * Manages app settings stored locally on device.
 * Uses a simple in-memory store with AsyncStorage-like interface.
 * In production, replace with @react-native-async-storage/async-storage.
 */

// In-memory storage (replace with AsyncStorage for persistence)
const store: Record<string, string> = {};

/**
 * Get a stored API key by provider name.
 */
export async function getApiKey(provider: 'openai' | 'anthropic'): Promise<string | null> {
  const key = `api_key_${provider}`;
  return store[key] || null;
}

/**
 * Save an API key for a provider.
 */
export async function setApiKey(provider: 'openai' | 'anthropic', apiKey: string): Promise<void> {
  const key = `api_key_${provider}`;
  if (apiKey.trim()) {
    store[key] = apiKey.trim();
  } else {
    delete store[key];
  }
}

/**
 * Check if an API key exists for a provider.
 */
export async function hasApiKey(provider: 'openai' | 'anthropic'): Promise<boolean> {
  const key = `api_key_${provider}`;
  return !!store[key];
}

/**
 * Get a generic setting value.
 */
export async function getSetting(key: string): Promise<string | null> {
  return store[key] || null;
}

/**
 * Save a generic setting value.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  store[key] = value;
}
