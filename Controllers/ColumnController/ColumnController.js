const { Column, ColumnName } = require("../../Models/rootModel");

class ColumnController {
  async addColumn(req, res) {
    try {
      const { name, boardId } = req.body;
      if (!name || !boardId) return res.status(400).json({ error: "Name & boardId required" });

      const [columnName] = await ColumnName.findOrCreate({ where: { name } });
      const column = await Column.create({ boardId, columnNameId: columnName.id, order: 0 });

      res.json({ message: "Column created", column });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create column" });
    }
  }
}

module.exports = new ColumnController();
