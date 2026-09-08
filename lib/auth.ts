import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Database from "better-sqlite3";
import { getDb, User as DbUser } from "./db";

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
    return "tapb-secret-key-change-in-prod";
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

  const database = db || getDb();
  const trimmedName = name.trim();
  const trimmedUsername = username.trim();

  // Check if username already exists (case-insensitive check)
  const existing = database
    .prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?)")
    .get(trimmedUsername);

  if (existing) {
    throw new Error("Username already exists");
  }

  const id = crypto.randomUUID();
  const password_hash = await hashPassword(password);

  database
    .prepare(
      "INSERT INTO users (id, name, username, password_hash) VALUES (?, ?, ?, ?)"
    )
    .run(id, trimmedName, trimmedUsername, password_hash);

  const row = database
    .prepare(
      "SELECT id, name, username, created_at FROM users WHERE id = ?"
    )
    .get(id) as User;

  return row;
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

  const database = db || getDb();
  const trimmedUsername = username.trim();

  const row = database
    .prepare("SELECT * FROM users WHERE LOWER(username) = LOWER(?)")
    .get(trimmedUsername) as DbUser | undefined;

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
    created_at: row.created_at,
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
  const payload = verifyToken<{ id: string; username?: string }>(token);
  if (!payload || !payload.id) {
    return null;
  }

  const database = db || getDb();
  const row = database
    .prepare(
      "SELECT id, name, username, created_at FROM users WHERE id = ?"
    )
    .get(payload.id) as User | undefined;

  return row || null;
}
