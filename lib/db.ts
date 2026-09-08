import Database from "better-sqlite3";
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

export function initializeSchema(db: Database.Database): void {
  // Enable foreign key constraints
  db.pragma("foreign_keys = ON");

  // Create tables in correct dependency order
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

export function closeDb(): void {
  if (defaultDb && defaultDb.open) {
    defaultDb.close();
    defaultDb = null;
  }
}
