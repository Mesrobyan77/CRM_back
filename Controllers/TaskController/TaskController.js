const { col, Op } = require("sequelize");
const {
  Task,
  Column,
  Subtask,
  Comment,
  UserTask,
  sequelize,
  ColumnName,
  Workspace,
  Board,
  User,
} = require("../../Models/rootModel");

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
          status: "open",
          priority: "normal",
          columnId: column.id,
        },
        { transaction: t }
      );

      // 6) Assign users (UserTasks)
      if (assignedUserIds.length) {
        // optional: verify users exist
        const validUsers = await User.findAll({
          where: { id: assignedUserIds },
          attributes: ["id"],
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
        }
      }

      // 7) Subtasks
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
            userId: c.userId ?? createdBy ?? null, // OK if nullable
          });
        }
      } else {
        // default starter comment
        commentRows.push({
          content: "Task created",
          taskId: task.id,
          userId: createdBy ?? null,
        });
      }
      await Comment.bulkCreate(commentRows, { transaction: t });

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
      console.error(error);
      return res
        .status(500)
        .json({ message: "Error creating task", error: String(error) });
    }
  }

  async getTaskById(req, res) {
    try {
      const { taskId } = req.params;
      const task = await Task.findByPk(taskId, {
        include: [
          { model: Subtask },
          {
            model: Comment,
            include: [{ model: User, attributes: ["id", "userName","avatar"] }],
          },
          { model: User, as: "assignedUsers", attributes: ["id", "userName","avatar"] },
        ],
      });

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.status(200).json(task);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching task", error });
    }
  }

  // Get all tasks, optionally filtered by board or workspace (adjust as needed)
  async getAllTasks(req, res) {
    try {
      const tasks = await Task.findAll({
        include: [
          { model: Column, include: [{ model: Board }] },
          { model: Subtask },
          { model: User, as: "assignedUsers", attributes: ["id", "userName","avatar"] },
        ],
        order: [["order", "ASC"]],
      });
      res.status(200).json(tasks);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching tasks", error });
    }
  }

  // Get task statistics (example: count by status/column)
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
      console.error(error);
      res.status(500).json({ message: "Error fetching stats", error });
    }
  }

  // Delete a task and associated data
  async deleteTask(req, res) {
    const transaction = await sequelize.transaction();
    try {
      const { taskId } = req.params;
      const task = await Task.findByPk(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      // Delete associated data
      await Subtask.destroy({ where: { taskId }, transaction });
      await Comment.destroy({ where: { taskId }, transaction });
      await UserTask.destroy({ where: { taskId }, transaction });

      await task.destroy({ transaction });

      await transaction.commit();
      res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
      await transaction.rollback();
      console.error(error);
      res.status(500).json({ message: "Error deleting task", error });
    }
  }

  // Search tasks by title or description
  async searchTask(req, res) {
    try {
      const { query } = req.query;
      if (!query) {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      const tasks = await Task.findAll({
        where: {
          [sequelize.Op.or]: [
            { title: { [sequelize.Op.like]: `%${query}%` } },
            { description: { [sequelize.Op.like]: `%${query}%` } },
          ],
        },
        include: [{ model: Subtask }, { model: User, as: "assignedUsers" }],
      });

      res.status(200).json(tasks);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error searching tasks", error });
    }
  }

  // Move task to a different column and update order -
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

      // 1) Get task
      const task = await Task.findByPk(taskId, { transaction: t });
      if (!task) {
        await t.rollback();
        return res.status(404).json({ message: "Task not found" });
      }

      // 2) Validate destination column
      const toColumn = await Column.findByPk(columnId, { transaction: t });
      if (!toColumn) {
        await t.rollback();
        return res.status(404).json({ message: "Column not found" });
      }

      // 3) Append at end of destination
      const maxOrder = await Task.max("order", {
        where: { columnId },
        transaction: t,
      });
      const toIndex = Number.isFinite(maxOrder) ? maxOrder + 1 : 0;

      // 4) Compact source column if changed
      if (task.columnId !== columnId && Number.isFinite(task.order)) {
        await Task.update(
          { order: sequelize.literal("`order` - 1") },
          {
            where: { columnId: task.columnId, order: { [Op.gt]: task.order } },
            transaction: t,
          }
        );
      }

      // 5) Move the task
      await task.update({ columnId, order: toIndex }, { transaction: t });

      await t.commit();
      return res.json({ message: "Task moved", taskId, columnId });
    } catch (e) {
      await t.rollback();
      console.error(e);
      return res.status(500).json({ message: "move failed", error: String(e) });
    }
  }

  
}

module.exports = new TaskController();
