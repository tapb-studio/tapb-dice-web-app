import Database from "better-sqlite3";
import { Pool, QueryResultRow } from "pg";
import fs from "fs";
import path from "path";

export interface User {
  id: string;
  name: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  password_hash: string | null;
  created_by: string;
  created_at: string;
}

export interface DiceRoll {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  notation: string;
  dice_type: string;
  dice_count: number;
  modifier: number;
  individual_results: string;
  total: number;
  is_crit_hit: number;
  is_crit_fail: number;
  created_at: string;
}

let defaultDb: Database.Database | null = null;
let pgPool: Pool | null = null;

export const DEFAULT_POSTGRES_URL =
  "postgresql://tapb_dice:tapbDiceSecure2026!@10.10.0.34:5432/tapb-dice";

/**
 * Returns a PostgreSQL connection pool.
 */
export function getPgPool(): Pool {
  if (pgPool) {
    return pgPool;
  }

  const connectionString = process.env.DATABASE_URL || DEFAULT_POSTGRES_URL;

  pgPool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pgPool.on("error", (err) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[PostgreSQL Pool] Unexpected error on idle client:", err);
    }
  });

  return pgPool;
}

/**
 * Closes the PostgreSQL connection pool.
 */
export async function closePgPool(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

/**
 * Initializes the PostgreSQL schema for users, rooms, and dice_rolls.
 */
export async function initializePgSchema(pool?: Pool): Promise<void> {
  const p = pool || getPgPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255),
      created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dice_rolls (
      id VARCHAR(255) PRIMARY KEY,
      room_id VARCHAR(255) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_name VARCHAR(255) NOT NULL,
      notation VARCHAR(64) NOT NULL,
      dice_type VARCHAR(16) NOT NULL,
      dice_count INTEGER NOT NULL,
      modifier INTEGER NOT NULL DEFAULT 0,
      individual_results TEXT NOT NULL,
      total INTEGER NOT NULL,
      is_crit_hit INTEGER NOT NULL DEFAULT 0,
      is_crit_fail INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_dice_rolls_room_id ON dice_rolls(room_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
  `);
}

/**
 * Universal query runner supporting both PostgreSQL ($1, $2...) and SQLite (?).
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: any[] = [],
  customDb?: Database.Database | Pool
): Promise<{ rows: T[]; rowCount: number }> {
  // 1. If explicit SQLite database instance is provided (e.g. unit tests)
  if (customDb && typeof (customDb as any).prepare === "function") {
    const sqlite = customDb as Database.Database;
    const sqliteSql = text.replace(/\$\d+/g, "?");
    const stmt = sqlite.prepare(sqliteSql);
    const upper = text.trim().toUpperCase();
    if (upper.startsWith("SELECT") || text.toUpperCase().includes("RETURNING")) {
      const rows = stmt.all(...params) as T[];
      return { rows, rowCount: rows.length };
    } else {
      const info = stmt.run(...params);
      return { rows: [] as T[], rowCount: info.changes };
    }
  }

  // 2. If explicit PostgreSQL pool is provided
  if (customDb && typeof (customDb as any).query === "function") {
    const res = await (customDb as Pool).query<T>(text, params);
    return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
  }

  // 3. If in test environment without DATABASE_URL (uses SQLite fallback)
  if (process.env.VITEST && !process.env.DATABASE_URL) {
    const sqlite = getDb();
    const sqliteSql = text.replace(/\$\d+/g, "?");
    const stmt = sqlite.prepare(sqliteSql);
    const upper = text.trim().toUpperCase();
    if (upper.startsWith("SELECT") || text.toUpperCase().includes("RETURNING")) {
      const rows = stmt.all(...params) as T[];
      return { rows, rowCount: rows.length };
    } else {
      const info = stmt.run(...params);
      return { rows: [] as T[], rowCount: info.changes };
    }
  }

  // 4. Default: Use PostgreSQL pool
  const pool = getPgPool();
  const res = await pool.query<T>(text, params);
  return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
}

/**
 * SQLite schema initializer (for unit tests / backward compatibility).
 */
export function initializeSchema(db: Database.Database): void {
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS dice_rolls (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      notation TEXT NOT NULL,
      dice_type TEXT NOT NULL,
      dice_count INTEGER NOT NULL,
      modifier INTEGER NOT NULL DEFAULT 0,
      individual_results TEXT NOT NULL,
      total INTEGER NOT NULL,
      is_crit_hit INTEGER NOT NULL DEFAULT 0,
      is_crit_fail INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_dice_rolls_room_id ON dice_rolls(room_id);
  `);
}

/**
 * Returns a SQLite connection (used in unit tests).
 */
export function getDb(dbPath?: string): Database.Database {
  if (dbPath) {
    if (dbPath !== ":memory:") {
      const resolvedDir = path.dirname(path.resolve(dbPath));
      fs.mkdirSync(resolvedDir, { recursive: true });
    }
    const db = new Database(dbPath);
    if (dbPath !== ":memory:") {
      db.pragma("journal_mode = WAL");
    }
    initializeSchema(db);
    return db;
  }

  if (defaultDb && defaultDb.open) {
    return defaultDb;
  }

  const targetPath =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), "database", "app.db");

  if (targetPath !== ":memory:") {
    const resolvedDir = path.dirname(path.resolve(targetPath));
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  defaultDb = new Database(targetPath);
  if (targetPath !== ":memory:") {
    defaultDb.pragma("journal_mode = WAL");
  }
  initializeSchema(defaultDb);

  return defaultDb;
}

/**
 * Closes the SQLite connection and cleans up default connections.
 */
export function closeDb(): void {
  if (defaultDb && defaultDb.open) {
    defaultDb.close();
    defaultDb = null;
  }
  if (pgPool) {
    pgPool.end().catch(() => {});
    pgPool = null;
  }
}
