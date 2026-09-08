import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import http from "http";
import { AddressInfo } from "net";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { getDb, closeDb } from "@/lib/db";
import { registerUser } from "@/lib/auth";
import { createRoom } from "@/lib/rooms";
import {
  calculateRoll,
  saveRollToDb,
  parseDiceNotation,
  VALID_DICE_TYPES,
  DICE_MAX_VALUES,
  RollResult,
} from "@/lib/dice";
import { initSocketServer } from "../server.js";

const TEST_DB_PATH = path.resolve(process.cwd(), ".tmp/test-dice.db");

describe("Dice Logic & Real-Time Socket.io Server (Task 5)", () => {
  let db: ReturnType<typeof getDb>;
  let testUser: { id: string; name: string; username: string };
  let testRoom: { id: string; name: string; code: string };

  beforeEach(async () => {
    process.env.DATABASE_PATH = TEST_DB_PATH;
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH, { force: true });
    }
    db = getDb();
    testUser = await registerUser("Gimli", "gimli_axe", "barukKhazad123", db);
    testRoom = await createRoom("Moria Chamber", null, testUser.id, db);
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
  });

  describe("Dice Calculation Engine (calculateRoll)", () => {
    it("supports all standard D&D dice types (d4, d6, d8, d10, d12, d20, d100)", () => {
      expect(VALID_DICE_TYPES).toEqual(["d4", "d6", "d8", "d10", "d12", "d20", "d100"]);

      for (const diceType of VALID_DICE_TYPES) {
        const max = DICE_MAX_VALUES[diceType];
        for (let i = 0; i < 30; i++) {
          const result = calculateRoll(diceType, 1, 0);
          expect(result.diceType).toBe(diceType);
          expect(result.count).toBe(1);
          expect(result.modifier).toBe(0);
          expect(result.individualResults).toHaveLength(1);
          expect(result.individualResults[0]).toBeGreaterThanOrEqual(1);
          expect(result.individualResults[0]).toBeLessThanOrEqual(max);
          expect(result.subtotal).toBe(result.individualResults[0]);
          expect(result.total).toBe(result.subtotal);
        }
      }
    });

    it("defaults count to 1 and modifier to 0 if omitted", () => {
      const result = calculateRoll("d20");
      expect(result.count).toBe(1);
      expect(result.modifier).toBe(0);
      expect(result.individualResults).toHaveLength(1);
      expect(result.notation).toBe("1d20");
    });

    it("handles multiple dice up to count 20", () => {
      const count = 5;
      const result = calculateRoll("d6", count, 0);
      expect(result.count).toBe(5);
      expect(result.individualResults).toHaveLength(5);
      for (const val of result.individualResults) {
        expect(val).toBeGreaterThanOrEqual(1);
        expect(val).toBeLessThanOrEqual(6);
      }
      const expectedSubtotal = result.individualResults.reduce((a, b) => a + b, 0);
      expect(result.subtotal).toBe(expectedSubtotal);
      expect(result.total).toBe(expectedSubtotal);
      expect(result.notation).toBe("5d6");
    });

    it("applies positive modifiers correctly", () => {
      const result = calculateRoll("d8", 2, 4);
      expect(result.modifier).toBe(4);
      expect(result.total).toBe(result.subtotal + 4);
      expect(result.notation).toBe("2d8+4");
    });

    it("applies negative modifiers correctly", () => {
      const result = calculateRoll("d20", 1, -3);
      expect(result.modifier).toBe(-3);
      expect(result.total).toBe(result.subtotal - 3);
      expect(result.notation).toBe("1d20-3");
    });

    it("detects Critical Hit (Nat 20) on d20", () => {
      // Mock RNG that yields 1.0 (rolls 20)
      const mockRng = () => 0.999;
      const result = calculateRoll("d20", 1, 0, mockRng);
      expect(result.individualResults).toEqual([20]);
      expect(result.isCritHit).toBe(true);
      expect(result.isCritFail).toBe(false);
    });

    it("detects Critical Fail (Nat 1) on d20", () => {
      // Mock RNG that yields 0.0 (rolls 1)
      const mockRng = () => 0.0;
      const result = calculateRoll("d20", 1, 0, mockRng);
      expect(result.individualResults).toEqual([1]);
      expect(result.isCritHit).toBe(false);
      expect(result.isCritFail).toBe(true);
    });

    it("detects normal non-crit rolls on d20", () => {
      // Mock RNG that yields ~0.5 (rolls 10)
      const mockRng = () => 0.45;
      const result = calculateRoll("d20", 1, 5, mockRng);
      expect(result.individualResults).toEqual([10]);
      expect(result.isCritHit).toBe(false);
      expect(result.isCritFail).toBe(false);
      expect(result.total).toBe(15);
    });

    it("gives Nat 20 priority when both 20 and 1 appear on multi-dice d20 rolls", () => {
      let callCount = 0;
      const mockRng = () => {
        callCount++;
        return callCount === 1 ? 0.999 : 0.0;
      };
      const result = calculateRoll("d20", 2, 0, mockRng);
      expect(result.individualResults).toEqual([20, 1]);
      expect(result.isCritHit).toBe(true);
      expect(result.isCritFail).toBe(false);
    });

    it("does NOT trigger crit hit or crit fail for non-d20 dice", () => {
      // d100 rolling 100 or 1
      const maxRng = () => 0.999;
      const minRng = () => 0.0;

      const d100Max = calculateRoll("d100", 1, 0, maxRng);
      expect(d100Max.individualResults).toEqual([100]);
      expect(d100Max.isCritHit).toBe(false);
      expect(d100Max.isCritFail).toBe(false);

      const d100Min = calculateRoll("d100", 1, 0, minRng);
      expect(d100Min.individualResults).toEqual([1]);
      expect(d100Min.isCritHit).toBe(false);
      expect(d100Min.isCritFail).toBe(false);

      const d6Max = calculateRoll("d6", 1, 0, maxRng);
      expect(d6Max.individualResults).toEqual([6]);
      expect(d6Max.isCritHit).toBe(false);
      expect(d6Max.isCritFail).toBe(false);
    });

    it("rejects invalid dice types", () => {
      expect(() => calculateRoll("d7", 1, 0)).toThrow(/invalid dice type/i);
      expect(() => calculateRoll("d3", 1, 0)).toThrow(/invalid dice type/i);
      expect(() => calculateRoll("d50", 1, 0)).toThrow(/invalid dice type/i);
      expect(() => calculateRoll("", 1, 0)).toThrow(/invalid dice type/i);
    });

    it("rejects dice count outside 1..20 range", () => {
      expect(() => calculateRoll("d20", 0, 0)).toThrow(/count must be/i);
      expect(() => calculateRoll("d20", -1, 0)).toThrow(/count must be/i);
      expect(() => calculateRoll("d20", 21, 0)).toThrow(/count must be/i);
      expect(() => calculateRoll("d20", 1.5, 0)).toThrow(/count must be/i);
    });

    it("rejects modifier outside -100..100 range", () => {
      expect(() => calculateRoll("d20", 1, -101)).toThrow(/modifier must be/i);
      expect(() => calculateRoll("d20", 1, 101)).toThrow(/modifier must be/i);
      expect(() => calculateRoll("d20", 1, 2.5)).toThrow(/modifier must be/i);
    });
  });

  describe("Dice Notation Parser (parseDiceNotation)", () => {
    it("parses valid standard notations", () => {
      expect(parseDiceNotation("2d20+5")).toEqual({ count: 2, diceType: "d20", modifier: 5 });
      expect(parseDiceNotation("1d6")).toEqual({ count: 1, diceType: "d6", modifier: 0 });
      expect(parseDiceNotation("d20")).toEqual({ count: 1, diceType: "d20", modifier: 0 });
      expect(parseDiceNotation("3d8-2")).toEqual({ count: 3, diceType: "d8", modifier: -2 });
      expect(parseDiceNotation("1d100+10")).toEqual({ count: 1, diceType: "d100", modifier: 10 });
    });

    it("throws error for malformed dice notations", () => {
      expect(() => parseDiceNotation("invalid")).toThrow(/invalid dice notation/i);
      expect(() => parseDiceNotation("2d")).toThrow(/invalid dice notation/i);
      expect(() => parseDiceNotation("d")).toThrow(/invalid dice notation/i);
      expect(() => parseDiceNotation("2d20+abc")).toThrow(/invalid dice notation/i);
      expect(() => parseDiceNotation("2d7+3")).toThrow(/unsupported dice type/i);
    });
  });

  describe("Database Persistence (saveRollToDb)", () => {
    it("persists a roll to SQLite and returns the saved object", () => {
      const roll = calculateRoll("d20", 2, 3, () => 0.999);
      const saved = saveRollToDb(
        testRoom.id,
        { id: testUser.id, name: testUser.name, username: testUser.username },
        roll,
        db
      );

      expect(saved).toBeDefined();
      expect(saved.id).toBeDefined();
      expect(saved.roomId).toBe(testRoom.id);
      expect(saved.user.id).toBe(testUser.id);
      expect(saved.user.name).toBe(testUser.name);
      expect(saved.diceType).toBe("d20");
      expect(saved.count).toBe(2);
      expect(saved.modifier).toBe(3);
      expect(saved.notation).toBe("2d20+3");
      expect(saved.individualResults).toEqual([20, 20]);
      expect(saved.total).toBe(43);
      expect(saved.isCritHit).toBe(true);
      expect(saved.isCritFail).toBe(false);
      expect(saved.createdAt).toBeDefined();

      // Verify row in database
      const row = db.prepare("SELECT * FROM dice_rolls WHERE id = ?").get(saved.id) as any;
      expect(row).toBeDefined();
      expect(row.room_id).toBe(testRoom.id);
      expect(row.user_id).toBe(testUser.id);
      expect(row.user_name).toBe(testUser.name);
      expect(row.notation).toBe("2d20+3");
      expect(row.dice_type).toBe("d20");
      expect(row.dice_count).toBe(2);
      expect(row.modifier).toBe(3);
      expect(JSON.parse(row.individual_results)).toEqual([20, 20]);
      expect(row.total).toBe(43);
      expect(row.is_crit_hit).toBe(1);
      expect(row.is_crit_fail).toBe(0);
    });

    it("rejects roll if roomId or user is missing", () => {
      const roll = calculateRoll("d6", 1, 0);
      expect(() => saveRollToDb("", { id: testUser.id, name: testUser.name }, roll, db)).toThrow(
        /room id is required/i
      );
      expect(() => saveRollToDb(testRoom.id, null as any, roll, db)).toThrow(/user with id and name is required/i);
      expect(() => saveRollToDb(testRoom.id, { id: "", name: "" } as any, roll, db)).toThrow(
        /user with id and name is required/i
      );
    });

    it("enforces foreign key constraints for non-existent roomId or userId", () => {
      const roll = calculateRoll("d6", 1, 0);
      expect(() =>
        saveRollToDb("non-existent-room", { id: testUser.id, name: testUser.name }, roll, db)
      ).toThrow(/foreign key/i);

      expect(() =>
        saveRollToDb(testRoom.id, { id: "non-existent-user", name: "Ghost" }, roll, db)
      ).toThrow(/foreign key/i);
    });
  });

  describe("Real-Time Socket.io Server (server.js)", () => {
    let httpServer: http.Server;
    let ioServer: any;
    let serverPort: number;
    let clientSocket1: ClientSocket;
    let clientSocket2: ClientSocket;

    beforeEach(async () => {
      // Create HTTP server and attach Socket.io
      httpServer = http.createServer();
      ioServer = initSocketServer(httpServer, { calculateRoll, saveRollToDb });

      await new Promise<void>((resolve) => {
        httpServer.listen(0, () => {
          const addr = httpServer.address() as AddressInfo;
          serverPort = addr.port;
          resolve();
        });
      });
    });

    afterEach(async () => {
      if (clientSocket1 && clientSocket1.connected) {
        clientSocket1.disconnect();
      }
      if (clientSocket2 && clientSocket2.connected) {
        clientSocket2.disconnect();
      }
      if (ioServer) {
        await new Promise<void>((resolve) => {
          ioServer.close(() => resolve());
        });
      }
      if (httpServer && httpServer.listening) {
        await new Promise<void>((resolve) => {
          httpServer.close(() => resolve());
        });
      }
    });

    it("allows client to connect and join a room, broadcasting room_users_updated", async () => {
      clientSocket1 = ioc(`http://localhost:${serverPort}`, {
        transports: ["websocket"],
      });

      await new Promise<void>((resolve) => {
        clientSocket1.on("connect", resolve);
      });

      const usersUpdatedPromise = new Promise<{ users: any[] }>((resolve) => {
        clientSocket1.on("room_users_updated", (data) => {
          resolve(data);
        });
      });

      clientSocket1.emit("join_room", {
        roomId: testRoom.id,
        user: { id: testUser.id, name: testUser.name, username: testUser.username },
      });

      const updatedData = await usersUpdatedPromise;
      expect(updatedData.users).toHaveLength(1);
      expect(updatedData.users[0].id).toBe(testUser.id);
      expect(updatedData.users[0].name).toBe(testUser.name);
    });

    it("tracks multiple clients in the same room and updates user list", async () => {
      const secondUser = await registerUser("Legolas", "legolas_wood", "bowAndArrow99", db);

      clientSocket1 = ioc(`http://localhost:${serverPort}`, { transports: ["websocket"] });
      clientSocket2 = ioc(`http://localhost:${serverPort}`, { transports: ["websocket"] });

      await Promise.all([
        new Promise<void>((res) => clientSocket1.on("connect", res)),
        new Promise<void>((res) => clientSocket2.on("connect", res)),
      ]);

      // Client 1 joins
      clientSocket1.emit("join_room", {
        roomId: testRoom.id,
        user: { id: testUser.id, name: testUser.name, username: testUser.username },
      });

      // Wait for Client 1 to receive initial update
      await new Promise<void>((res) => {
        clientSocket1.once("room_users_updated", () => res());
      });

      // Prepare listeners for both clients when Client 2 joins
      const client1ReceivedPromise = new Promise<{ users: any[] }>((res) => {
        clientSocket1.once("room_users_updated", res);
      });
      const client2ReceivedPromise = new Promise<{ users: any[] }>((res) => {
        clientSocket2.once("room_users_updated", res);
      });

      clientSocket2.emit("join_room", {
        roomId: testRoom.id,
        user: { id: secondUser.id, name: secondUser.name, username: secondUser.username },
      });

      const [res1, res2] = await Promise.all([client1ReceivedPromise, client2ReceivedPromise]);

      expect(res1.users).toHaveLength(2);
      expect(res2.users).toHaveLength(2);
      expect(res1.users.map((u: any) => u.id).sort()).toEqual([testUser.id, secondUser.id].sort());
    });

    it("handles roll_dice, saves to database, and broadcasts dice_rolled to all in room", async () => {
      const secondUser = await registerUser("Aragorn", "strider", "andurilFlame1", db);

      clientSocket1 = ioc(`http://localhost:${serverPort}`, { transports: ["websocket"] });
      clientSocket2 = ioc(`http://localhost:${serverPort}`, { transports: ["websocket"] });

      await Promise.all([
        new Promise<void>((res) => clientSocket1.on("connect", res)),
        new Promise<void>((res) => clientSocket2.on("connect", res)),
      ]);

      clientSocket1.emit("join_room", {
        roomId: testRoom.id,
        user: { id: testUser.id, name: testUser.name, username: testUser.username },
      });
      clientSocket2.emit("join_room", {
        roomId: testRoom.id,
        user: { id: secondUser.id, name: secondUser.name, username: secondUser.username },
      });

      await Promise.all([
        new Promise<void>((res) => clientSocket1.once("room_users_updated", () => res())),
        new Promise<void>((res) => clientSocket2.once("room_users_updated", () => res())),
      ]);

      // Set up listeners for dice_rolled event
      const client1RollPromise = new Promise<any>((res) => {
        clientSocket1.on("dice_rolled", res);
      });
      const client2RollPromise = new Promise<any>((res) => {
        clientSocket2.on("dice_rolled", res);
      });

      // Client 1 rolls dice
      clientSocket1.emit("roll_dice", {
        roomId: testRoom.id,
        diceType: "d20",
        count: 2,
        modifier: 3,
        user: { id: testUser.id, name: testUser.name, username: testUser.username },
      });

      const [roll1, roll2] = await Promise.all([client1RollPromise, client2RollPromise]);

      expect(roll1).toBeDefined();
      expect(roll2).toBeDefined();
      expect(roll1.id).toBe(roll2.id);
      expect(roll1.roomId).toBe(testRoom.id);
      expect(roll1.user.id).toBe(testUser.id);
      expect(roll1.user.name).toBe(testUser.name);
      expect(roll1.diceType).toBe("d20");
      expect(roll1.count).toBe(2);
      expect(roll1.modifier).toBe(3);
      expect(roll1.notation).toBe("2d20+3");
      expect(roll1.individualResults).toHaveLength(2);
      expect(roll1.total).toBe(roll1.individualResults[0] + roll1.individualResults[1] + 3);
      expect(typeof roll1.isCritHit).toBe("boolean");
      expect(typeof roll1.isCritFail).toBe("boolean");
      expect(roll1.createdAt).toBeDefined();

      // Check that it was persisted in SQLite
      const row = db.prepare("SELECT * FROM dice_rolls WHERE id = ?").get(roll1.id) as any;
      expect(row).toBeDefined();
      expect(row.room_id).toBe(testRoom.id);
      expect(row.user_name).toBe(testUser.name);
      expect(row.total).toBe(roll1.total);
    });

    it("emits error when roll_dice receives invalid parameters", async () => {
      clientSocket1 = ioc(`http://localhost:${serverPort}`, { transports: ["websocket"] });
      await new Promise<void>((res) => clientSocket1.on("connect", res));

      clientSocket1.emit("join_room", {
        roomId: testRoom.id,
        user: { id: testUser.id, name: testUser.name },
      });

      const errorPromise = new Promise<{ error: string }>((resolve) => {
        clientSocket1.on("error", resolve);
      });

      clientSocket1.emit("roll_dice", {
        roomId: testRoom.id,
        diceType: "d999",
        count: 1,
        modifier: 0,
        user: { id: testUser.id, name: testUser.name },
      });

      const errorData = await errorPromise;
      expect(errorData.error).toMatch(/invalid dice type/i);
    });

    it("rejects roll_dice if socket has not joined the room", async () => {
      clientSocket1 = ioc(`http://localhost:${serverPort}`, { transports: ["websocket"] });
      await new Promise<void>((res) => clientSocket1.on("connect", res));

      const errorPromise = new Promise<{ error: string }>((resolve) => {
        clientSocket1.on("error", resolve);
      });

      // Attempt to roll without join_room
      clientSocket1.emit("roll_dice", {
        roomId: testRoom.id,
        diceType: "d20",
        count: 1,
        modifier: 0,
      });

      const errorData = await errorPromise;
      expect(errorData.error).toMatch(/must join the room before rolling/i);
    });

    it("derives rolling user identity from room membership rather than unverified payload", async () => {
      clientSocket1 = ioc(`http://localhost:${serverPort}`, { transports: ["websocket"] });
      await new Promise<void>((res) => clientSocket1.on("connect", res));

      // Join room as testUser (Gimli)
      clientSocket1.emit("join_room", {
        roomId: testRoom.id,
        user: { id: testUser.id, name: testUser.name, username: testUser.username },
      });

      await new Promise<void>((res) => clientSocket1.once("room_users_updated", () => res()));

      const rollPromise = new Promise<any>((res) => {
        clientSocket1.on("dice_rolled", res);
      });

      // Try spoofing user in roll_dice payload as Sauron
      clientSocket1.emit("roll_dice", {
        roomId: testRoom.id,
        diceType: "d6",
        count: 1,
        modifier: 0,
        user: { id: "spoofed-id", name: "Sauron", username: "dark_lord" },
      });

      const rollData = await rollPromise;
      // Must use verified user from room membership
      expect(rollData.user.id).toBe(testUser.id);
      expect(rollData.user.name).toBe(testUser.name);
    });

    it("cleans up user and broadcasts room_users_updated on leave_room and disconnect", async () => {
      const secondUser = await registerUser("Frodo", "frodo_baggins", "ringBearer1", db);

      clientSocket1 = ioc(`http://localhost:${serverPort}`, { transports: ["websocket"] });
      clientSocket2 = ioc(`http://localhost:${serverPort}`, { transports: ["websocket"] });

      await Promise.all([
        new Promise<void>((res) => clientSocket1.on("connect", res)),
        new Promise<void>((res) => clientSocket2.on("connect", res)),
      ]);

      clientSocket1.emit("join_room", {
        roomId: testRoom.id,
        user: { id: testUser.id, name: testUser.name },
      });
      clientSocket2.emit("join_room", {
        roomId: testRoom.id,
        user: { id: secondUser.id, name: secondUser.name },
      });

      // Wait until client1 sees 2 users
      await new Promise<void>((resolve) => {
        const handler = (data: { users: any[] }) => {
          if (data.users.length === 2) {
            clientSocket1.off("room_users_updated", handler);
            resolve();
          }
        };
        clientSocket1.on("room_users_updated", handler);
      });

      // Client 2 leaves the room
      const client1LeaveUpdate = new Promise<{ users: any[] }>((resolve) => {
        clientSocket1.once("room_users_updated", resolve);
      });

      clientSocket2.emit("leave_room", { roomId: testRoom.id });

      const afterLeave = await client1LeaveUpdate;
      expect(afterLeave.users).toHaveLength(1);
      expect(afterLeave.users[0].id).toBe(testUser.id);

      // Now client 2 joins again, then disconnects
      clientSocket2.emit("join_room", {
        roomId: testRoom.id,
        user: { id: secondUser.id, name: secondUser.name },
      });

      // Wait until client1 sees 2 users again
      await new Promise<void>((resolve) => {
        const handler = (data: { users: any[] }) => {
          if (data.users.length === 2) {
            clientSocket1.off("room_users_updated", handler);
            resolve();
          }
        };
        clientSocket1.on("room_users_updated", handler);
      });

      // Client 2 disconnects socket
      const client1DisconnectUpdate = new Promise<{ users: any[] }>((resolve) => {
        clientSocket1.once("room_users_updated", resolve);
      });

      clientSocket2.disconnect();

      const afterDisconnect = await client1DisconnectUpdate;
      expect(afterDisconnect.users).toHaveLength(1);
      expect(afterDisconnect.users[0].id).toBe(testUser.id);
    });
  });
});
