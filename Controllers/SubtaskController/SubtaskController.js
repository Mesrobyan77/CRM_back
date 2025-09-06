// const { Subtask } = require("../../Models/rootModel");

// class SubtaskController {
//   async createSubtask(req, res) {
//     try {
//       const { taskId, title } = req.body;
//       if (!taskId || !title)
//         return res.status(400).json({ error: "TaskId & title required" });

//       const subtask = await Subtask.create({ taskId, title, isDone: false });
//       res.json({ message: "Subtask created", subtask });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: "Failed to create subtask" });
//     }
//   }

//   async updateSubtask(req, res) {
//     try {
//       const { subtaskId } = req.params;
//       const { title, isDone } = req.body;

//       const subtask = await Subtask.findByPk(subtaskId);
//       if (!subtask) {
//         return res.status(404).json({ error: "Subtask not found" });
//       }

//       if (title !== undefined) subtask.title = title;
//       if (isDone !== undefined) subtask.isDone = isDone;

//       await subtask.save();

//       res.json({
//         message: "Subtask updated successfully",
//         subtask,
//       });
//     } catch (error) {
//       console.error("❌ Error updating subtask:", error);
//       res.status(500).json({ error: "Failed to update subtask" });
//     }
//   }

//   async deleteSubtask(req, res) {
//     try {
//       const { subtaskId } = req.params;

//       const subtask = await Subtask.findByPk(subtaskId);
//       if (!subtask) {
//         return res.status(404).json({ error: "Subtask not found" });
//       }

//       await subtask.destroy();
//       res.json({ message: "Subtask deleted successfully" });
//     } catch (error) {
//       console.error("❌ Error deleting subtask:", error);
//       res.status(500).json({ error: "Failed to delete subtask" });
//     }
//   }
// }

// module.exports = new SubtaskController();
const { Subtask, Task, User, Notification } = require("../../Models/rootModel");
const { userSockets, getIO } = require("../../server");

class SubtaskController {
  async createSubtask(req, res) {
    try {
      const { taskId, title } = req.body;
      const createdBy = req.user.id; // User performing the action

      if (!taskId || !title) {
        return res.status(400).json({ error: "TaskId & title required" });
      }

      // Create subtask
      const subtask = await Subtask.create({ taskId, title, isDone: false });

      // Fetch task and assigned users
      const task = await Task.findByPk(taskId, {
        include: [
          { model: User, as: "assignedUsers", attributes: ["id", "userName"] },
        ],
      });
      if (!task) {
        return res.status(404).json({ error: "Parent task not found" });
      }

      // Prepare notification
      const creator = await User.findByPk(createdBy, {
        attributes: ["id", "userName"],
      });
      const notification = {
        message: `${creator ? creator.userName : "Unknown"} created subtask "${title}" in task "${task.title}"`,
        taskId,
        subtaskId: subtask.id,
        timestamp: new Date(),
      };

      // Notify assigned users and creator (if not assigned)
      const usersToNotify = [...task.assignedUsers];
      if (creator && !task.assignedUsers.some((u) => u.id === creator.id)) {
        usersToNotify.push(creator);
      }

      for (const user of usersToNotify) {
        // Save notification to DB (if Notification model exists)
        if (Notification) {
          await Notification.create({
            message: notification.message,
            userId: user.id,
            taskId,
            subtaskId: subtask.id,
          });
        }

        // Emit real-time notification
        const io = getIO();
        const socketId = userSockets.get(user.id.toString());
        if (socketId) {
          io.to(socketId).emit("notification", notification);
        }
      }

      res.json({ message: "Subtask created", subtask });
    } catch (error) {
      console.error("Error creating subtask:", error);
      res.status(500).json({ error: "Failed to create subtask" });
    }
  }

  async updateSubtask(req, res) {
    try {
      const { subtaskId } = req.params;
      const { title, isDone } = req.body;
      const updatedBy = req.user.id; // User performing the action

      const subtask = await Subtask.findByPk(subtaskId, {
        include: [
          {
            model: Task,
            include: [
              {
                model: User,
                as: "assignedUsers",
                attributes: ["id", "userName"],
              },
            ],
          },
        ],
      });
      if (!subtask) {
        return res.status(404).json({ error: "Subtask not found" });
      }

      if (title !== undefined) subtask.title = title;
      if (isDone !== undefined) subtask.isDone = isDone;

      await subtask.save();

      // Prepare notification
      const updater = await User.findByPk(updatedBy, {
        attributes: ["id", "userName"],
      });
      const message =
        isDone !== undefined
          ? `${updater ? updater.userName : "Unknown"} marked subtask "${subtask.title}" as ${isQuestComplete ? "complete" : "incomplete"} in task "${subtask.Task.title}"`
          : `${updater ? updater.userName : "Unknown"} updated subtask "${subtask.title}" in task "${subtask.Task.title}"`;

      const notification = {
        message,
        taskId: subtask.taskId,
        subtaskId,
        timestamp: new Date(),
      };

      // Notify assigned users and updater (if not assigned)
      const usersToNotify = [...subtask.Task.assignedUsers];
      if (
        updater &&
        !subtask.Task.assignedUsers.some((u) => u.id === updater.id)
      ) {
        usersToNotify.push(updater);
      }

      for (const user of usersToNotify) {
        if (Notification) {
          await Notification.create({
            message: notification.message,
            userId: user.id,
            taskId: subtask.taskId,
            subtaskId,
          });
        }

        const socketId = userSockets.get(user.id.toString());
        if (socketId) {
          io.to(socketId).emit("notification", notification);
        }
      }

      res.json({
        message: "Subtask updated successfully",
        subtask,
      });
    } catch (error) {
      console.error("❌ Error updating subtask:", error);
      res.status(500).json({ error: "Failed to update subtask" });
    }
  }

  async deleteSubtask(req, res) {
    try {
      const { subtaskId } = req.params;
      const deletedBy = req.user.id; // User performing the action

      const subtask = await Subtask.findByPk(subtaskId, {
        include: [
          {
            model: Task,
            include: [
              {
                model: User,
                as: "assignedUsers",
                attributes: ["id", "userName"],
              },
            ],
          },
        ],
      });
      if (!subtask) {
        return res.status(404).json({ error: "Subtask not found" });
      }

      // Prepare notification
      const deleter = await User.findByPk(deletedBy, {
        attributes: ["id", "userName"],
      });
      const notification = {
        message: `${deleter ? deleter.userName : "Unknown"} deleted subtask "${subtask.title}" in task "${subtask.Task.title}"`,
        taskId: subtask.taskId,
        subtaskId,
        timestamp: new Date(),
      };

      // Notify assigned users and deleter (if not assigned)
      const usersToNotify = [...subtask.Task.assignedUsers];
      if (
        deleter &&
        !subtask.Task.assignedUsers.some((u) => u.id === deleter.id)
      ) {
        usersToNotify.push(deleter);
      }

      for (const user of usersToNotify) {
        if (Notification) {
          await Notification.create({
            message: notification.message,
            userId: user.id,
            taskId: subtask.taskId,
            subtaskId,
          });
        }

        const socketId = userSockets.get(user.id.toString());

        if (socketId) {
          io.to(socketId).emit("notification", notification);
        }
      }

      await subtask.destroy();
      res.json({ message: "Subtask deleted successfully" });
    } catch (error) {
      console.error("❌ Error deleting subtask:", error);
      res.status(500).json({ error: "Failed to delete subtask" });
    }
  }
}

module.exports = new SubtaskController();
