# TAPB Dice Web App 🎲⚔️

**A Real-Time Collaborative 3D D&D Polyhedral Dice Roller**

TAPB Dice Web App is a modern, dark-fantasy tabletop web application built for Dungeons & Dragons (D&D) adventuring parties and tabletop roleplaying game (TTRPG) players. It combines a realistic 3D dice tray driven by physics simulation, procedural Web Audio sound design, and ultra-low latency multiplayer synchronization via WebSockets.

---

## 🌟 Key Features

- **🛡️ Secure User Authentication & Character Identity**:
  - SQLite database storage with salted `bcrypt` password hashing.
  - Stateless JSON Web Token (JWT) session tokens delivered via secure, HTTP-only cookies.
  - Adventurer registration and login portal with instant session validation and redirection.

- **🏰 Private & Public Chambers (Rooms)**:
  - Create custom adventuring chambers with unique 8-character human-friendly room codes (e.g., `DRAGON-849`).
  - Optional chamber password protection with salted bcrypt hashing.
  - Automatic owner access bypass and session-cached authentication (`sessionStorage`).
  - One-click shareable room links with instant clipboard copying.
  - Real-time active chamber roster tracking connected adventurers with live online indicators.

- **🎲 Full Polyhedral Dice Set**:
  - Complete standard D&D polyhedral dice collection: **d4**, **d6**, **d8**, **d10**, **d12**, **d20**, and **d100** (percentile dice).
  - Geometrically accurate convex polyhedron 3D meshes (tetrahedron, hexahedron, octahedron, pentagonal trapezohedron, dodecahedron, icosahedron).
  - High-visibility custom color palettes mapped per die type with distinct face numbering.

- **🔢 Multi-Dice & Dynamic Modifiers**:
  - Roll between 1 and 20 dice simultaneously.
  - Apply custom bonuses or penalties from -100 to +100.
  - Full standard D&D dice notation formatting (e.g., `1d20+5`, `4d6-2`, `2d100`).
  - Cryptographically strong random number generation (`crypto.randomInt`).

- **⚡ Realistic 3D Cannon-es Physics**:
  - Interactive Three.js WebGL viewport integrated with Cannon-es rigid-body physics.
  - Dice tray with solid floor and boundary walls preventing dice from falling off the table.
  - Dynamic linear impulses and randomized angular torque for natural rolling motion and realistic bounces.

- **🔊 Zero-Dependency Procedural Web Audio FX**:
  - Pure Web Audio API procedural sound synthesis without external audio files or MP3 assets.
  - Authentic dice shaker rattling sound synthesized via modulated bandpass white noise.
  - Crisp table impact clatter sound with frequency decay on landing.
  - Ascending triumphant arpeggio chime fanfare (C5-E5-G5-C6) on a **Natural 20**.
  - Descending low-frequency thud impact on a **Natural 1**.
  - Global audio mute toggle button accessible from the navigation bar.

- **🏆 Critical 20 & Critical 1 Celebrations**:
  - Instant recognition of Natural 20 (Critical Hit) and Natural 1 (Critical Failure) on d20 rolls.
  - Radiant golden aura badges with victory icons for crits.
  - Dark crimson badges with warning icons for critical failures.
  - Coordinated sound effects broadcast synchronously to all party members.

