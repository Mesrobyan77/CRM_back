const express = require("express");
const authMiddleware = require("../middleware/authMiddleware/authMiddleware");
const BoardController = require("../Controllers/BoardController/BoardController");
const boardRouter = express.Router();

boardRouter.post("/api/home/board", authMiddleware, BoardController.addBoard);
boardRouter.get("/api/home/board/:id", authMiddleware, BoardController.getBoardById);

module.exports = boardRouter;