const { createServer } = require("http");
const { parse } = require("url");
const crypto = require("crypto");
const next = require("next");
const { Server } = require("socket.io");
const jiti = require("jiti")(__filename);
const { calculateRoll, saveRollToDb } = jiti("./lib/dice");
const { verifyToken, AUTH_COOKIE_NAME } = jiti("./lib/auth");
const { getDb } = jiti("./lib/db");

// In-memory room members tracking
// roomUsers: Map<roomId, Map<socketId, { id, name, username }>>
const roomUsers = new Map();
// socketRooms: Map<socketId, Set<roomId>>
const socketRooms = new Map();

// Auto-cleanup timer tracking for empty rooms
const EMPTY_ROOM_GRACE_MS = 60 * 1000; // 60 seconds grace period
const emptyRoomTimers = new Map();

function scheduleRoomCleanup(roomId) {
  if (emptyRoomTimers.has(roomId)) {
    clearTimeout(emptyRoomTimers.get(roomId));
  }
  const timer = setTimeout(() => {
    emptyRoomTimers.delete(roomId);
    const currentUsers = roomUsers.get(roomId);
    if (!currentUsers || currentUsers.size === 0) {
      try {
        const db = getDb();
        db.prepare("DELETE FROM dice_rolls WHERE room_id = ?").run(roomId);
        db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);
      } catch (err) {
        // quiet error catch
      }
    }
  }, EMPTY_ROOM_GRACE_MS);
  emptyRoomTimers.set(roomId, timer);
}

function cancelRoomCleanup(roomId) {
  if (emptyRoomTimers.has(roomId)) {
    clearTimeout(emptyRoomTimers.get(roomId));
    emptyRoomTimers.delete(roomId);
  }
}

function getRoomUsers(roomId) {
  const usersMap = roomUsers.get(roomId);
  if (!usersMap) return [];
  const uniqueUsers = new Map();
  for (const user of usersMap.values()) {
    if (!uniqueUsers.has(user.id)) {
      uniqueUsers.set(user.id, {
        id: user.id,
        name: user.name,
        username: user.username || user.name,
      });
    }
  }
  return Array.from(uniqueUsers.values());
}

