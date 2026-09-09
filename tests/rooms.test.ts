import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { getDb, closeDb } from "@/lib/db";
import { registerUser, createToken } from "@/lib/auth";
import * as roomsModule from "@/lib/rooms";
import {
  generateRoomCode,
  createRoom,
  verifyRoomAccess,
  getRoomByCode,
  listRooms,
} from "@/lib/rooms";
import { POST as createRoomHandler, GET as listRoomsHandler } from "@/app/api/rooms/route";
import { POST as verifyRoomHandler } from "@/app/api/rooms/verify/route";
import { GET as getRoomHandler } from "@/app/api/rooms/[code]/route";

const TEST_DB_PATH = path.resolve(process.cwd(), ".tmp/test-rooms.db");

describe("Room Management System (Task 4)", () => {
  let db: ReturnType<typeof getDb>;
  let testUser: { id: string; name: string; username: string };

  beforeEach(async () => {
    process.env.DATABASE_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = "test-jwt-secret-key";
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH, { force: true });
    }
    db = getDb(TEST_DB_PATH);
    testUser = await registerUser("Dungeon Master", "dm_master", "dragonPass123", db);
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH, { force: true });
    }
    delete process.env.DATABASE_PATH;
    delete process.env.JWT_SECRET;
  });

  describe("Room Code Generation (generateRoomCode)", () => {
    it("generates uppercase readable codes matching /^[A-Z]+-\\d{3,4}$/", () => {
      const code = generateRoomCode();
      expect(typeof code).toBe("string");
      expect(code).toMatch(/^[A-Z]+-\d{3,4}$/);
      expect(code).toBe(code.toUpperCase());
    });

    it("generates distinct codes on successive calls", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        codes.add(generateRoomCode());
      }
      expect(codes.size).toBeGreaterThan(10);
    });
  });

  describe("Room Creation (createRoom)", () => {
    it("creates a public room without password, returning safe Room object omitting password_hash", async () => {
      const room = await createRoom("Dragon Lair", null, testUser.id, db);

      expect(room).toBeDefined();
      expect(room.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(room.name).toBe("Dragon Lair");
      expect(room.code).toMatch(/^[A-Z]+-\d{3,4}$/);
      expect(room.hasPassword).toBe(false);
      expect(room.created_by).toBe(testUser.id);
      expect(room.created_at).toBeDefined();
      expect((room as any).password_hash).toBeUndefined();

      // Verify row in database
      const row = db.prepare("SELECT * FROM rooms WHERE id = ?").get(room.id) as any;
      expect(row).toBeDefined();
      expect(row.password_hash).toBeNull();
    });

    it("creates a password-protected room with hashed password and hasPassword true", async () => {
      const room = await createRoom("Secret Sanctuary", "mypassword123", testUser.id, db);

      expect(room).toBeDefined();
      expect(room.hasPassword).toBe(true);
      expect((room as any).password_hash).toBeUndefined();

      // Check DB contains hashed password, not plaintext
      const row = db.prepare("SELECT * FROM rooms WHERE id = ?").get(room.id) as any;
      expect(row).toBeDefined();
      expect(row.password_hash).toBeDefined();
      expect(row.password_hash).not.toBe("mypassword123");
      expect(row.password_hash).toMatch(/^\$2[aby]\$\d+\$/);
    });

    it("throws error when room name or user ID is missing", async () => {
      await expect(createRoom("", null, testUser.id, db)).rejects.toThrow(/room name is required/i);
      await expect(createRoom("   ", null, testUser.id, db)).rejects.toThrow(/room name is required/i);
      await expect(createRoom("Valid Name", null, "", db)).rejects.toThrow(/user id is required/i);
    });

    it("fails with foreign key error if user ID does not exist in users table", async () => {
      await expect(
        createRoom("Lost Temple", null, "non-existent-user-id", db)
      ).rejects.toThrow(/FOREIGN KEY/i);
    });

    it("generates unique fallback code with random hex digits if candidate codes collide", async () => {
      // Simulate code collisions by passing custom db where SELECT id returns collision
      const mockDb = {
        prepare: (sql: string) => {
          if (sql.includes("SELECT id FROM rooms WHERE code = ?")) {
            return {
              get: () => ({ id: "collision-id" }),
            };
          }
          return db.prepare(sql);
        },
      } as any;

      const fallbackRoom = await createRoom("Fallback Vault", null, testUser.id, mockDb);

      expect(fallbackRoom.code).toMatch(/^ROOM-[0-9A-F]{6}$/);
      expect(fallbackRoom.name).toBe("Fallback Vault");
    });
  });

  describe("Room Access Verification (verifyRoomAccess)", () => {
    it("allows access to public room without password", async () => {
      const room = await createRoom("Public Tavern", null, testUser.id, db);

      const res = await verifyRoomAccess(room.code, null, db);
      expect(res.valid).toBe(true);
      expect(res.room).toBeDefined();
      expect(res.room?.id).toBe(room.id);
      expect(res.room?.hasPassword).toBe(false);
      expect((res.room as any)?.password_hash).toBeUndefined();
    });

    it("validates access to password-protected room with correct password", async () => {
      const room = await createRoom("Vault of Secrets", "open_sesame", testUser.id, db);

      // Wrong password
      const wrong = await verifyRoomAccess(room.code, "wrong_guess", db);
      expect(wrong.valid).toBe(false);
      expect(wrong.error).toMatch(/invalid password/i);

      // Missing password
      const missing = await verifyRoomAccess(room.code, null, db);
      expect(missing.valid).toBe(false);
      expect(missing.error).toMatch(/password required/i);

      // Correct password
      const correct = await verifyRoomAccess(room.code, "open_sesame", db);
      expect(correct.valid).toBe(true);
      expect(correct.room).toBeDefined();
      expect(correct.room?.code).toBe(room.code);
      expect(correct.room?.hasPassword).toBe(true);
      expect((correct.room as any)?.password_hash).toBeUndefined();
    });

    it("returns valid: false with room not found for nonexistent room code", async () => {
      const res = await verifyRoomAccess("NONEXISTENT-999", null, db);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/room not found/i);
    });

    it("is case-insensitive for room codes", async () => {
      const room = await createRoom("Echo Chamber", null, testUser.id, db);
      const lowerCode = room.code.toLowerCase();

      const res = await verifyRoomAccess(lowerCode, null, db);
      expect(res.valid).toBe(true);
      expect(res.room?.id).toBe(room.id);
    });
  });

  describe("Room Lookup & Roll History (getRoomByCode)", () => {
    it("returns null for non-existent room code", () => {
      expect(getRoomByCode("UNKNOWN-000", db)).toBeNull();
    });

    it("returns room metadata and roll history ordered by created_at DESC", async () => {
      const room = await createRoom("Battle Arena", null, testUser.id, db);

      // Insert 2 dice rolls into the room
      db.prepare(`
        INSERT INTO dice_rolls (
          id, room_id, user_id, user_name, notation, dice_type, dice_count, modifier, individual_results, total, is_crit_hit, is_crit_fail, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "roll-1",
        room.id,
        testUser.id,
        testUser.name,
        "1d20+2",
        "d20",
        1,
        2,
        JSON.stringify([18]),
        20,
        0,
        0,
        "2026-09-08 20:00:00"
      );

      db.prepare(`
        INSERT INTO dice_rolls (
          id, room_id, user_id, user_name, notation, dice_type, dice_count, modifier, individual_results, total, is_crit_hit, is_crit_fail, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "roll-2",
        room.id,
        testUser.id,
        testUser.name,
        "2d6",
        "d6",
        2,
        0,
        JSON.stringify([3, 4]),
        7,
        0,
        0,
        "2026-09-08 20:05:00"
      );

      const result = getRoomByCode(room.code, db);
      expect(result).toBeDefined();
      expect(result?.room.id).toBe(room.id);
      expect(result?.room.name).toBe("Battle Arena");
      expect(result?.room.hasPassword).toBe(false);
      expect((result?.room as any).password_hash).toBeUndefined();

      expect(result?.recentRolls).toHaveLength(2);
      // Most recent first
      expect(result?.recentRolls[0].id).toBe("roll-2");
      expect(result?.recentRolls[0].notation).toBe("2d6");
      expect(result?.recentRolls[1].id).toBe("roll-1");
    });
  });

  describe("Room Listing (listRooms)", () => {
    it("lists rooms ordered by creation and filters by userId", async () => {
      const otherUser = await registerUser("Player Two", "player2", "pass12345", db);

      const r1 = await createRoom("Room 1", null, testUser.id, db);
      const r2 = await createRoom("Room 2", "secret", testUser.id, db);
      const r3 = await createRoom("Room 3", null, otherUser.id, db);

      const allRooms = listRooms({}, db);
      expect(allRooms.length).toBeGreaterThanOrEqual(3);
      expect(allRooms.some((r) => r.id === r1.id)).toBe(true);
      expect(allRooms.some((r) => r.id === r2.id)).toBe(true);
      expect(allRooms.some((r) => r.id === r3.id)).toBe(true);

      const userRooms = listRooms({ userId: testUser.id }, db);
      expect(userRooms.every((r) => r.created_by === testUser.id)).toBe(true);
      expect(userRooms.some((r) => r.id === r3.id)).toBe(false);
    });
  });

  describe("API Route Handlers", () => {
    let authToken: string;

    beforeEach(() => {
      authToken = createToken({
        id: testUser.id,
        username: testUser.username,
        name: testUser.name,
      });
    });

    describe("POST /api/rooms", () => {
      it("rejects unauthenticated requests with 401", async () => {
        const req = new NextRequest("http://localhost:3000/api/rooms", {
          method: "POST",
          body: JSON.stringify({ name: "Rogue Hideout" }),
        });

        const res = await createRoomHandler(req);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toMatch(/unauthorized/i);
      });

      it("creates a room when authenticated with cookie and returns 201", async () => {
        const req = new NextRequest("http://localhost:3000/api/rooms", {
          method: "POST",
          headers: {
            cookie: `token=${authToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: "Goblin Camp", password: "goblinpassword" }),
        });

        const res = await createRoomHandler(req);
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.room).toBeDefined();
        expect(json.room.name).toBe("Goblin Camp");
        expect(json.room.hasPassword).toBe(true);
        expect(json.room.password_hash).toBeUndefined();
        expect(json.room.created_by).toBe(testUser.id);
      });

      it("creates a room when authenticated with Bearer Authorization header", async () => {
        const req = new NextRequest("http://localhost:3000/api/rooms", {
          method: "POST",
          headers: {
            authorization: `Bearer ${authToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: "Wizard Tower" }),
        });

        const res = await createRoomHandler(req);
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.room).toBeDefined();
        expect(json.room.hasPassword).toBe(false);
      });

      it("rejects invalid or missing room name with 400", async () => {
        const req = new NextRequest("http://localhost:3000/api/rooms", {
          method: "POST",
          headers: {
            cookie: `token=${authToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: "   " }),
        });

        const res = await createRoomHandler(req);
        expect(res.status).toBe(400);
      });

      it("rejects malformed JSON body with 400", async () => {
        const req = new NextRequest("http://localhost:3000/api/rooms", {
          method: "POST",
          headers: {
            cookie: `token=${authToken}`,
            "content-type": "application/json",
          },
          body: "{invalid json body",
        });

        const res = await createRoomHandler(req);
        expect(res.status).toBe(400);
      });
    });

    describe("GET /api/rooms", () => {
      it("returns list of rooms", async () => {
        await createRoom("Public Room A", null, testUser.id, db);

        const req = new NextRequest("http://localhost:3000/api/rooms");
        const res = await listRoomsHandler(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(Array.isArray(json.rooms)).toBe(true);
        expect(json.rooms.length).toBeGreaterThanOrEqual(1);
      });

      it("returns user's rooms when ?mine=true and authenticated", async () => {
        const otherUser = await registerUser("Other DM", "otherdm", "pass123", db);
        const myRoom = await createRoom("My Room", null, testUser.id, db);
        await createRoom("Other Room", null, otherUser.id, db);

        const req = new NextRequest("http://localhost:3000/api/rooms?mine=true", {
          headers: {
            cookie: `token=${authToken}`,
          },
        });

        const res = await listRoomsHandler(req);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.rooms.every((r: any) => r.created_by === testUser.id)).toBe(true);
        expect(json.rooms.some((r: any) => r.id === myRoom.id)).toBe(true);
      });

      it("rejects ?mine=true with 401 when unauthenticated", async () => {
        const req = new NextRequest("http://localhost:3000/api/rooms?mine=true");
        const res = await listRoomsHandler(req);
        expect(res.status).toBe(401);
      });
    });

    describe("POST /api/rooms/verify", () => {
      it("returns 400 when room code is missing", async () => {
        const req = new NextRequest("http://localhost:3000/api/rooms/verify", {
          method: "POST",
          body: JSON.stringify({}),
        });

        const res = await verifyRoomHandler(req);
        expect(res.status).toBe(400);
      });

      it("returns 404 when room code does not exist", async () => {
        const req = new NextRequest("http://localhost:3000/api/rooms/verify", {
          method: "POST",
          body: JSON.stringify({ code: "NONEXISTENT-111" }),
        });

        const res = await verifyRoomHandler(req);
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.valid).toBe(false);
      });

      it("verifies public room access with status 200", async () => {
        const room = await createRoom("Free Guild", null, testUser.id, db);

        const req = new NextRequest("http://localhost:3000/api/rooms/verify", {
          method: "POST",
          body: JSON.stringify({ code: room.code }),
        });

        const res = await verifyRoomHandler(req);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.valid).toBe(true);
        expect(json.room.id).toBe(room.id);
      });

      it("verifies password-protected room: 401 on wrong pass, 200 on correct pass", async () => {
        const room = await createRoom("Private Crypt", "cryptKey99", testUser.id, db);

        // Wrong password
        const wrongReq = new NextRequest("http://localhost:3000/api/rooms/verify", {
          method: "POST",
          body: JSON.stringify({ code: room.code, password: "wrong" }),
        });
        const wrongRes = await verifyRoomHandler(wrongReq);
        expect(wrongRes.status).toBe(401);
        const wrongJson = await wrongRes.json();
        expect(wrongJson.valid).toBe(false);

        // Correct password
        const okReq = new NextRequest("http://localhost:3000/api/rooms/verify", {
          method: "POST",
          body: JSON.stringify({ code: room.code, password: "cryptKey99" }),
        });
        const okRes = await verifyRoomHandler(okReq);
        expect(okRes.status).toBe(200);
        const okJson = await okRes.json();
        expect(okJson.valid).toBe(true);
        expect(okJson.room.id).toBe(room.id);
      });
    });

    describe("GET /api/rooms/[code]", () => {
      it("returns 404 for unknown room code", async () => {
        const req = new NextRequest("http://localhost:3000/api/rooms/UNKNOWN-999");
        const res = await getRoomHandler(req, { params: Promise.resolve({ code: "UNKNOWN-999" }) });
        expect(res.status).toBe(404);
      });

      it("returns room details and rolls history for existing room", async () => {
        const room = await createRoom("Castle Courtyard", null, testUser.id, db);

        const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}`);
        const res = await getRoomHandler(req, { params: Promise.resolve({ code: room.code }) });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.room).toBeDefined();
        expect(json.room.code).toBe(room.code);
        expect(Array.isArray(json.recentRolls)).toBe(true);
      });

      it("returns empty recentRolls for password-protected room when requesting user is unverified", async () => {
        const room = await createRoom("Dark Sanctuary", "secretPass", testUser.id, db);

        // Add a roll into the room
        db.prepare(`
          INSERT INTO dice_rolls (
            id, room_id, user_id, user_name, notation, dice_type, dice_count, modifier, individual_results, total, is_crit_hit, is_crit_fail, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          "roll-secret-1",
          room.id,
          testUser.id,
          testUser.name,
          "1d20",
          "d20",
          1,
          0,
          JSON.stringify([20]),
          20,
          1,
          0,
          "2026-09-08 20:00:00"
        );

        // Unverified guest request
        const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}`);
        const res = await getRoomHandler(req, { params: Promise.resolve({ code: room.code }) });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.room).toBeDefined();
        expect(json.room.hasPassword).toBe(true);
        expect(json.recentRolls).toEqual([]);
      });

      it("returns full recentRolls for password-protected room when requested by room creator", async () => {
        const room = await createRoom("DM Private Study", "dmPass123", testUser.id, db);

        db.prepare(`
          INSERT INTO dice_rolls (
            id, room_id, user_id, user_name, notation, dice_type, dice_count, modifier, individual_results, total, is_crit_hit, is_crit_fail, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          "roll-dm-1",
          room.id,
          testUser.id,
          testUser.name,
          "1d20",
          "d20",
          1,
          0,
          JSON.stringify([15]),
          15,
          0,
          0,
          "2026-09-08 20:00:00"
        );

        // Request with creator's auth token cookie
        const req = new NextRequest(`http://localhost:3000/api/rooms/${room.code}`, {
          headers: {
            cookie: `token=${authToken}`,
          },
        });
        const res = await getRoomHandler(req, { params: Promise.resolve({ code: room.code }) });
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.recentRolls).toHaveLength(1);
        expect(json.recentRolls[0].id).toBe("roll-dm-1");
      });

      it("returns full recentRolls for password-protected room with valid room access header or cookie", async () => {
        const room = await createRoom("Guild Archives", "guildPass", testUser.id, db);

        db.prepare(`
          INSERT INTO dice_rolls (
            id, room_id, user_id, user_name, notation, dice_type, dice_count, modifier, individual_results, total, is_crit_hit, is_crit_fail, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          "roll-guild-1",
          room.id,
          testUser.id,
          testUser.name,
          "1d12",
          "d12",
          1,
          0,
          JSON.stringify([10]),
          10,
          0,
          0,
          "2026-09-08 20:00:00"
        );

        // Request with x-room-access header
        const headerReq = new NextRequest(`http://localhost:3000/api/rooms/${room.code}`, {
          headers: {
            "x-room-access": "1",
          },
        });
        const headerRes = await getRoomHandler(headerReq, { params: Promise.resolve({ code: room.code }) });
        expect(headerRes.status).toBe(200);
        const headerJson = await headerRes.json();
        expect(headerJson.recentRolls).toHaveLength(1);

        // Request with room_access cookie
        const cookieReq = new NextRequest(`http://localhost:3000/api/rooms/${room.code}`, {
          headers: {
            cookie: `room_access_${room.code}=1`,
          },
        });
        const cookieRes = await getRoomHandler(cookieReq, { params: Promise.resolve({ code: room.code }) });
        expect(cookieRes.status).toBe(200);
        const cookieJson = await cookieRes.json();
        expect(cookieJson.recentRolls).toHaveLength(1);

        // Request with correct x-room-password header
        const passReq = new NextRequest(`http://localhost:3000/api/rooms/${room.code}`, {
          headers: {
            "x-room-password": "guildPass",
          },
        });
        const passRes = await getRoomHandler(passReq, { params: Promise.resolve({ code: room.code }) });
        expect(passRes.status).toBe(200);
        const passJson = await passRes.json();
        expect(passJson.recentRolls).toHaveLength(1);

        // Request with wrong x-room-password header
        const wrongPassReq = new NextRequest(`http://localhost:3000/api/rooms/${room.code}`, {
          headers: {
            "x-room-password": "wrongPassword",
          },
        });
        const wrongPassRes = await getRoomHandler(wrongPassReq, { params: Promise.resolve({ code: room.code }) });
        expect(wrongPassRes.status).toBe(200);
        const wrongPassJson = await wrongPassRes.json();
        expect(wrongPassJson.recentRolls).toEqual([]);
      });
    });
  });
});
