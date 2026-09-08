const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const jiti = require("jiti")(__filename);
const { calculateRoll, saveRollToDb } = jiti("./lib/dice");

// In-memory room members tracking
// roomUsers: Map<roomId, Map<socketId, { id, name, username }>>
const roomUsers = new Map();
// socketRooms: Map<socketId, Set<roomId>>
const socketRooms = new Map();

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

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    ...options,
  });

  io.on("connection", (socket) => {
    // Join room
    socket.on("join_room", (data) => {
      if (!data || !data.roomId) return;
      const { roomId, user } = data;
      if (!user || !user.id || !user.name) return;

      const roomChannel = `room:${roomId}`;
      socket.join(roomChannel);

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }
      const userEntry = {
        id: String(user.id),
        name: String(user.name),
        username: user.username ? String(user.username) : String(user.name),
      };
      roomUsers.get(roomId).set(socket.id, userEntry);

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

        // Derive user from verified in-memory room membership
        const rollingUser = memberUser;

        const parsedCount = count !== undefined ? Number(count) : 1;
        const parsedModifier = modifier !== undefined ? Number(modifier) : 0;

        const roll = calcRoll(diceType, parsedCount, parsedModifier);
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