function initSocketServer(httpServer, options = {}) {
  const calcRoll = options.calculateRoll || calculateRoll;
  const saveRoll = options.saveRollToDb || saveRollToDb;
  const verifyTok = options.verifyToken || verifyToken;
  const cookieName = options.cookieName || AUTH_COOKIE_NAME || "token";
  const cryptoRng =
    options.rng || (() => crypto.randomInt(0, 10000000) / 10000000);

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    ...options,
  });

  // Socket.io Authentication Middleware: inspect cookie or auth token, validate JWT
  io.use((socket, next) => {
    try {
      let token = socket.handshake?.auth?.token;
      if (!token && socket.handshake?.headers?.cookie) {
        const cookieHeader = socket.handshake.headers.cookie;
        const match = cookieHeader.match(
          new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`)
        );
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }

      if (token && typeof token === "string") {
        const cleanToken = token.startsWith("Bearer ")
          ? token.slice(7).trim()
          : token.trim();
        const decoded = verifyTok(cleanToken);
        if (decoded && decoded.id) {
          socket.data.user = {
            id: String(decoded.id),
            name: String(decoded.name || decoded.username || "Adventurer"),
            username: String(decoded.username || decoded.name || "Adventurer"),
          };
        }
      }
    } catch {
      // Allow fallback for testing if no token or token is invalid
    }
    next();
  });

  io.on("connection", (socket) => {
    // Join room
    socket.on("join_room", (data) => {
      if (!data || !data.roomId) return;
      const { roomId, user } = data;

      // Prioritize authenticated user from token over unauthenticated client payload
      const activeUser = socket.data.user
        ? {
            id: String(socket.data.user.id),
            name: String(socket.data.user.name),
            username: String(socket.data.user.username || socket.data.user.name),
          }
        : user && user.id && user.name
        ? {
            id: String(user.id),
            name: String(user.name),
            username: user.username ? String(user.username) : String(user.name),
          }
        : null;

      if (!activeUser) return;

      const roomChannel = `room:${roomId}`;
      socket.join(roomChannel);
      cancelRoomCleanup(roomId);

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }
      roomUsers.get(roomId).set(socket.id, activeUser);

      if (!socketRooms.has(socket.id)) {
        socketRooms.set(socket.id, new Set());
      }
      socketRooms.get(socket.id).add(roomId);

      io.to(roomChannel).emit("room_users_updated", {
        users: getRoomUsers(roomId),
      });
    });

    // Roll dice
    socket.on("roll_dice", async (data, callback) => {
      try {
        if (!data || typeof data !== "object") {
          throw new Error("Invalid roll payload");
        }

        const { roomId, diceType, count, modifier } = data;

        if (!roomId) {
          throw new Error("Room ID is required");
        }

        // Verify socket is an active member of the room
        const roomMap = roomUsers.get(roomId);
        const memberUser = roomMap ? roomMap.get(socket.id) : null;
        if (!memberUser) {
          throw new Error("You must join the room before rolling dice");
        }

        // Derive user strictly from socket.data.user or registered room user
        const rollingUser = socket.data.user || memberUser;

        const parsedCount = count !== undefined ? Number(count) : 1;
        const parsedModifier = modifier !== undefined ? Number(modifier) : 0;

        const roll = calcRoll(diceType, parsedCount, parsedModifier, cryptoRng);
        const saved = saveRoll(roomId, rollingUser, roll);

        const payload = {
          id: saved.id,
          roomId,
          user: {
            id: rollingUser.id,
            name: rollingUser.name,
            username: rollingUser.username || rollingUser.name,
          },
          diceType: roll.diceType,
          count: roll.count,
          modifier: roll.modifier,
          notation: roll.notation,
          individualResults: roll.individualResults,
          total: roll.total,
          isCritHit: roll.isCritHit,
          isCritFail: roll.isCritFail,
          createdAt: saved.createdAt,
        };

        io.to(`room:${roomId}`).emit("dice_rolled", payload);

        if (typeof callback === "function") {
          callback({ success: true, roll: payload });
        }
      } catch (err) {
        const errorMessage = err.message || "Failed to process roll";
        socket.emit("error", { error: errorMessage, message: errorMessage });
        if (typeof callback === "function") {
          callback({ success: false, error: errorMessage });
        }
      }
    });

    // Delete room explicitly by host
    socket.on("delete_room", (data, callback) => {
      try {
        if (!data || !data.roomId) return;
        const { roomId } = data;
        const user = socket.data.user;
        const db = getDb();
        const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId);
        if (!room) {
          if (typeof callback === "function") callback({ success: false, error: "Room not found" });
          return;
        }
        if (!user || room.created_by !== user.id) {
          if (typeof callback === "function") callback({ success: false, error: "Unauthorized" });
          return;
        }

        const roomChannel = `room:${roomId}`;
        io.to(roomChannel).emit("room_deleted", {
          roomId,
          message: "The chamber has been dissolved by the host.",
        });

        db.prepare("DELETE FROM dice_rolls WHERE room_id = ?").run(roomId);
        db.prepare("DELETE FROM rooms WHERE id = ?").run(roomId);

        roomUsers.delete(roomId);
        cancelRoomCleanup(roomId);

        if (typeof callback === "function") callback({ success: true });
      } catch (err) {
        if (typeof callback === "function") callback({ success: false, error: err.message });
      }
    });

    // Leave room
    socket.on("leave_room", (data) => {
      if (!data || !data.roomId) return;
      const { roomId } = data;
      const roomChannel = `room:${roomId}`;

      socket.leave(roomChannel);

      if (roomUsers.has(roomId)) {
        roomUsers.get(roomId).delete(socket.id);
        if (roomUsers.get(roomId).size === 0) {
          roomUsers.delete(roomId);
          scheduleRoomCleanup(roomId);
        }
      }

      if (socketRooms.has(socket.id)) {
        socketRooms.get(socket.id).delete(roomId);
        if (socketRooms.get(socket.id).size === 0) {
          socketRooms.delete(socket.id);
        }
      }

      io.to(roomChannel).emit("room_users_updated", {
        users: getRoomUsers(roomId),
      });
    });

    // Disconnect
    socket.on("disconnect", () => {
      const rooms = socketRooms.get(socket.id);
      if (rooms) {
        for (const roomId of rooms) {
          const roomChannel = `room:${roomId}`;
          if (roomUsers.has(roomId)) {
            roomUsers.get(roomId).delete(socket.id);
            if (roomUsers.get(roomId).size === 0) {
              roomUsers.delete(roomId);
              scheduleRoomCleanup(roomId);
            }
          }
          io.to(roomChannel).emit("room_users_updated", {
            users: getRoomUsers(roomId),
          });
        }
        socketRooms.delete(socket.id);
      }
    });
  });

  return io;
}

// Start custom server when executed directly as main script
const isMainScript =
  require.main === module &&
  !process.env.VITEST &&
  process.env.NODE_ENV !== "test";

if (isMainScript) {
  const dev = process.env.NODE_ENV !== "production";
  const app = next({ dev });
  const handle = app.getRequestHandler();
  const port = parseInt(process.env.PORT || "3000", 10);

  app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    });

    initSocketServer(httpServer);

    httpServer.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
    });
  });
}

module.exports = {
  initSocketServer,
  getRoomUsers,
};
