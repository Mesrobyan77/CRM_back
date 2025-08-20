const { Subtask } = require("../../Models/rootModel");

class SubtaskController {
  async createSubtask(req, res) {
    try {
      const { taskId, title } = req.body;
      if (!taskId || !title)
        return res.status(400).json({ error: "TaskId & title required" });

      const subtask = await Subtask.create({ taskId, title, isDone: false });
      res.json({ message: "Subtask created", subtask });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create subtask" });
    }
  }


  async updateSubtask(req, res) {
    try {
      const { subtaskId } = req.params; 
      const { title, isDone } = req.body;


      const subtask = await Subtask.findByPk(subtaskId);
      if (!subtask) {
        return res.status(404).json({ error: "Subtask not found" });
      }


      if (title !== undefined) subtask.title = title;
      if (isDone !== undefined) subtask.isDone = isDone;

      await subtask.save();

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

      const subtask = await Subtask.findByPk(subtaskId);
      if (!subtask) {
        return res.status(404).json({ error: "Subtask not found" });
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