- **📜 Live Chronicle (Roll History)**:
  - Real-time persistent roll history log per room.
  - Displays adventurer name, timestamp, standard notation, individual dice breakdown, and grand total.
  - Live broadcast to all room members via Socket.io channels.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Framework & Frontend** | [Next.js 14](https://nextjs.org/) (App Router), [React 18](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) |
| **3D Engine & Physics** | [Three.js](https://threejs.org/) (WebGL rendering), [Cannon-es](https://github.com/pmndrs/cannon-es) (Rigid-body physics) |
| **Audio Engine** | Procedural Web Audio API synthesis (zero external audio dependencies) |
| **Real-Time Communication**| [Socket.io](https://socket.io/) (bidirectional WebSocket broadcasting) |
| **Server Architecture** | Node.js Custom HTTP server (`server.js`) integrating Next.js + Socket.io |
| **Database & Storage** | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) with Write-Ahead Logging (WAL) |
| **Authentication** | `bcryptjs` for password hashing, `jsonwebtoken` for secure JWT cookies |
| **Testing & Quality** | [Vitest](https://vitest.dev/) (Unit & Integration tests), TypeScript 5.7 (strict typing) |

---

## 📁 Project Structure

```
tapb-dice-web-app/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts      # POST: User login & JWT cookie issuance
│   │   │   ├── logout/route.ts     # POST: Session clearance
│   │   │   ├── me/route.ts         # GET: Session user inspection
│   │   │   └── register/route.ts   # POST: New user registration
│   │   └── rooms/
│   │       ├── [code]/route.ts     # GET: Room details & roll history
│   │       ├── route.ts            # GET: Public rooms list, POST: Create room
│   │       └── verify/route.ts     # POST: Verify room password
│   ├── lobby/
│   │   └── page.tsx                # Chamber lobby, room creation & discovery
│   ├── room/
│   │   └── [code]/page.tsx         # Real-time 3D multiplayer rolling chamber
│   ├── globals.css                 # Dark fantasy theme styles & animations
│   ├── layout.tsx                  # Root layout with dark mode metadata
│   └── page.tsx                    # Landing auth portal (login / register)
├── components/
│   ├── DiceCanvas.tsx              # Three.js + Cannon-es 3D physics dice tray
│   ├── DiceControls.tsx            # Polyhedral dice picker, count & modifier controls
│   ├── Navbar.tsx                  # App bar with user profile, audio toggle & logout
│   ├── RollHistory.tsx             # Live scrollable roll chronicle with crit badges
│   └── RoomMembers.tsx             # Active adventurers roster with online presence
├── database/
│   └── app.db                      # SQLite database file (created automatically)
├── lib/
│   ├── audio.ts                    # Procedural Web Audio FX synthesis engine
│   ├── auth.ts                     # Password hashing, JWT signing & auth helpers
│   ├── db.ts                       # SQLite schema initialization & database connection
│   ├── dice.ts                     # D&D roll calculation, notation parser & persistence
│   ├── dice-3d.ts                  # 3D polyhedral geometries, Cannon bodies & face textures
│   └── rooms.ts                    # Room creation, code generation & query utilities
├── server.js                       # Node.js custom HTTP server (Next.js + Socket.io)
├── tests/
│   ├── audio.test.ts               # Procedural audio engine tests
│   ├── auth.test.ts                # Authentication & token verification tests
│   ├── db.test.ts                  # SQLite schema & database connection tests
│   ├── dice-3d.test.ts             # 3D geometries, physics body mapping & colors
│   ├── dice.test.ts                # Dice roll calculations, crits & database roll logging
│   ├── rooms.test.ts               # Room CRUD, password checks & code generator tests
│   ├── sanity.test.ts              # Environment sanity tests
│   └── setup.ts                    # Test environment configuration
├── package.json                    # Dependencies and runtime scripts
├── tsconfig.json                   # TypeScript configuration
└── vitest.config.mjs               # Vitest runner configuration
```

---

## ⚙️ Environment Variables

Configure environment variables in a `.env` file or export them directly in your environment:

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | Number | `3000` | HTTP port on which the server will listen. |
| `JWT_SECRET` | String | *tapb-secret-key-change-in-prod* | Secret key used to sign and verify JWT authentication tokens. **Required in production.** |
| `DATABASE_PATH` | String | `database/app.db` | Path to the SQLite database file (supports relative or absolute paths, or `:memory:`). |
| `NODE_ENV` | String | `development` | Application environment (`development` or `production`). |

Example `.env` configuration:
```env
PORT=3000
JWT_SECRET=super-secret-dnd-session-token-key
DATABASE_PATH=database/app.db
NODE_ENV=development
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v22+` (per project runtime requirements)
- **npm**: `10+` (or yarn / pnpm / bun)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/tapb-studio/tapb-dice-web-app.git
cd tapb-dice-web-app
npm install
```

### Running Locally (Development)

Start the unified HTTP and Socket.io server in development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Running the Test Suite

Execute the full automated test suite (141 unit and integration tests across 7 suites):

```bash
npm test
```

Or run Vitest with the test runner CLI:

```bash
npx vitest run
```

To run TypeScript strict type checking:

```bash
npx tsc --noEmit
```

### Building for Production

Compile the optimized Next.js production build:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

Or run both in sequence:

```bash
npm run build && npm start
```

The production server will initialize on `http://localhost:3000` (or the port defined by `PORT`).

---

## 🧪 Testing Summary

All features are covered by comprehensive unit and integration tests:

| Test Suite | File | Tests Passed | Description |
|---|---|---|---|
| **Database** | `tests/db.test.ts` | 6 / 6 | Schema creation, foreign keys, table initialization, and WAL mode |
| **Authentication** | `tests/auth.test.ts` | 19 / 19 | Password hashing, JWT signing/verifying, cookie handling, registration & login |
| **Rooms** | `tests/rooms.test.ts` | 27 / 27 | Code generation, password hashing, CRUD operations, route handlers & authorization |
| **Dice Rolling** | `tests/dice.test.ts` | 25 / 25 | Formula parsing, cryptographic RNG, modifier logic, crit detection & DB persistence |
| **3D Physics** | `tests/dice-3d.test.ts` | 49 / 49 | Geometries for d4-d100, Cannon-es rigid bodies, palette themes & face textures |
| **Procedural Audio** | `tests/audio.test.ts` | 13 / 13 | Web Audio synthesis nodes, mute toggles, dice rattle, table hits, crit fanfares |
| **Sanity** | `tests/sanity.test.ts` | 2 / 2 | Environment sanity checks |
| **Total** | **7 Test Files** | **141 / 141** | **100% Pass Rate** |

---

## 📜 Available Scripts

- `npm run dev`: Starts the custom HTTP server with Next.js development mode and live Socket.io server.
- `npm run build`: Compiles the Next.js production bundle with type validation and page optimization.
- `npm start`: Starts the custom server in production mode (`NODE_ENV=production node server.js`).
- `npm test`: Runs the Vitest test runner across all test suites.

---

## ⚖️ License

Created for TAPB Studio. All rights reserved.
