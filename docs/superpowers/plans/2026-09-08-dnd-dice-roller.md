# D&D Real-Time Dice Roller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a collaborative real-time D&D dice rolling Next.js web application with SQLite authentication, room passwords/codes, 3D physics dice rolls, sound effects, and Socket.io live synchronization.

**Architecture:** A unified Node.js server (`server.js`) hosting Next.js App Router and Socket.io on a single port. Persistent storage handled by SQLite (`better-sqlite3`) with tables for users, rooms, and roll history. Client features a responsive D&D fantasy theme, Web Audio API sound effects, and interactive 3D dice physics canvas.

**Tech Stack:** Next.js 14+ (App Router), React 18/19, TypeScript, Tailwind CSS, Lucide React, Socket.io / Socket.io-client, better-sqlite3, bcryptjs, jsonwebtoken, Three.js, cannon-es, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-08-dnd-dice-roller-design.md`

## Global Constraints
- Node.js runtime version: v22+
- Persistent database path: `database/app.db`
- Authentication mechanism: HTTP-only secure Cookie with JWT and bcryptjs
- Dice types supported: `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100`
- Dice limits: Count 1-20, Modifier -100 to +100
- Audio implementation: Zero external media asset dependency (synthesized via Web Audio API)

---

### Task 1: Project Scaffolding, Core Dependencies & Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `tests/setup.ts`
- Test: `tests/sanity.test.ts`

**Interfaces:**
- Produces: Working Next.js project with TypeScript, Tailwind CSS, Vitest runner, and all base packages.

- [ ] **Step 1: Create package.json and install dependencies**

Install dependencies: `next`, `react`, `react-dom`, `better-sqlite3`, `bcryptjs`, `jsonwebtoken`, `socket.io`, `socket.io-client`, `lucide-react`, `three`, `cannon-es`, `clsx`, `tailwind-merge`.
DevDependencies: `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/better-sqlite3`, `@types/bcryptjs`, `@types/jsonwebtoken`, `@types/three`, `tailwindcss`, `postcss`, `autoprefixer`, `vitest`.

- [ ] **Step 2: Create configuration files**

Configure `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, and `vitest.config.ts`.

- [ ] **Step 3: Write sanity test**

Create `tests/sanity.test.ts` ensuring Vitest runs cleanly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sanity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs vitest.config.ts .gitignore tests/
git commit -m "chore: scaffold project structure and install dependencies"
```

---

### Task 2: SQLite Database Layer & Schema Initialization

**Files:**
- Create: `lib/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: `better-sqlite3`
- Produces: `getDb()` returning a configured SQLite connection with tables `users`, `rooms`, and `dice_rolls`.

- [ ] **Step 1: Write the failing test for SQLite initialization and schema tables**

