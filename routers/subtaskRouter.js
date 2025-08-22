const express = require("express");
const authMiddleware = require("../middleware/authMiddleware/authMiddleware");
const SubtaskController = require("../Controllers/SubtaskController/SubtaskController");

const subtaskRouter = express.Router();

subtaskRouter.post(
  "/api/home/subtask",
  authMiddleware,
  SubtaskController.createSubtask,
);
subtaskRouter.post(
  "/api/home/subtask/:subtaskId",
  authMiddleware,
  SubtaskController.updateSubtask,
);
subtaskRouter.delete(
  "/api/home/subtask/:subtaskId",
  authMiddleware,
  SubtaskController.deleteSubtask,
);

module.exports = subtaskRouter;
