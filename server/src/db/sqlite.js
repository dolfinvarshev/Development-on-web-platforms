import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SQLITE_DIR || path.join(__dirname, '..', '..', 'data');

const DDL = `
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('defib_lora','defib_only','lora_only')),
  lora_id TEXT UNIQUE,
  medical_training TEXT,
  is_seed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  dev_eui TEXT UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('stationary','mobile')),
  has_defib INTEGER NOT NULL DEFAULT 1,
  has_lora INTEGER NOT NULL DEFAULT 0,
  has_magnus INTEGER NOT NULL DEFAULT 0,
  battery INTEGER,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','fault')),
  lat REAL,
  lng REAL,
  location_source TEXT CHECK (location_source IN ('lora','magnus','phone')),
  last_seen TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jti TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_jti ON refresh_tokens(jti);
`;

let db = null;

export function initSqlite() {
  if (db) return db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new Database(path.join(DATA_DIR, 'definet.sqlite'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(DDL);
  return db;
}

export function getDb() {
  if (!db) initSqlite();
  return db;
}
