const { col, Op } = require("sequelize");
const {
  Task,
  Column,
  Comment,
  UserTask,
  sequelize,
  ColumnName,
  Workspace,
  Board,
  User,
  Notification,
  Subtask,
} = require("../../Models/rootModel");

const { userSockets, getIO } = require("../../server");

class TaskController {
  // Create a new task
  async addTask(req, res) {
    const t = await sequelize.transaction();
    try {
      const {
        title,
        description = null,
        timeStart = null,
        timeEnd = null,
        priority = null,
        assignedUserIds = [],
        subtasks = [],
        comments = [],
        createdBy = req.user.id,
      } = req.body;
      if (!title) {
        await t.rollback();
        return res.status(400).json({ message: "title is required" });
      }
      // 1) Workspace(name = title)
      const [workspace] = await Workspace.findOrCreate({
        where: { name: title },
        defaults: { name: title, createdAt: new Date(), updatedAt: new Date() },
        transaction: t,
      });

      // 2) Board(name = title in that workspace)
      const [board] = await Board.findOrCreate({
        where: { name: title, workspaceId: workspace.id },
        defaults: {
          name: title,
          workspaceId: workspace.id,
        },
        transaction: t,
      });

      // 3) ColumnName = "to do"
      const [colName] = await ColumnName.findOrCreate({
        where: { name: "to do" },
        defaults: { name: "to do" },
        transaction: t,
      });

      // 4) Column on that board
      const [column] = await Column.findOrCreate({
        where: { boardId: board.id, columnNameId: colName.id },
        defaults: {
          order: 1,
          boardId: board.id,
          columnNameId: colName.id,
        },
        transaction: t,
      });

      // 5) Create Task in that column
      const task = await Task.create(
        {
          title,
          description,
          timeStart,
          timeEnd,
          status: "start",
          priority,
          columnId: column.id,
        },
        { transaction: t }
      );

      // 6) Assign users (UserTasks)
      let assignedUsers = [];
      if (assignedUserIds.length) {
        const validUsers = await User.findAll({
          where: { id: assignedUserIds },
          attributes: ["id", "userName"],
          transaction: t,
        });
        const rows = validUsers.map((u) => ({
          userId: u.id,
          taskId: task.id,
        }));
        if (rows.length) {
          await UserTask.bulkCreate(rows, {
            transaction: t,
            ignoreDuplicates: true,
          });
          assignedUsers = validUsers;
        }
      }

      // 7) Subtask
      if (Array.isArray(subtasks) && subtasks.length) {
        const rows = subtasks
          .filter((s) => s && s.title)
          .map((s) => ({
            title: s.title,
            isDone: !!s.isDone,
            taskId: task.id,
          }));
        if (rows.length) await Subtask.bulkCreate(rows, { transaction: t });
      }

      // 8) Comments (optional starter)
      const commentRows = [];
      if (Array.isArray(comments) && comments.length) {
        for (const c of comments) {
          if (!c || !c.content) continue;
          commentRows.push({
            content: c.content,
            taskId: task.id,
            userId: c.userId ?? createdBy ?? null,
          });
        }
      } else {
        commentRows.push({
          content: "Task created",
          taskId: task.id,
          userId: createdBy ?? null,
        });
      }
      await Comment.bulkCreate(commentRows, { transaction: t });

      // 9) Send notifications
      const creator = await User.findByPk(createdBy, {
        attributes: ["id", "userName"],
        transaction: t,
      });
      const notification = {
        message: `Task "${title}" created by ${creator ? creator.userName : "Unknown"}`,
        taskId: task.id,
        timestamp: new Date(),
      };

      // Notify assigned users and creator (if not already assigned)
      const usersToNotify = [...assignedUsers];
      if (creator && !assignedUserIds.includes(creator.id)) {
        usersToNotify.push(creator);
      }

      for (const user of usersToNotify) {
        // Save notification to DB (if Notification model exists)
        if (Notification) {
          await Notification.create(
            {
              message: notification.message,
              userId: user.id,
              taskId: task.id,
            },
            { transaction: t }
          );
        }
        const io = getIO();
        // Emit real-time notification

        const socketId = userSockets.get(user.id.toString());

        if (socketId) {
          io.to(socketId).emit("notification", notification);
        }
      }

      // Notify for comments (if any)
      for (const comment of commentRows) {
        const commenter = await User.findByPk(comment.userId, {
          attributes: ["id", "userName"],
          transaction: t,
        });
        if (commenter) {
          const commentNotification = {
            message: `${commenter.userName} commented on task "${title}": ${comment.content}`,
            taskId: task.id,
            commentId: comment.id,
            timestamp: new Date(),
          };

          for (const user of usersToNotify) {
            if (user.id !== comment.userId) {
              if (Notification) {
                await Notification.create(
                  {
                    message: commentNotification.message,
                    userId: user.id,
                    taskId: task.id,
                  },
                  { transaction: t }
                );
              }

              const socketId = userSockets.get(user.id);
              if (socketId) {
                io.to(socketId).emit("notification", commentNotification);
              }
            }
          }
        }
      }
      await t.commit();
      return res.status(201).json({
        message: "Task created",
        task,
        workspaceId: workspace.id,
        boardId: board.id,
        columnId: column.id,
      });
    } catch (error) {
      await t.rollback();
      console.error("Error creating task:", error);
      return res
        .status(500)
        .json({ message: "Error creating task", error: String(error) });
    }
  }

