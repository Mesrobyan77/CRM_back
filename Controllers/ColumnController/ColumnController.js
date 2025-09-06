// const { Column, ColumnName } = require("../../Models/rootModel");

// class ColumnController {
//   async addColumn(req, res) {
//     try {
//       const { name, boardId } = req.body;
//       if (!name || !boardId)
//         return res.status(400).json({ error: "Name & boardId required" });

//       const [columnName] = await ColumnName.findOrCreate({ where: { name } });
//       const column = await Column.create({
//         boardId,
//         columnNameId: columnName.id,
//         order: 0,
//       });

//       res.json({ message: "Column created", column });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: "Failed to create column" });
//     }
//   }
// }

// module.exports = new ColumnController();
const {
  Column,
  ColumnName,
  Board,
  Task,
  User,
  Notification,
} = require("../../Models/rootModel");
const { getIO, userSockets } = require("../../server");

class ColumnController {
  async addColumn(req, res) {
    try {
      const { name, boardId } = req.body;
      const createdBy = req.user.id; // User performing the action

      if (!name || !boardId) {
        return res.status(400).json({ error: "Name & boardId required" });
      }

      // Verify board exists
      const board = await Board.findByPk(boardId);
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }

      // Create or find column name
      const [columnName] = await ColumnName.findOrCreate({ where: { name } });

      // Create column
      const column = await Column.create({
        boardId,
        columnNameId: columnName.id,
        order: 0,
      });

      // Fetch users associated with the board (e.g., assigned to tasks in the board)
      const tasks = await Task.findAll({
        where: {
          columnId: {
            [require("sequelize").Op.in]: (
              await Column.findAll({ where: { boardId }, attributes: ["id"] })
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
        message: `${creator ? creator.userName : "Unknown"} created column "${name}" in board "${board.name}"`,
        boardId,
        columnId: column.id,
        timestamp: new Date(),
      };

      // Notify users
      for (const user of usersToNotify) {
        // Save notification to DB (if Notification model exists)
        if (Notification) {
          await Notification.create({
            message: notification.message,
            userId: user.id,
            boardId,
            columnId: column.id,
          });
        }

        // Emit real-time notification
        const io = getIO();
        const socketId = userSockets.get(user.id.toString());
        if (socketId) {
          io.to(socketId).emit("notification", notification);
        }
      }

      res.json({ message: "Column created", column });
    } catch (error) {
      console.error("Error creating column:", error);
      res.status(500).json({ error: "Failed to create column" });
    }
  }
}

module.exports = new ColumnController();
