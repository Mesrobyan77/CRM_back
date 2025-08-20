const { Workspace } = require("../../Models/rootModel");
///+
class WorkspaceController {
  async addWorkspace(req, res) {
    try {
      const { name } = req.body;
      if (!name)
        return res.status(400).json({ error: "Workspace name required" });

      const workspace = await Workspace.create({ name });
      res.json({ message: "Workspace created", workspace });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create workspace" });
    }
  }

  async getAllWorkspaces(req, res) {
    try {
      const workspaces = await Workspace.findAll();
      res.json(workspaces);
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  }
}

module.exports = new WorkspaceController();
