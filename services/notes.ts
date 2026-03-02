/**
 * Notes Service
 * 
 * Manages survival log notes with text + image capture.
 * Supports syncing to S3 or compatible storage when online.
 */

export interface NoteImage {
  id: string;
  uri: string;
  timestamp: Date;
  synced: boolean;
  remoteUrl?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  images: NoteImage[];
  tags: string[];
  location?: { latitude: number; longitude: number };
  createdAt: Date;
  updatedAt: Date;
  synced: boolean;
  syncedAt?: Date;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface S3Config {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

let notes: Note[] = [];
let s3Config: S3Config | null = null;
let listeners: Array<() => void> = [];

function notifyListeners() {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

export function getAllNotes(): Note[] {
  return [...notes].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function getNoteById(id: string): Note | undefined {
  return notes.find((n) => n.id === id);
}

export function createNote(params: {
  title: string;
  content: string;
  tags?: string[];
  priority?: Note['priority'];
  location?: Note['location'];
}): Note {
  const now = new Date();
  const note: Note = {
    id: generateId(),
    title: params.title,
    content: params.content,
    images: [],
    tags: params.tags || [],
    location: params.location,
    createdAt: now,
    updatedAt: now,
    synced: false,
    priority: params.priority || 'normal',
  };
  notes.push(note);
  notifyListeners();
  return note;
}

export function updateNote(
  id: string,
  updates: Partial<Pick<Note, 'title' | 'content' | 'tags' | 'priority' | 'location'>>
): Note | undefined {
  const note = notes.find((n) => n.id === id);
  if (!note) return undefined;
  Object.assign(note, updates, { updatedAt: new Date(), synced: false });
  notifyListeners();
  return note;
}

export function deleteNote(id: string): boolean {
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  notes.splice(idx, 1);
  notifyListeners();
  return true;
}

export function addImageToNote(noteId: string, imageUri: string): NoteImage | undefined {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return undefined;
  const image: NoteImage = {
    id: generateId(),
    uri: imageUri,
    timestamp: new Date(),
    synced: false,
  };
  note.images.push(image);
  note.updatedAt = new Date();
  note.synced = false;
  notifyListeners();
  return image;
}

export function removeImageFromNote(noteId: string, imageId: string): boolean {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return false;
  const idx = note.images.findIndex((img) => img.id === imageId);
  if (idx === -1) return false;
  note.images.splice(idx, 1);
  note.updatedAt = new Date();
  note.synced = false;
  notifyListeners();
  return true;
}

export function setS3Config(config: S3Config): void {
  s3Config = config;
}

export function getS3Config(): S3Config | null {
  return s3Config;
}

export function hasS3Config(): boolean {
  return s3Config !== null;
}

async function uploadToS3(key: string, body: string, contentType: string): Promise<string> {
  if (!s3Config) throw new Error('S3 not configured');

  const { endpoint, bucket } = s3Config;
  const url = `${endpoint}/${bucket}/${key}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`);
  }

  return url;
}

export async function syncNote(noteId: string): Promise<boolean> {
  if (!s3Config) return false;
  const note = notes.find((n) => n.id === noteId);
  if (!note) return false;

  try {
    const key = `survival-notes/${note.id}.json`;
    const noteData = JSON.stringify({
      ...note,
      images: note.images.map((img) => ({
        ...img,
        uri: img.remoteUrl || img.uri,
      })),
    });

    await uploadToS3(key, noteData, 'application/json');
    note.synced = true;
    note.syncedAt = new Date();
    notifyListeners();
    return true;
  } catch (error) {
    console.log('[Notes] Sync failed:', (error as Error).message);
    return false;
  }
}

export async function syncAllNotes(): Promise<{ synced: number; failed: number }> {
  const unsynced = notes.filter((n) => !n.synced);
  let synced = 0;
  let failed = 0;

  for (const note of unsynced) {
    const success = await syncNote(note.id);
    if (success) synced++;
    else failed++;
  }

  return { synced, failed };
}

export function getUnsyncedCount(): number {
  return notes.filter((n) => !n.synced).length;
}

export function searchNotes(query: string): Note[] {
  const q = query.toLowerCase();
  return notes
    .filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((tag) => tag.toLowerCase().includes(q))
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
