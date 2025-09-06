const { Notification } = require("../../Models/rootModel");

class NotificationController {
  async getNotifications(req, res) {
    try {
      const notifications = await Notification.findAll({
        where: { userId: req.user.id },
        order: [["createdAt", "DESC"]],
      });
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  }

  async markNotificationRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (!id) {
        return res.status(400).json({ message: "Notification ID is required" });
      }

      const notification = await Notification.findOne({
        where: {
          id,
          userId,
        },
      });

      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      notification.isRead = true;
      await notification.save();

      return res
        .status(200)
        .json({ message: "Notification marked as read", id: notification.id });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return res.status(500).json({
        message: "Error marking notification as read",
        error: String(error),
      });
    }
  }

  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (!id) {
        return res.status(400).json({ message: "Notification ID is required" });
      }

      const notification = await Notification.findOne({
        where: {
          id,
          userId,
        },
      });

      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      await notification.destroy();

      return res
        .status(200)
        .json({ message: "Notification deleted", id: notification.id });
    } catch (error) {
      console.error("Error deleting notification:", error);
      return res
        .status(500)
        .json({ message: "Error deleting notification", error: String(error) });
    }
  }
}

module.exports = new NotificationController();
