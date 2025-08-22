const express = require("express");
const authMiddleware = require("../middleware/authMiddleware/authMiddleware");
const TaskController = require("../Controllers/TaskController/TaskController");
const taskRouter = express.Router();

taskRouter.post("/api/home/task", authMiddleware, TaskController.addTask);
taskRouter.patch(
  "/api/home/task/move",
  authMiddleware,
  TaskController.moveTask,
);
taskRouter.delete(
  "/api/home/task/:taskId",
  authMiddleware,
  TaskController.deleteTask,
);
taskRouter.get(
  "/api/home/task/:taskId",
  authMiddleware,
  TaskController.getTaskById,
);
taskRouter.get("/api/home/stats", authMiddleware, TaskController.getTaskStats);
taskRouter.get("/api/home/tasks", authMiddleware, TaskController.getAllTasks);
taskRouter.get(
  "/api/home/tasks/search",
  authMiddleware,
  TaskController.searchTask,
);

module.exports = taskRouter;
