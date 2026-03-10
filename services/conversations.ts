/**
 * Conversations Service
 *
 * Manages multi-thread AI chat history.
 * Each conversation is stored as a JSON file in the device's document directory.
 */

import * as FileSystem from 'expo-file-system';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConvMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number; // epoch ms
  mode: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ConvMessage[];
  mode: string;
}

// ─── Storage path ─────────────────────────────────────────────────────────────

const CONV_DIR = `${FileSystem.documentDirectory}conversations/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CONV_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CONV_DIR, { intermediates: true });
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function loadAllConversations(): Promise<Conversation[]> {
  try {
    await ensureDir();
    const files = await FileSystem.readDirectoryAsync(CONV_DIR);
    const convs: Conversation[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await FileSystem.readAsStringAsync(`${CONV_DIR}${f}`);
        convs.push(JSON.parse(raw) as Conversation);
      } catch {
        // corrupt file — skip
      }
    }
    return convs.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function saveConversation(conv: Conversation): Promise<void> {
  try {
    await ensureDir();
    await FileSystem.writeAsStringAsync(
      `${CONV_DIR}${conv.id}.json`,
      JSON.stringify(conv),
    );
  } catch {
    // silently fail
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(`${CONV_DIR}${id}.json`, { idempotent: true });
  } catch {
    // silently fail
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function createConversation(mode: string = 'knowledge'): Conversation {
  const now = Date.now();
  return {
    id: `conv_${now}_${Math.random().toString(36).slice(2, 8)}`,
    title: 'New Chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
    mode,
  };
}

export function generateTitle(messages: ConvMessage[]): string {
  const firstUser = messages.find((m) => m.sender === 'user');
  if (!firstUser) return 'New Chat';
  const text = firstUser.text.trim().slice(0, 45);
  return text.length < firstUser.text.trim().length ? `${text}…` : text;
}
