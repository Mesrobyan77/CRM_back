const {
  Board,
  Column,
  Task,
  Subtask,
  User,
  Comment,
  Workspace,
  Notification,
} = require("../../Models/rootModel");
const { userSockets, getIO } = require("../../server");

class BoardController {
  async addBoard(req, res) {
    try {
      const { name, workspaceId } = req.body;
      const createdBy = req.user.id; // User performing the action

      if (!name || !workspaceId) {
        return res.status(400).json({ error: "Name & workspaceId required" });
      }

      // Verify workspace exists
      const workspace = await Workspace.findByPk(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Create board
      const board = await Board.create({ name, workspaceId });

      // Fetch users associated with the workspace (e.g., assigned to tasks in any board of the workspace)
      const boards = await Board.findAll({
        where: { workspaceId },
        attributes: ["id"],
      });
      const boardIds = boards.map((b) => b.id);
      const tasks = await Task.findAll({
        where: {
          columnId: {
            [require("sequelize").Op.in]: (
              await Column.findAll({
                where: { boardId: boardIds },
                attributes: ["id"],
              })
            ).map((c) => c.id),
          },
        },
        include: [
          { model: User, as: "assignedUsers", attributes: ["id", "userName"] },
        ],
      });
      const usersToNotify = [
        ...new Set(tasks.flatMap((task) => task.assignedUsers)),
      ]; // Unique users

      // Include creator if not already in assigned users
      const creator = await User.findByPk(createdBy, {
        attributes: ["id", "userName"],
      });
      if (creator && !usersToNotify.some((u) => u.id === creator.id)) {
        usersToNotify.push(creator);
      }

      // Prepare notification
      const notification = {
        message: `${creator ? creator.userName : "Unknown"} created board "${name}" in workspace "${workspace.name}"`,
        workspaceId,
        boardId: board.id,
        timestamp: new Date(),
      };

      // Notify users
      for (const user of usersToNotify) {
        // Save notification to DB (if Notification model exists)
        if (Notification) {
          await Notification.create({
            message: notification.message,
            userId: user.id,
            workspaceId,
            boardId: board.id,
          });
        }

        // Emit real-time notification
        const io = getIO();
        const socketId = userSockets.get(user.id.toString());
        if (socketId) {
          io.to(socketId).emit("notification", notification);
        }
      }

      res.json({ message: "Board created", board });
    } catch (error) {
      console.error("Error creating board:", error);
      res.status(500).json({ error: "Failed to create board" });
    }
  }

  async getBoardById(req, res) {
    const { id } = req.params;

    try {
      const board = await Board.findByPk(id, {
        include: [
          {
            model: Column,
            include: [
              {
                model: Task,
                include: [
                  { model: Subtask },
                  { model: User },
                  {
                    model: Comment,
                    include: [{ model: User }],
                  },
                ],
              },
            ],
          },
        ],
      });

      if (!board) return res.status(404).json({ error: "Board not found" });

      res.json(board);
    } catch (error) {
      console.error("Error fetching board:", error);
      res.status(500).json({ error: "Failed to fetch board" });
    }
  }
}

module.exports = new BoardController();