  // Update an existing task
  async getTaskById(req, res) {
    try {
      const { taskId } = req.params;
      const task = await Task.findByPk(taskId, {
        include: [
          { model: Subtask },
          {
            model: Comment,
            include: [
              { model: User, attributes: ["id", "userName", "avatar"] },
            ],
          },
          {
            model: User,
            as: "assignedUsers",
            attributes: ["id", "userName", "avatar"],
          },
        ],
      });

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.status(200).json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Error fetching task", error });
    }
  }

  // Get all tasks
  async getAllTasks(req, res) {
    try {
      const tasks = await Task.findAll({
        include: [
          { model: Column, include: [{ model: Board }] },
          { model: Subtask },
          {
            model: User,
            as: "assignedUsers",
            attributes: ["id", "userName", "avatar"],
          },
        ],
        order: [["order", "ASC"]],
      });
      res.status(200).json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Error fetching tasks", error });
    }
  }

  // Get task statistics
  async getTaskStats(req, res) {
    try {
      const stats = await Task.findAll({
        attributes: [
          "columnId",
          [sequelize.fn("COUNT", sequelize.col("Task.id")), "count"],
        ],
        group: ["columnId"],
        include: [
          {
            model: Column,
            attributes: ["id"],
            include: [{ model: ColumnName, attributes: ["name"] }],
          },
        ],
      });
      res.status(200).json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Error fetching stats", error });
    }
  }

