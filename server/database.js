const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'board.db');

let db;

function getDb() {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT DEFAULT 'Anonymous',
      author_token TEXT,
      category TEXT DEFAULT 'general',
      location TEXT,
      latitude REAL,
      longitude REAL,
      platform TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      token TEXT PRIMARY KEY,
      device_name TEXT,
      platform TEXT,
      created_at INTEGER NOT NULL,
      last_active INTEGER
    );

    CREATE TABLE IF NOT EXISTS reports (
      message_id TEXT NOT NULL,
      reporter_token TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (message_id, reporter_token)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_category_created ON messages(category, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_message ON reports(message_id);
  `);

  migrate(db);

  console.log('[DB] SQLite database initialized at', DB_PATH);
  return db;
}

/**
 * Additive schema changes for databases created by an earlier version.
 * SQLite has no "ADD COLUMN IF NOT EXISTS", so check the table info first.
 */
function migrate(db) {
  const columns = db.prepare('PRAGMA table_info(messages)').all().map((c) => c.name);

  if (!columns.includes('hidden')) {
    db.exec('ALTER TABLE messages ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0');
    console.log('[DB] Migration: added messages.hidden');
  }
  if (!columns.includes('report_count')) {
    db.exec('ALTER TABLE messages ADD COLUMN report_count INTEGER NOT NULL DEFAULT 0');
    console.log('[DB] Migration: added messages.report_count');
  }
}

module.exports = { getDb };
