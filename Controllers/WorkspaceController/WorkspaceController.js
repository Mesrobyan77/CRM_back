const { Workspace, Notification, User } = require("../../Models/rootModel");
const { userSockets, getIO } = require("../../server");

class WorkspaceController {
  async addWorkspace(req, res) {
    try {
      const { name } = req.body;
      if (!name)
        return res.status(400).json({ error: "Workspace name required" });

      const workspace = await Workspace.create({ name });
      const createdUser = await User.findByPk(req.user.id);

      const notification = {
        title: "Workspace Created",
        message: `New workspace created: ${name}`,
        workspaceId: workspace.id,
        createdBy: createdUser ? createdUser.userName : "Unknown",
        timestamp: new Date(),
        icon: "workspace",
      };

      const users = await User.findAll();

      const io = getIO(); // get io instance safely

      for (const user of users) {
        if (!user) continue;

        await Notification.create({
          message: notification.message,
          userId: user.id,
          workspaceId: workspace.id,
        });

        const socketId = userSockets.get(user.id.toString());
        if (socketId && io) {
          io.to(socketId).emit("notification", notification);
        }
      }

      res.status(201).json({ message: "Workspace created", workspace });
    } catch (error) {
      console.error("Error creating workspace:", error);
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
