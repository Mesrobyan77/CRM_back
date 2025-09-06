const express = require("express");
const authMiddleware = require("../middleware/authMiddleware/authMiddleware");
const NotificationController = require("../Controllers/NotificationController/NotificationController");

const notRouter = express.Router();

notRouter.get(
  "/api/home/notifications",
  authMiddleware,
  NotificationController.getNotifications,
);
notRouter.patch(
  "/api/notifications/:id/read",
  authMiddleware,
  NotificationController.markNotificationRead,
);
notRouter.delete(
  "/api/notifications/:id",
  authMiddleware,
  NotificationController.deleteNotification,
);
module.exports = notRouter;
