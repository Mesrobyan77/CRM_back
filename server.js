// socket.js
const { Server } = require("socket.io");

let io;
const userSockets = new Map(); // userId (string) => socketId

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("register", (userId) => {
      userSockets.set(userId.toString(), socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          console.log(`User ${userId} disconnected`);
          break;
        }
      }
    });
  });

  return io;
}

module.exports = { initSocket, userSockets, getIO: () => io };
