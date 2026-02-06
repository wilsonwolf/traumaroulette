/**
 * @file SQLite database initialisation and singleton accessor.
 *
 * Uses `better-sqlite3` for synchronous, high-performance access.
 * The database file lives at the project root (`traumachat.db`).
 * On first access the schema is created (if it does not already exist),
 * WAL journal mode is enabled for concurrency, and foreign-key
 * enforcement is turned on.
 *
 * @module server/db/init
 */

const Database = require('better-sqlite3');
const path = require('path');

/** Absolute path to the SQLite database file at the project root. */
const DB_PATH = path.join(__dirname, '..', '..', 'traumachat.db');

/**
 * Module-level singleton reference to the open database connection.
 * Initialised lazily on the first call to {@link getDb}.
 * @type {import('better-sqlite3').Database|undefined}
 */
let db;

/**
 * Returns the singleton database connection, creating and initialising
 * it on the first call.
 *
 * - Enables WAL (Write-Ahead Logging) for better read/write concurrency.
 * - Enables foreign-key constraint enforcement (off by default in SQLite).
 * - Runs the full schema creation (idempotent via CREATE TABLE IF NOT EXISTS).
 *
 * @returns {import('better-sqlite3').Database} The open database handle.
 */
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

/**
 * Creates all application tables if they do not already exist.
 *
 * Table overview:
 *   - **users**           -- registered user accounts and profile data.
 *   - **conversations**   -- paired chat sessions between two users.
 *   - **messages**        -- text, voice, and system messages within conversations.
 *   - **extension_votes** -- per-round votes on whether to extend a conversation.
 *   - **photo_exchanges** -- photos submitted during the photo-exchange phase.
 *   - **ratings**         -- 1-5 star ratings users give each other's photos.
 *   - **points_log**      -- audit trail for every point award.
 *
 * @private
 */
function initSchema() {
  db.exec(`
    -- Core user accounts and profile information.
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      photo_url TEXT,
      bio TEXT,
      location TEXT,
      gender TEXT,
      age INTEGER,
      childhood_trauma TEXT,
      trauma_response TEXT,
      total_points INTEGER DEFAULT 0,
      onboarding_complete INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Each row represents a single paired conversation between two users.
    -- status tracks the conversation lifecycle (see CONVERSATION_STATUS).
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user1_id INTEGER NOT NULL REFERENCES users(id),
      user2_id INTEGER NOT NULL REFERENCES users(id),
      room_id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      extensions_count INTEGER DEFAULT 0,
      is_friends_forever INTEGER DEFAULT 0,
      current_timer_end TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- All messages exchanged during a conversation (text, voice, system).
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      sender_id INTEGER NOT NULL REFERENCES users(id),
      message_type TEXT NOT NULL DEFAULT 'text',
      content TEXT,
      voice_url TEXT,
      voice_duration REAL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Records each user's extension vote per voting round.
    -- A new round number is assigned for each extension cycle.
    CREATE TABLE IF NOT EXISTS extension_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      round INTEGER NOT NULL,
      vote TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Photos submitted during the photo-exchange phase.
    CREATE TABLE IF NOT EXISTS photo_exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      sender_id INTEGER NOT NULL REFERENCES users(id),
      photo_url TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Star ratings (1-5) that users give each other after viewing photos.
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      rater_id INTEGER NOT NULL REFERENCES users(id),
      rated_id INTEGER NOT NULL REFERENCES users(id),
      score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Immutable audit log of every point award.
    -- event_type captures the reason (participation, extension, rating, friends_forever).
    CREATE TABLE IF NOT EXISTS points_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      conversation_id INTEGER REFERENCES conversations(id),
      event_type TEXT NOT NULL,
      points INTEGER NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { getDb };
