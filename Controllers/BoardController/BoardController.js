const {
  Board,
  Column,
  Task,
  Subtask,
  User,
  Comment,
} = require("../../Models/rootModel");

class BoardController {
  async addBoard(req, res) {
    try {
      const { name, workspaceId } = req.body;
      if (!name || !workspaceId)
        return res.status(400).json({ error: "Name & workspaceId required" });

      const board = await Board.create({ name, workspaceId });
      res.json({ message: "Board created", board });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create board" });
    }
  }

  // async getAllBoards(req, res) {
  //   try {
  //     const boards = await Board.findAll({
  //       include: [
  //         {
  //           model:Column,
  //         },
  //         { model: Task},
  //       ],
  //     });
  //     res.json(boards);
  //   } catch (error) {
  //     console.error("Error fetching boards:", error);
  //     res.status(500).json({ error: "Failed to fetch boards" });
  //   }
  // }

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
                  {
                    model: Subtask,
                  },
                  {
                    model: User,
                  },
                  {
                    model: Comment,
                    include: [
                      {
                        model: User,
                      },
                    ],
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