Create `tests/db.test.ts` testing database connection, foreign keys enabled, and table creation (`users`, `rooms`, `dice_rolls`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db.test.ts`
Expected: FAIL with module not found `lib/db`

- [ ] **Step 3: Implement `lib/db.ts`**

Implement `getDb(dbPath?: string)` with automatic directory creation and schema migrations.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/db.ts tests/db.test.ts
git commit -m "feat(db): implement SQLite connection and schema migrations"
```

---

### Task 3: Authentication & Password Management

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/me/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `getDb` from `lib/db.ts`
- Produces:
  - `hashPassword(password: string): Promise<string>`
  - `verifyPassword(password: string, hash: string): Promise<boolean>`
  - `createToken(payload: object): string`
  - `verifyToken(token: string): object | null`
  - `registerUser(name: string, username: string, password: string): User`
  - `loginUser(username: string, password: string): { user: User, token: string }`
  - REST endpoints for register, login, me, and logout.

- [ ] **Step 1: Write failing tests for password hashing and user auth functions**

Create `tests/auth.test.ts` covering password hashing, duplicate username rejection, user creation, and JWT issuance/verification.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/auth.ts` and auth API route handlers**

Implement hashing, JWT signing, user creation, credentials verification, and cookie-based Next.js route handlers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts app/api/auth/ tests/auth.test.ts
git commit -m "feat(auth): implement user registration, login, and JWT session handling"
```

---

### Task 4: Room Management System

**Files:**
- Create: `lib/rooms.ts`
- Create: `app/api/rooms/route.ts`
- Create: `app/api/rooms/verify/route.ts`
- Create: `app/api/rooms/[code]/route.ts`
- Test: `tests/rooms.test.ts`

**Interfaces:**
- Consumes: `getDb` from `lib/db.ts`, `verifyToken` from `lib/auth.ts`
- Produces:
  - `createRoom(name: string, password: string | null, userId: string): Room`
  - `verifyRoomAccess(code: string, password: string | null): boolean`
  - `getRoomByCode(code: string): RoomWithHistory`
  - REST endpoints for room creation, password validation, and details retrieval.

- [ ] **Step 1: Write failing test for room creation and password verification**

Create `tests/rooms.test.ts` verifying unique room code generation, password hashing for private rooms, correct access checks, and roll history retrieval.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rooms.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/rooms.ts` and room API route handlers**

Create room logic with readable code generator (e.g. `DRAGON-849`), password verification, and history queries.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rooms.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/rooms.ts app/api/rooms/ tests/rooms.test.ts
git commit -m "feat(rooms): implement room creation, password verification, and history lookup"
```

---

### Task 5: Dice Logic & Real-Time Socket.io Server

**Files:**
- Create: `lib/dice.ts`
- Create: `server.js`
- Test: `tests/dice.test.ts`

**Interfaces:**
- Consumes: `getDb` from `lib/db.ts`
- Produces:
  - `calculateRoll(diceType: string, count: number, modifier: number): RollResult`
  - Node.js custom server (`server.js`) attaching Socket.io to HTTP server and bridging events (`join_room`, `roll_dice`, `dice_rolled`, `room_users_updated`).

- [ ] **Step 1: Write failing unit test for dice roll engine**

Create `tests/dice.test.ts` testing bounds for d4, d6, d8, d10, d12, d20, d100, modifier calculations, and Nat 20 / Nat 1 critical detection.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dice.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/dice.ts` and `server.js`**

Implement dice calculation and custom server with Socket.io room orchestration.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dice.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/dice.ts server.js tests/dice.test.ts
git commit -m "feat(dice): implement dice calculation engine and Socket.io server"
```

---

### Task 6: Procedural Web Audio Sound Engine

**Files:**
- Create: `lib/audio.ts`
- Test: `tests/audio.test.ts`

**Interfaces:**
- Produces:
  - `playDiceShakeSound()`: Rattling sound before throw
  - `playDiceHitSound()`: Clattering table collision sound
  - `playCritHitSound()`: Triumph fanfare chime for Nat 20
  - `playCritFailSound()`: Low impact thud for Nat 1
  - `toggleMute()` / `isMuted()`: Sound preference toggle

- [ ] **Step 1: Write unit tests for audio synthesizer state and triggers**

Create `tests/audio.test.ts` testing mute state toggles and synthesizer parameter calculations.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/audio.ts` using Web Audio API**

Implement oscillator/noise buffer nodes for realistic dice rattle, impact, and critical fanfares with SSR-safe checks (`typeof window !== 'undefined'`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/audio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/audio.ts tests/audio.test.ts
git commit -m "feat(audio): implement Web Audio API procedural dice sound effects"
```

---

### Task 7: 3D Physics Dice Canvas Component

**Files:**
- Create: `components/DiceCanvas.tsx`
- Create: `lib/dice-3d.ts` (Three.js geometry & physics setup for polyhedral dice d4, d6, d8, d10, d12, d20, d100)

**Interfaces:**
- Consumes: Three.js and Cannon-es
- Produces:
  - `<DiceCanvas rollTrigger={currentRoll} onRollComplete={...} />`
  - Renders 3D dice rolling, bouncing, and settling onto the dice tray.

- [ ] **Step 1: Implement 3D geometries and materials in `lib/dice-3d.ts`**

Define vertices, faces, and physics bodies for D&D polyhedral shapes:
- d4 (Tetrahedron)
- d6 (Box)
- d8 (Octahedron)
- d10 & d100 (Pentagonal Trapezohedron / Dodecahedron approximation)
- d12 (Dodecahedron)
- d20 (Icosahedron)

- [ ] **Step 2: Implement `components/DiceCanvas.tsx`**

Create responsive Three.js canvas with shadow map, lighting, physics simulation, and smooth camera angle.

- [ ] **Step 3: Commit**

```bash
git add lib/dice-3d.ts components/DiceCanvas.tsx
git commit -m "feat(3d): implement 3D physics dice canvas component"
```

---

### Task 8: Web UI Pages & Real-Time Collaborative Room

**Files:**
- Create: `app/globals.css`
- Create: `app/layout.tsx`
- Create: `app/page.tsx` (Login & Register page)
- Create: `app/lobby/page.tsx` (Lobby & Room Manager)
- Create: `app/room/[code]/page.tsx` (Interactive Room with 3D Canvas, Controls, and Live Feed)
- Create: `components/Navbar.tsx`
- Create: `components/DiceControls.tsx`
- Create: `components/RollHistory.tsx`
- Create: `components/RoomMembers.tsx`

**Interfaces:**
- Consumes: All previous APIs, `socket.io-client`, `lib/audio.ts`, `components/DiceCanvas.tsx`
- Produces: Complete end-to-end user experience.

- [ ] **Step 1: Implement global styles, layout, and Navbar**

Create dark fantasy theme with Tailwind in `app/globals.css`, `app/layout.tsx`, and `components/Navbar.tsx`.

- [ ] **Step 2: Implement Auth Page (`app/page.tsx`)**

Tabs for Login and Register with clear validation error handling.

- [ ] **Step 3: Implement Lobby Page (`app/lobby/page.tsx`)**

Lobby dashboard with Create Room modal (name + optional password), Join Room modal, and fast copy actions.

- [ ] **Step 4: Implement Room Page (`app/room/[code]/page.tsx`)**

Real-time room page integrating:
- Socket.io connection (`room:${roomId}`)
- 3D Dice Canvas in center
- Dice selector buttons (d4, d6, d8, d10, d12, d20, d100)
- Count & modifier adjusters
- Large Roll Dice button
- Right sidebar with real-time roll log and member list
- Audio mute toggle and Share/Copy room link button

- [ ] **Step 5: Commit**

```bash
git add app/ components/
git commit -m "feat(ui): implement responsive fantasy UI pages and real-time room experience"
```

---

### Task 9: Verification, Testing & GitHub Synchronization

**Files:**
- Create: `README.md`
- Modify: `package.json`

**Interfaces:**
- Produces: Clean build, all unit/integration tests passing, comprehensive documentation, and synchronized GitHub repository.

- [ ] **Step 1: Run all test suites**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 2: Build project for production**

Run: `npm run build`
Expected: Successful Next.js build with 0 errors.

- [ ] **Step 3: Create README.md with clear running instructions**

Document setup, running dev server (`npm run dev`), running tests (`npm test`), and deployment instructions.

- [ ] **Step 4: Final commit and verify git status**

```bash
git add README.md package.json
git commit -m "docs: add comprehensive README with instructions and architecture guide"
```
