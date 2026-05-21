import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS artists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    genres TEXT NOT NULL,
    location TEXT NOT NULL,
    fee_min INTEGER NOT NULL,
    fee_max INTEGER NOT NULL,
    onboarding_token TEXT NOT NULL UNIQUE,
    onboarded INTEGER NOT NULL DEFAULT 0,
    calendar_provider TEXT,
    onboarded_at TEXT,
    last_reminder_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS venues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    genres TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id INTEGER NOT NULL,
    slot_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    fee INTEGER NOT NULL,
    genre_required TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unfilled',
    confirmed_artist_id INTEGER,
    overture_slot_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venue_id) REFERENCES venues(id),
    FOREIGN KEY (confirmed_artist_id) REFERENCES artists(id)
  );

  CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL,
    artist_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    response_at TEXT,
    response_token TEXT NOT NULL UNIQUE,
    FOREIGN KEY (slot_id) REFERENCES slots(id),
    FOREIGN KEY (artist_id) REFERENCES artists(id)
  );

  CREATE TABLE IF NOT EXISTS calendar_busy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    FOREIGN KEY (artist_id) REFERENCES artists(id)
  );

  CREATE TABLE IF NOT EXISTS venue_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    venue_id INTEGER NOT NULL,
    played_at TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 4,
    FOREIGN KEY (artist_id) REFERENCES artists(id),
    FOREIGN KEY (venue_id) REFERENCES venues(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    slot_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sms_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (artist_id) REFERENCES artists(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
  CREATE INDEX IF NOT EXISTS idx_offers_expires ON offers(expires_at);
  CREATE INDEX IF NOT EXISTS idx_busy_artist ON calendar_busy(artist_id);
  CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);
`);

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

if (!getSetting('offer_window_seconds')) {
  setSetting('offer_window_seconds', '60');
}

export { getSetting, setSetting };
