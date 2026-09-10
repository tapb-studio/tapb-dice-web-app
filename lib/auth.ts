import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Database from "better-sqlite3";
import { query, getDb, User as DbUser } from "./db";

export type User = Omit<DbUser, "password_hash">;
export type SafeUser = User;

export const AUTH_COOKIE_NAME = "token";

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production environment");
    }
    return "28e06b2741fa3bae4b99aae1da784394bfb2e3dc6b5bc41d23c50bad517bb73d755aecfa683c3de06be1ac9800be4106";
  }
  return secret;
}

export function createToken(payload: object): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyToken<T = any>(token: string): T | null {
  if (!token) return null;
  const secret = getJwtSecret();
  try {
    return jwt.verify(token, secret) as T;
  } catch {
    return null;
  }
}

export async function registerUser(
  name: string,
  username: string,
  password: string,
  db?: Database.Database
): Promise<User> {
  if (!name || !name.trim()) {
    throw new Error("Name is required");
  }
  if (!username || !username.trim()) {
    throw new Error("Username is required");
  }
  if (!password || !password.trim()) {
    throw new Error("Password is required");
  }

  const trimmedName = name.trim();
  const trimmedUsername = username.trim();

  // If explicit SQLite db is provided (unit tests)
  if (db) {
    const existing = db
      .prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)")
      .get(trimmedUsername);

    if (existing) {
      throw new Error("Username already exists");
    }

    const id = crypto.randomUUID();
    const password_hash = await hashPassword(password);

    db.prepare(
      "INSERT INTO users (id, name, username, password_hash) VALUES (?, ?, ?, ?)"
    ).run(id, trimmedName, trimmedUsername, password_hash);

    const row = db
      .prepare("SELECT id, name, username, created_at FROM users WHERE id = ?")
      .get(id) as User;

    return row;
  }

  // Unified query (PostgreSQL in production/runtime)
  const existingRes = await query(
    "SELECT id FROM users WHERE LOWER(username) = LOWER($1)",
    [trimmedUsername]
  );

  if (existingRes.rows.length > 0) {
    throw new Error("Username already exists");
  }

  const id = crypto.randomUUID();
  const password_hash = await hashPassword(password);

  const insertRes = await query<User>(
    "INSERT INTO users (id, name, username, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, username, created_at",
    [id, trimmedName, trimmedUsername, password_hash]
  );

  return insertRes.rows[0];
}

export async function loginUser(
  username: string,
  password: string,
  db?: Database.Database
): Promise<{ user: User; token: string }> {
  if (!username || !username.trim()) {
    throw new Error("Username is required");
  }
  if (!password) {
    throw new Error("Password is required");
  }

  const trimmedUsername = username.trim();

  let row: DbUser | undefined;
  if (db) {
    row = db
      .prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)")
      .get(trimmedUsername) as DbUser | undefined;
  } else {
    const res = await query<DbUser>(
      "SELECT * FROM users WHERE LOWER(username) = LOWER($1)",
      [trimmedUsername]
    );
    row = res.rows[0];
  }

  if (!row) {
    throw new Error("Invalid username or password");
  }

  const isValid = await verifyPassword(password, row.password_hash);
  if (!isValid) {
    throw new Error("Invalid username or password");
  }

  const user: User = {
    id: row.id,
    name: row.name,
    username: row.username,
    created_at: String(row.created_at),
  };

  const token = createToken({
    id: user.id,
    username: user.username,
    name: user.name,
  });

  return { user, token };
}

export function getUserFromToken(
  token: string,
  db?: Database.Database
): User | null {
  const payload = verifyToken<{ id: string; username?: string; name?: string }>(token);
  if (!payload || !payload.id) {
    return null;
  }

  if (db) {
    const row = db
      .prepare(
        "SELECT id, name, username, created_at FROM users WHERE id = ?"
      )
      .get(payload.id) as User | undefined;
    return row || null;
  }

  try {
    const defaultSqlite = getDb();
    if (defaultSqlite && defaultSqlite.open) {
      const row = defaultSqlite
        .prepare(
          "SELECT id, name, username, created_at FROM users WHERE id = ?"
        )
        .get(payload.id) as User | undefined;
      if (row) return row;
    }
  } catch {
    // fallback
  }

  return {
    id: payload.id,
    name: payload.name || payload.username || "Adventurer",
    username: payload.username || payload.name || "Adventurer",
    created_at: "",
  };
}

export async function getUserFromTokenAsync(
  token: string
): Promise<User | null> {
  const payload = verifyToken<{ id: string; username?: string; name?: string }>(token);
  if (!payload || !payload.id) {
    return null;
  }

  try {
    const res = await query<User>(
      "SELECT id, name, username, created_at FROM users WHERE id = $1",
      [payload.id]
    );
    if (res.rows.length > 0) {
      return res.rows[0];
    }
  } catch {
    // Fallback to payload
  }

  return {
    id: payload.id,
    name: payload.name || payload.username || "Adventurer",
    username: payload.username || payload.name || "Adventurer",
    created_at: "",
  };
}
