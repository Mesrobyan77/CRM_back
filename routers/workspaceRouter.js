const express = require('express');
const authMiddleware = require('../middleware/authMiddleware/authMiddleware');
const WorkspaceController = require('../Controllers/WorkspaceController/WorkspaceController');
const workspaceRouter = express.Router();

workspaceRouter.post('/api/home/workspace', authMiddleware, WorkspaceController.addWorkspace);
workspaceRouter.get('/api/home/workspace', authMiddleware, WorkspaceController.getAllWorkspaces);

module.exports = workspaceRouter;