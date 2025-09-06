require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");

const sequelize = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger-output.json");
const {
  boardRouter,
  columnRouter,
  subtaskRouter,
  taskRouter,
  workspaceRouter,
} = require("./routers/indexRouter");
const loginRouter = require("./routers/loginRouther");
const { initSocket } = require("./server");
const notRouter = require("./routers/notificationRouter");
const boardRecentRouter = require("./routers/boards.recent");

const app = express();
const server = http.createServer(app); // ✅ http server for both Express + Socket.IO

// --- CORS for Express ---
app.use(
  cors({
    origin: "http://localhost:5173", // frontend URL
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Security headers (optional, can comment out if cause issues) ---
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

// --- Your routes ---
app.use("/", boardRouter);
app.use("/", columnRouter);
app.use("/", subtaskRouter);
app.use("/", taskRouter);
app.use("/", workspaceRouter);
app.use("/", loginRouter);
app.use("/", notRouter);
app.use("/", boardRecentRouter);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const io = initSocket(server);

const PORT = process.env.SERVER_PORT || 7777;
(async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");
    await sequelize.sync();
    console.log("✅ Models synced");

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`Swagger running at http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error("❌ Database error:", err);
  }
})();

module.exports = { io, sequelize };
