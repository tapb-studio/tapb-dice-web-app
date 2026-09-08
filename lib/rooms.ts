import crypto from "crypto";
import Database from "better-sqlite3";
import { getDb, Room as DbRoom, DiceRoll } from "./db";
import { hashPassword, verifyPassword, AUTH_COOKIE_NAME } from "./auth";

export interface Room {
  id: string;
  name: string;
  code: string;
  hasPassword: boolean;
  created_by: string;
  created_at: string;
}

export interface RoomWithHistory {
  room: Room;
  recentRolls: any[];
}

const CODE_WORDS = [
  "DRAGON",
  "TAVERN",
  "GOBLIN",
  "WIZARD",
  "DUNGEON",
  "ROGUE",
  "PALADIN",
  "CLERIC",
  "FIGHTER",
  "RANGER",
  "BARD",
  "MONK",
  "WARLOCK",
  "SORCERER",
  "DRUID",
  "BEHOLDER",
  "MIMIC",
  "KRAKEN",
  "PHOENIX",
  "TITAN",
  "VALKYRIE",
  "CASTLE",
  "QUEST",
  "HYDRA",
  "GRIFFIN",
  "KNIGHT",
];

export function generateRoomCode(): string {
  const word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  const num = Math.floor(100 + Math.random() * 900); // 100-999
  return `${word}-${num}`;
}

export function extractToken(
  req:
    | Request
    | {
        headers: Headers | { get(key: string): string | null };
        cookies?: { get(key: string): { value?: string } | string | undefined };
      }
): string | undefined {
  if ("cookies" in req && req.cookies && typeof req.cookies.get === "function") {
    const cookie = req.cookies.get(AUTH_COOKIE_NAME);
    if (typeof cookie === "string") return cookie;
    if (cookie?.value) return cookie.value;
  }
  const cookieHeader =
    typeof req.headers.get === "function" ? req.headers.get("cookie") : null;
  if (cookieHeader) {
    const match = cookieHeader.match(
      new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]*)`)
    );
    if (match) return decodeURIComponent(match[1]);
  }
  const authHeader =
    typeof req.headers.get === "function"
      ? req.headers.get("authorization")
      : null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export async function createRoom(
  name: string,
  password: string | null = null,
  userId: string,
  db?: Database.Database
): Promise<Room> {
  if (!name || !name.trim()) {
    throw new Error("Room name is required");
  }
  if (!userId || !userId.trim()) {
    throw new Error("User ID is required");
  }

  const database = db || getDb();
  const trimmedName = name.trim();
  const trimmedUserId = userId.trim();

  let code = "";
  for (let attempts = 0; attempts < 20; attempts++) {
    const candidate = generateRoomCode();
    const existing = database
      .prepare("SELECT id FROM rooms WHERE code = ?")
      .get(candidate);
    if (!existing) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    code = `ROOM-${Math.floor(100 + Math.random() * 900)}`;
  }

  let password_hash: string | null = null;
  if (password && password.trim()) {
    password_hash = await hashPassword(password);
  }

  const id = crypto.randomUUID();

  database
    .prepare(
      "INSERT INTO rooms (id, name, code, password_hash, created_by) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, trimmedName, code, password_hash, trimmedUserId);

  const row = database
    .prepare("SELECT * FROM rooms WHERE id = ?")
    .get(id) as DbRoom;

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    hasPassword: Boolean(row.password_hash),
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export async function verifyRoomAccess(
  code: string,
  password: string | null = null,
  db?: Database.Database
): Promise<{ valid: boolean; room?: Room; error?: string }> {
  if (!code || !code.trim()) {
    return { valid: false, error: "Room code is required" };
  }

  const database = db || getDb();
  const trimmedCode = code.trim().toUpperCase();

  const row = database
    .prepare("SELECT * FROM rooms WHERE UPPER(code) = ?")
    .get(trimmedCode) as DbRoom | undefined;

  if (!row) {
    return { valid: false, error: "Room not found" };
  }

  const room: Room = {
    id: row.id,
    name: row.name,
    code: row.code,
    hasPassword: Boolean(row.password_hash),
    created_by: row.created_by,
    created_at: row.created_at,
  };

  if (!row.password_hash) {
    return { valid: true, room };
  }

  if (!password) {
    return { valid: false, room, error: "Password required" };
  }

  const isMatch = await verifyPassword(password, row.password_hash);
  if (!isMatch) {
    return { valid: false, room, error: "Invalid password" };
  }

  return { valid: true, room };
}

export function getRoomByCode(
  code: string,
  db?: Database.Database
): RoomWithHistory | null {
  if (!code || !code.trim()) return null;

  const database = db || getDb();
  const trimmedCode = code.trim().toUpperCase();

  const row = database
    .prepare("SELECT * FROM rooms WHERE UPPER(code) = ?")
    .get(trimmedCode) as DbRoom | undefined;

  if (!row) return null;

  const room: Room = {
    id: row.id,
    name: row.name,
    code: row.code,
    hasPassword: Boolean(row.password_hash),
    created_by: row.created_by,
    created_at: row.created_at,
  };

  const rolls = database
    .prepare(
      "SELECT * FROM dice_rolls WHERE room_id = ? ORDER BY created_at DESC LIMIT 50"
    )
    .all(row.id) as DiceRoll[];

  const recentRolls = rolls.map((roll) => {
    let parsedResults = roll.individual_results;
    if (typeof roll.individual_results === "string") {
      try {
        parsedResults = JSON.parse(roll.individual_results);
      } catch {
        parsedResults = roll.individual_results;
      }
    }
    return {
      ...roll,
      individual_results: parsedResults,
    };
  });

  return { room, recentRolls };
}

export function listRooms(
  options?: { userId?: string; limit?: number },
  db?: Database.Database
): Room[] {
  const database = db || getDb();
  const limit = options?.limit && options.limit > 0 ? options.limit : 50;

  let rows: DbRoom[];
  if (options?.userId) {
    rows = database
      .prepare(
        "SELECT * FROM rooms WHERE created_by = ? ORDER BY created_at DESC LIMIT ?"
      )
      .all(options.userId, limit) as DbRoom[];
  } else {
    rows = database
      .prepare("SELECT * FROM rooms ORDER BY created_at DESC LIMIT ?")
      .all(limit) as DbRoom[];
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    hasPassword: Boolean(row.password_hash),
    created_by: row.created_by,
    created_at: row.created_at,
  }));
}
