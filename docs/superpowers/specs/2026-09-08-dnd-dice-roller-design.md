# Design Spec: Real-Time D&D Dice Roller Web App

- **Date:** 2026-09-08
- **Project:** `tapb-dice-web-app`
- **Repository:** https://github.com/tapb-studio/tapb-dice-web-app.git
- **Stack:** Next.js (App Router), Node.js Custom Server, Socket.io, SQLite (`better-sqlite3`), Tailwind CSS, Three.js / Dice-box, Web Audio API

---

## 1. Overview & Goals
The goal is to build a collaborative real-time D&D dice rolling web application where users can:
1. Register and Login with Name, Username, and Password (persisted in SQLite).
2. Create rooms with optional/enforced room passwords and unique room codes.
3. Join rooms by entering the room code and password.
4. Roll standard D&D dice (`d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`) with quantities and modifiers (e.g. `2d6 + 3`, `1d20`).
5. Experience 3D physics dice rolls with synchronized Web Audio sound effects.
6. Observe roll results and rolling history in real-time across all players in the room via Socket.io.
7. Enjoy visual highlights for Critical Hits (Nat 20) and Critical Fails (Nat 1).

---

## 2. System Architecture

```
+-------------------------------------------------------------+
|               Node.js Custom Server (server.js)             |
|                                                             |
|  +---------------------------+  +------------------------+  |
|  |   Next.js App Router      |  |    Socket.io Server    |  |
|  |   - Auth & API Routes     |  |    - Room broadcasting |  |
|  |   - Server Actions / SSR  |  |    - Real-time events  |  |
|  +---------------------------+  +------------------------+  |
|                               |             |               |
|                               v             v               |
|              +----------------------------------+           |
|              |     SQLite (`better-sqlite3`)    |           |
|              |         (database/app.db)        |           |
|              +----------------------------------+           |
+-------------------------------------------------------------+
```

### Client Architecture
- **Pages / Routes:**
  - `/` or `/login`: Authentication page (Login & Register tabs)
  - `/lobby`: Room dashboard (Create room, Join room, Room list)
  - `/room/[roomId]`: Live interactive dice room with 3D canvas, control panel, active member list, and real-time roll log
- **3D Physics Dice Component:**
  - Embedded canvas rendering 3D polyhedral dice (d4, d6, d8, d10, d12, d20, d100)
  - Driven by `@3d-dice/dice-box` or Three.js / Cannon-es physics
  - Synchronized roll triggers via Socket.io events
- **Audio Effects:**
  - Procedural Web Audio API synth / audio generation for dice rattle, table impacts, and critical fanfare (zero dependency on missing audio assets)

---

## 3. Database Schema (SQLite)

Located at `database/app.db`.

### 3.1 `users` Table
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 `rooms` Table
```sql
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

### 3.3 `dice_rolls` Table
```sql
CREATE TABLE IF NOT EXISTS dice_rolls (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  notation TEXT NOT NULL,
  dice_type TEXT NOT NULL,
  dice_count INTEGER NOT NULL,
  modifier INTEGER NOT NULL DEFAULT 0,
  individual_results TEXT NOT NULL, -- JSON string e.g. "[18, 12]"
  total INTEGER NOT NULL,
  is_crit_hit INTEGER NOT NULL DEFAULT 0,  -- 1 for Nat 20
  is_crit_fail INTEGER NOT NULL DEFAULT 0, -- 1 for Nat 1
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 4. API Endpoints & Auth Specification

### 4.1 Authentication
- **POST `/api/auth/register`**
  - Body: `{ name, username, password }`
  - Validates input, hashes password with `bcryptjs` (salt rounds = 10).
  - Creates user in `users`.
  - Issues JWT cookie `token` (HTTP-only, Secure in production, SameSite=Lax).
  - Returns: `{ user: { id, name, username } }`.
- **POST `/api/auth/login`**
  - Body: `{ username, password }`
  - Compares bcrypt hash.
  - Sets JWT cookie on success.
  - Returns: `{ user: { id, name, username } }`.
- **GET `/api/auth/me`**
  - Reads JWT cookie, verifies and returns current user info.
- **POST `/api/auth/logout`**
  - Clears `token` cookie.

### 4.2 Room Management
- **POST `/api/rooms`**
  - Body: `{ name, password }`
  - Generates unique memorable slug/code (e.g. `DRAGON-849`).
  - Hashes room password if provided.
  - Returns: `{ room: { id, code, name, hasPassword } }`.
- **POST `/api/rooms/verify`**
  - Body: `{ code, password }`
  - Verifies room password. If valid, generates signed room access token cookie or returns room details.
- **GET `/api/rooms/[code]`**
  - Fetches room metadata and recent roll history (last 50 rolls).

---

## 5. Real-Time Socket.io Events

### 5.1 Client -> Server
1. `join_room`: `{ roomId, user }`
   - Server joins socket to `room:${roomId}`.
   - Updates active users map for the room.
   - Emits `room_users_updated` to all sockets in `room:${roomId}`.
2. `roll_dice`: `{ roomId, diceType, count, modifier }`
   - Server validates parameters (`count` between 1 and 20, valid `diceType` in `d4, d6, d8, d10, d12, d20, d100`).
   - Server securely generates random rolls:
     - For each die: `Math.floor(Math.random() * max) + 1`.
     - Calculates total = sum(individual) + modifier.
     - Detects `is_crit_hit` (if d20 and roll == 20) and `is_crit_fail` (if d20 and roll == 1).
   - Inserts record into `dice_rolls`.
   - Emits `dice_rolled` to all sockets in `room:${roomId}`.

### 5.2 Server -> Client
1. `room_users_updated`: `{ users: [{ id, name, username }] }`
2. `dice_rolled`:
   ```json
   {
     "id": "roll_123",
     "user": { "id": "user_1", "name": "Sonty" },
     "diceType": "d20",
     "count": 2,
     "modifier": 3,
     "notation": "2d20+3",
     "individualResults": [20, 14],
     "total": 37,
     "isCritHit": true,
     "isCritFail": false,
     "createdAt": "2026-09-08T15:00:00.000Z"
   }
   ```

---

## 6. UI/UX Design

- **Theme:** D&D Dark Fantasy aesthetic (Slate/Zinc dark backgrounds, Amber/Gold borders and highlights, Crimson failure highlights).
- **Audio Feedback:** Synthesized realistic dice rolls (clatter/rattle) using Web Audio API with a one-click mute/unmute control.
- **Responsiveness:** Fully mobile-friendly and desktop-optimized layout.

---

## 7. Error Handling & Security

- Passwords stored exclusively as `bcrypt` hashes.
- Sanitized SQL queries using parameterized statements via `better-sqlite3` to prevent SQL Injection.
- Server-side validation of dice parameters (clamp dice count to max 20 per roll, limit modifier range between -100 and +100).
- Automatic reconnection with exponential backoff in Socket.io client.