  // Delete a task
  async deleteTask(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { taskId } = req.params;
      const task = await Task.findByPk(taskId, {
        include: [
          { model: User, as: "assignedUsers", attributes: ["id", "userName"] },
        ],
        transaction,
      });
      if (!task) {
        await transaction.rollback();
        return res.status(404).json({ message: "Task not found" });
      }

      // Send notifications
      const notification = {
        message: `Task "${task.title}" has been deleted`,
        taskId,
        timestamp: new Date(),
      };

      for (const user of task.assignedUsers) {
        if (Notification) {
          await Notification.create(
            {
              message: notification.message,
              userId: user.id,
              taskId,
            },
            { transaction }
          );
        }

        const socketId = userSockets.get(user.id);
        if (socketId) {
          io.to(socketId).emit("notification", notification);
        }
      }

      await Subtask.destroy({ where: { taskId }, transaction });
      await Comment.destroy({ where: { taskId }, transaction });
      await UserTask.destroy({ where: { taskId }, transaction });
      await task.destroy({ transaction });

      await transaction.commit();
      res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
      await transaction.rollback();
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Error deleting task", error });
    }
  }

  // Search tasks
  async searchTask(req, res) {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      const tasks = await Task.findAll({
        where: {
          [Op.or]: [
            { title: { [Op.like]: `%${query}%` } },
            { description: { [Op.like]: `%${query}%` } },
          ],
        },
        include: [{ model: Subtask }, { model: User, as: "assignedUsers" }],
      });

      res.status(200).json(tasks);
    } catch (error) {
      console.error("Error searching tasks:", error);
      res.status(500).json({ message: "Error searching tasks", error });
    }
  }

  // Move task to a different column
  async moveTask(req, res) {
    const t = await sequelize.transaction();
    try {
      const { taskId, columnId } = req.body;

      if (!taskId || !columnId) {
        await t.rollback();
        return res
          .status(400)
          .json({ message: "taskId and columnId are required" });
      }

      const task = await Task.findByPk(taskId, {
        include: [
          { model: User, as: "assignedUsers", attributes: ["id", "userName"] },
        ],
        transaction: t,
      });
      if (!task) {
        await t.rollback();
        return res.status(404).json({ message: "Task not found" });
      }

      const toColumn = await Column.findByPk(columnId, {
        include: [{ model: ColumnName, attributes: ["name"] }],
        transaction: t,
      });
      if (!toColumn) {
        await t.rollback();
        return res.status(404).json({ message: "Column not found" });
      }

      const maxOrder = await Task.max("order", {
        where: { columnId },
        transaction: t,
      });
      const toIndex = Number.isFinite(maxOrder) ? maxOrder + 1 : 0;

      if (task.columnId !== columnId && Number.isFinite(task.order)) {
        await Task.update(
          { order: sequelize.literal("`order` - 1") },
          {
            where: { columnId: task.columnId, order: { [Op.gt]: task.order } },
            transaction: t,
          }
        );
      }

      await task.update({ columnId, order: toIndex }, { transaction: t });

      // Send notifications
      const notification = {
        message: `Task "${task.title}" moved to column "${toColumn.ColumnName.name}"`,
        taskId,
        columnId,
        timestamp: new Date(),
      };

      for (const user of task.assignedUsers) {
        if (Notification) {
          await Notification.create(
            {
              message: notification.message,
              userId: user.id,
              taskId,
            },
            { transaction: t }
          );
        }

        const socketId = userSockets.get(user.id);
        if (socketId) {
          io.to(socketId).emit("notification", notification);
        }
      }

      await t.commit();
      return res.json({ message: "Task moved", taskId, columnId });
    } catch (e) {
      await t.rollback();
      console.error("Error moving task:", e);
      return res.status(500).json({ message: "move failed", error: String(e) });
    }
  }

  async urgency(req, res) {
    try {
      const limit = Number(req.query.limit || 4);

      const tasks = await Task.findAll({
        include: [{ model: Column, include: [Board] }, { model: Subtask }],
        order: [["updatedAt", "DESC"]],
      });
      const perBoard = new Map();

      for (const t of tasks) {
        const board = t.Column?.Board;
        if (!board) continue;

        if (!t.Subtasks || !t.Subtasks.length) continue; // եթե սուբթասկ չկա → անտեսել

        const subScores = t.Subtasks.map((st) => (st.isDone == 1 ? 100 : 0));

        if (!subScores.length) continue;

        const finalScore = Math.round(
          subScores.reduce((a, b) => a + b, 0) / subScores.length
        );

        const cur = perBoard.get(board.id) || { name: board.name, scores: [] };
        cur.scores.push(finalScore);
        perBoard.set(board.id, cur);
      }

      let rows = Array.from(perBoard.entries()).map(([boardId, v]) => ({
        x: v,
        boardId: Number(boardId),
        boardName: v.name,
        score: Math.max(...v.scores),
      }));

      rows.sort((a, b) => b.score - a.score);
      rows = rows.slice(0, limit);
      res.json(rows);
    } catch (e) {
      console.error("Error in urgency:", e);
      return res
        .status(500)
        .json({ message: "Oops something went wrong", error: String(e) });
    }
  }
}

module.exports = new TaskController();
