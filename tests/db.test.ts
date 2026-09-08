import { describe, it, expect, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import { getDb, closeDb } from "@/lib/db";

describe("Database Layer (lib/db.ts)", () => {
  afterEach(() => {
    closeDb();
  });

  it("initializes an in-memory database and enables foreign keys", () => {
    const db = getDb(":memory:");
    expect(db).toBeDefined();

    const fkResult = db.pragma("foreign_keys", { simple: true });
    expect(fkResult).toBe(1);
    db.close();
  });

  it("creates required schema tables: users, rooms, and dice_rolls", () => {
    const db = getDb(":memory:");
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
      )
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("rooms");
    expect(tableNames).toContain("dice_rolls");
    db.close();
  });

  it("enforces foreign key constraints on rooms and dice_rolls", () => {
    const db = getDb(":memory:");

    // Attempt to insert room referencing non-existent user
    expect(() => {
      db.prepare(
        "INSERT INTO rooms (id, name, code, created_by) VALUES (?, ?, ?, ?)"
      ).run("room-1", "Tavern", "TAV-1", "non-existent-user");
    }).toThrow(/FOREIGN KEY/i);

    // Insert a valid user
    db.prepare(
      "INSERT INTO users (id, name, username, password_hash) VALUES (?, ?, ?, ?)"
    ).run("user-1", "Dungeon Master", "dm", "hashed_pw");

    // Room insertion should now succeed
    expect(() => {
      db.prepare(
        "INSERT INTO rooms (id, name, code, created_by) VALUES (?, ?, ?, ?)"
      ).run("room-1", "Tavern", "TAV-1", "user-1");
    }).not.toThrow();

    // Attempt to insert roll with invalid room_id
    expect(() => {
      db.prepare(
        `INSERT INTO dice_rolls (
          id, room_id, user_id, user_name, notation, dice_type, dice_count, modifier, individual_results, total, is_crit_hit, is_crit_fail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        "roll-1",
        "invalid-room",
        "user-1",
        "Dungeon Master",
        "1d20",
        "d20",
        1,
        0,
        "[20]",
        20,
        1,
        0
      );
    }).toThrow(/FOREIGN KEY/i);

    // Attempt to insert roll with invalid user_id
    expect(() => {
      db.prepare(
        `INSERT INTO dice_rolls (
          id, room_id, user_id, user_name, notation, dice_type, dice_count, modifier, individual_results, total, is_crit_hit, is_crit_fail
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        "roll-2",
        "room-1",
        "invalid-user",
        "Unknown",
        "1d20",
        "d20",
        1,
        0,
        "[20]",
        20,
        1,
        0
      );
    }).toThrow(/FOREIGN KEY/i);

    db.close();
  });

  it("supports basic insert and query operations across all tables", () => {
    const db = getDb(":memory:");

    // 1. Insert and query user
    db.prepare(
      "INSERT INTO users (id, name, username, password_hash) VALUES (?, ?, ?, ?)"
    ).run("user-1", "Geralt of Rivia", "geralt", "$2a$10$xyz");

    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get("user-1") as any;
    expect(user).toBeDefined();
    expect(user.name).toBe("Geralt of Rivia");
    expect(user.username).toBe("geralt");
    expect(user.password_hash).toBe("$2a$10$xyz");
    expect(user.created_at).toBeDefined();

    // 2. Insert and query room
    db.prepare(
      "INSERT INTO rooms (id, name, code, password_hash, created_by) VALUES (?, ?, ?, ?, ?)"
    ).run("room-1", "Kaer Morhen", "KAER-101", "room_pw_hash", "user-1");

    const room = db
      .prepare("SELECT * FROM rooms WHERE id = ?")
      .get("room-1") as any;
    expect(room).toBeDefined();
    expect(room.name).toBe("Kaer Morhen");
    expect(room.code).toBe("KAER-101");
    expect(room.password_hash).toBe("room_pw_hash");
    expect(room.created_by).toBe("user-1");
    expect(room.created_at).toBeDefined();

    // 3. Insert and query dice_rolls
    db.prepare(
      `INSERT INTO dice_rolls (
        id, room_id, user_id, user_name, notation, dice_type, dice_count, modifier, individual_results, total, is_crit_hit, is_crit_fail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "roll-1",
      "room-1",
      "user-1",
      "Geralt of Rivia",
      "2d20+3",
      "d20",
      2,
      3,
      JSON.stringify([20, 15]),
      38,
      1,
      0
    );

    const roll = db
      .prepare("SELECT * FROM dice_rolls WHERE id = ?")
      .get("roll-1") as any;
    expect(roll).toBeDefined();
    expect(roll.room_id).toBe("room-1");
    expect(roll.user_id).toBe("user-1");
    expect(roll.user_name).toBe("Geralt of Rivia");
    expect(roll.notation).toBe("2d20+3");
    expect(roll.dice_type).toBe("d20");
    expect(roll.dice_count).toBe(2);
    expect(roll.modifier).toBe(3);
    expect(JSON.parse(roll.individual_results)).toEqual([20, 15]);
    expect(roll.total).toBe(38);
    expect(roll.is_crit_hit).toBe(1);
    expect(roll.is_crit_fail).toBe(0);
    expect(roll.created_at).toBeDefined();

    db.close();
  });

  it("automatically creates directory when initializing a file-based database", () => {
    const tempDir = path.resolve(process.cwd(), ".tmp/test-db-dir");
    const tempDbPath = path.join(tempDir, "subfolder", "test.db");

    // Clean up if existed
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    const fileDb = getDb(tempDbPath);
    expect(fs.existsSync(tempDbPath)).toBe(true);

    fileDb.close();

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns a singleton database instance when getDb is called with no arguments and allows closeDb", () => {
    const tempDefaultDb = path.resolve(process.cwd(), ".tmp/default-test.db");
    process.env.DATABASE_PATH = tempDefaultDb;

    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
    expect(db1.open).toBe(true);

    closeDb();
    expect(db1.open).toBe(false);

    // Calling getDb again opens a new connection
    const db3 = getDb();
    expect(db3.open).toBe(true);
    expect(db3).not.toBe(db1);

    closeDb();
    if (fs.existsSync(tempDefaultDb)) {
      fs.rmSync(tempDefaultDb, { force: true });
    }
    delete process.env.DATABASE_PATH;
  });
});
