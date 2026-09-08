import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { getDb, closeDb } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  registerUser,
  loginUser,
  getUserFromToken,
} from "@/lib/auth";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { GET as meHandler } from "@/app/api/auth/me/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";

const TEST_DB_PATH = path.resolve(process.cwd(), ".tmp/test-auth.db");

describe("Authentication & Password Management", () => {
  let db: ReturnType<typeof getDb>;

  beforeEach(() => {
    process.env.DATABASE_PATH = TEST_DB_PATH;
    process.env.JWT_SECRET = "test-jwt-secret-key";
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH, { force: true });
    }
    db = getDb(TEST_DB_PATH);
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

  describe("Password Hashing & Verification (lib/auth.ts)", () => {
    it("hashes a password using bcrypt and verifies it correctly", async () => {
      const password = "superSecretPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash).toMatch(/^\$2[aby]\$\d+\$/);

      const isMatch = await verifyPassword(password, hash);
      expect(isMatch).toBe(true);

      const isWrong = await verifyPassword("wrongPassword", hash);
      expect(isWrong).toBe(false);
    });

    it("produces unique hashes for the same password due to salting", async () => {
      const password = "myPassword";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe("JWT Token Creation & Verification (lib/auth.ts)", () => {
    it("creates a signed JWT token and verifies it", () => {
      const payload = { id: "user-123", username: "dungeon_master", name: "Dungeon Master" };
      const token = createToken(payload);

      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);

      const decoded = verifyToken(token);
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(payload.id);
      expect(decoded.username).toBe(payload.username);
      expect(decoded.name).toBe(payload.name);
    });

    it("returns null for invalid or malformed tokens", () => {
      expect(verifyToken("invalid.token.here")).toBeNull();
      expect(verifyToken("not-even-a-jwt")).toBeNull();
      expect(verifyToken("")).toBeNull();
    });

    it("throws an error in production environment if JWT_SECRET is unset", () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        delete process.env.JWT_SECRET;

        expect(() => createToken({ id: "user-1" })).toThrow(
          /JWT_SECRET must be set in production environment/i
        );
        expect(() => verifyToken("some.token.value")).toThrow(
          /JWT_SECRET must be set in production environment/i
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JWT_SECRET = "test-jwt-secret-key";
      }
    });
  });

  describe("User Registration (registerUser)", () => {
    it("registers a new user and returns user object omitting password_hash", async () => {
      const user = await registerUser("Geralt", "geralt_rivia", "silverSword123", db);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(user.name).toBe("Geralt");
      expect(user.username).toBe("geralt_rivia");
      expect(user.created_at).toBeDefined();
      expect((user as any).password_hash).toBeUndefined();

      // Verify stored in DB with hashed password
      const dbRow = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as any;
      expect(dbRow).toBeDefined();
      expect(dbRow.username).toBe("geralt_rivia");
      expect(dbRow.password_hash).toBeDefined();
      expect(await verifyPassword("silverSword123", dbRow.password_hash)).toBe(true);
    });

    it("rejects duplicate username registration", async () => {
      await registerUser("User One", "unique_name", "pass123", db);

      await expect(
        registerUser("User Two", "unique_name", "pass456", db)
      ).rejects.toThrow(/already exists|already taken|UNIQUE/i);
    });

    it("rejects registration with empty or invalid fields", async () => {
      await expect(registerUser("", "username", "pass", db)).rejects.toThrow();
      await expect(registerUser("Name", "", "pass", db)).rejects.toThrow();
      await expect(registerUser("Name", "username", "", db)).rejects.toThrow();
    });
  });

  describe("User Login (loginUser)", () => {
    it("successfully logs in with correct credentials and returns user and token", async () => {
      await registerUser("Yennefer", "yennefer", "lilac_and_gooseberries", db);

      const result = await loginUser("yennefer", "lilac_and_gooseberries", db);
      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe("yennefer");
      expect(result.user.name).toBe("Yennefer");
      expect((result.user as any).password_hash).toBeUndefined();

      expect(typeof result.token).toBe("string");
      const decoded = verifyToken(result.token);
      expect(decoded.username).toBe("yennefer");
      expect(decoded.id).toBe(result.user.id);
    });

    it("rejects login with non-existent username", async () => {
      await expect(loginUser("nonexistent", "password", db)).rejects.toThrow(
        /invalid username or password/i
      );
    });

    it("rejects login with incorrect password", async () => {
      await registerUser("Triss", "triss", "maribor123", db);

      await expect(loginUser("triss", "wrongPassword", db)).rejects.toThrow(
        /invalid username or password/i
      );
    });
  });

  describe("Get User from Token (getUserFromToken)", () => {
    it("returns user omitting password_hash when token is valid", async () => {
      const registered = await registerUser("Dandelion", "bard", "ballads123", db);
      const token = createToken({ id: registered.id, username: registered.username, name: registered.name });

      const user = getUserFromToken(token, db);
      expect(user).toBeDefined();
      expect(user?.id).toBe(registered.id);
      expect(user?.username).toBe("bard");
      expect(user?.name).toBe("Dandelion");
      expect((user as any)?.password_hash).toBeUndefined();
    });

    it("returns null when token is invalid or user not in db", () => {
      expect(getUserFromToken("invalid-token", db)).toBeNull();

      const nonExistentToken = createToken({ id: "non-existent-uuid", username: "ghost" });
      expect(getUserFromToken(nonExistentToken, db)).toBeNull();
    });
  });

  describe("API Route Handlers", () => {
    it("POST /api/auth/register creates user and sets auth cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "Vesemir",
          username: "vesemir",
          password: "witcherMaster123",
        }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.user).toBeDefined();
      expect(json.user.username).toBe("vesemir");
      expect(json.user.name).toBe("Vesemir");
      expect(json.user.password_hash).toBeUndefined();

      const cookie = res.cookies.get("token");
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBeTruthy();
      expect(cookie?.httpOnly).toBe(true);
    });

    it("POST /api/auth/register rejects missing fields, malformed body, and duplicates", async () => {
      // Missing fields
      const badReq = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: "Incomplete" }),
      });
      const badRes = await registerHandler(badReq);
      expect(badRes.status).toBe(400);

      // Malformed body
      const malformedReq = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        body: "{malformed json",
      });
      const malformedRes = await registerHandler(malformedReq);
      expect(malformedRes.status).toBe(400);

      // Register first
      const req1 = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: "Ciri", username: "ciri", password: "elderBlood123" }),
      });
      await registerHandler(req1);

      // Duplicate registration
      const req2 = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: "Ciri Duplicate", username: "ciri", password: "password" }),
      });
      const res2 = await registerHandler(req2);
      expect(res2.status).toBeGreaterThanOrEqual(400);
      const json = await res2.json();
      expect(json.error).toBeDefined();
    });

    it("POST /api/auth/login validates credentials and sets auth cookie", async () => {
      await registerUser("Zoltan", "zoltan", "chivay123", db);

      // Wrong password
      const wrongReq = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "zoltan", password: "wrong" }),
      });
      const wrongRes = await loginHandler(wrongReq);
      expect(wrongRes.status).toBe(401);

      // Correct password
      const okReq = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "zoltan", password: "chivay123" }),
      });
      const okRes = await loginHandler(okReq);
      expect(okRes.status).toBe(200);

      const json = await okRes.json();
      expect(json.user).toBeDefined();
      expect(json.user.username).toBe("zoltan");

      const cookie = okRes.cookies.get("token");
      expect(cookie).toBeDefined();
      expect(cookie?.value).toBeTruthy();
      expect(cookie?.httpOnly).toBe(true);
    });

    it("POST /api/auth/login differentiates 400 Bad Request from 401 Unauthorized", async () => {
      await registerUser("Eskel", "eskel", "wolfSchool123", db);

      // Missing username -> 400
      const noUserReq = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password: "wolfSchool123" }),
      });
      const noUserRes = await loginHandler(noUserReq);
      expect(noUserRes.status).toBe(400);

      // Missing password -> 400
      const noPassReq = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "eskel" }),
      });
      const noPassRes = await loginHandler(noPassReq);
      expect(noPassRes.status).toBe(400);

      // Malformed JSON -> 400
      const malformedReq = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: "{not valid json",
      });
      const malformedRes = await loginHandler(malformedReq);
      expect(malformedRes.status).toBe(400);

      // Invalid credentials -> 401
      const wrongReq = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "eskel", password: "wrongPassword" }),
      });
      const wrongRes = await loginHandler(wrongReq);
      expect(wrongRes.status).toBe(401);
    });

    it("GET /api/auth/me returns current user or 401 unauthorized", async () => {
      const registered = await registerUser("Regis", "regis", "vampire123", db);
      const token = createToken({ id: registered.id, username: registered.username, name: registered.name });

      // Unauthenticated request
      const noAuthReq = new NextRequest("http://localhost:3000/api/auth/me");
      const noAuthRes = await meHandler(noAuthReq);
      expect(noAuthRes.status).toBe(401);

      // Authenticated request with cookie
      const authReq = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: {
          cookie: `token=${token}`,
        },
      });
      const authRes = await meHandler(authReq);
      expect(authRes.status).toBe(200);

      const json = await authRes.json();
      expect(json.user).toBeDefined();
      expect(json.user.username).toBe("regis");
      expect(json.user.name).toBe("Regis");
      expect(json.user.password_hash).toBeUndefined();
    });

    it("POST /api/auth/logout clears the auth cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
      });
      const res = await logoutHandler(req);
      expect(res.status).toBe(200);

      const cookie = res.cookies.get("token");
      expect(cookie).toBeDefined();
      // Cookie is cleared when value is empty and/or maxAge is 0 or expires in past
      expect(cookie?.value === "" || (cookie as any)?.maxAge === 0).toBe(true);
    });
  });
});
