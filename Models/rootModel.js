const sequelize = require("../config/db");

const userModel = require("./userModel");
const workspaceModel = require("./workspace");
const boardModel = require("./board");
const columnModel = require("./column");
const taskModel = require("./task");
const subtaskModel = require("./subtask");
const commentModel = require("./comment");
const userTaskModel = require("./userTask");
const columnNameModel = require("./columnName");
const notificationModel = require("./notification");

const User = userModel(sequelize);
const Workspace = workspaceModel(sequelize);
const Board = boardModel(sequelize);
const Column = columnModel(sequelize);
const Task = taskModel(sequelize);
const Subtask = subtaskModel(sequelize);
const Comment = commentModel(sequelize);
const UserTask = userTaskModel(sequelize);
const ColumnName = columnNameModel(sequelize);
const Notification = notificationModel(sequelize);

Workspace.hasMany(Board, { foreignKey: "workspaceId" });
Board.belongsTo(Workspace, { foreignKey: "workspaceId" });

// Board → Column
Board.hasMany(Column, { foreignKey: "boardId" });
Column.belongsTo(Board, { foreignKey: "boardId" });

// Column → Task
Column.hasMany(Task, { foreignKey: "columnId" });
Task.belongsTo(Column, { foreignKey: "columnId" });

// Task → Subtask
Task.hasMany(Subtask, { foreignKey: "taskId" });
Subtask.belongsTo(Task, { foreignKey: "taskId" });

// Task ↔ User (Many-to-Many)
User.belongsToMany(Task, { through: UserTask, foreignKey: "userId" });
Task.belongsToMany(User, { through: UserTask, foreignKey: "taskId" });

// Task → Comment
Task.hasMany(Comment, { foreignKey: "taskId" });
Comment.belongsTo(Task, { foreignKey: "taskId" });

// Comment → User
User.hasMany(Comment, { foreignKey: "userId" });
Comment.belongsTo(User, { foreignKey: "userId" });

Task.belongsToMany(User, {
  through: UserTask,
  as: "assignedUsers",
  foreignKey: "taskId",
});
User.belongsToMany(Task, {
  through: UserTask,
  as: "assignedTasks",
  foreignKey: "userId",
});

Task.hasMany(Subtask, { foreignKey: "taskId" });
Subtask.belongsTo(Task, { foreignKey: "taskId" });

// Column → ColumnName
Column.belongsTo(ColumnName, { foreignKey: "columnNameId" });
ColumnName.hasMany(Column, { foreignKey: "columnNameId" });

User.hasMany(Notification, { foreignKey: "userId" });
Notification.belongsTo(User, { foreignKey: "userId" });

Task.hasMany(Notification, { foreignKey: "taskId" });
Notification.belongsTo(Task, { foreignKey: "taskId" });

User.hasMany(Notification, { foreignKey: "userId" });
Notification.belongsTo(User, { foreignKey: "userId" });

Workspace.hasMany(Notification, { foreignKey: "workspaceId" });
Notification.belongsTo(Workspace, { foreignKey: "workspaceId" });

// Task -> Column
Task.belongsTo(Column, { foreignKey: "columnId" });
Column.hasMany(Task, { foreignKey: "columnId" });

// Column -> Board
Column.belongsTo(Board, { foreignKey: "boardId" });
Board.hasMany(Column, { foreignKey: "boardId" });

// Task -> SubTask
Task.hasMany(Subtask, { foreignKey: "taskId", as: "SubTasks" });
Subtask.belongsTo(Task, { foreignKey: "taskId" });

User.hasMany(Notification, { foreignKey: "userId" });
Notification.belongsTo(User, { foreignKey: "userId" });
Task.hasMany(Notification, { foreignKey: "taskId" });
Notification.belongsTo(Task, { foreignKey: "taskId" });
Subtask.hasMany(Notification, { foreignKey: "subtaskId" });
Notification.belongsTo(Subtask, { foreignKey: "subtaskId" });
User.hasMany(Notification, { foreignKey: "userId" });
Notification.belongsTo(User, { foreignKey: "userId" });
Board.hasMany(Notification, { foreignKey: "boardId" });
Notification.belongsTo(Board, { foreignKey: "boardId" });
Column.hasMany(Notification, { foreignKey: "columnId" });
Notification.belongsTo(Column, { foreignKey: "columnId" });
User.hasMany(Notification, { foreignKey: "userId" });
Notification.belongsTo(User, { foreignKey: "userId" });
Workspace.hasMany(Notification, { foreignKey: "workspaceId" });
Notification.belongsTo(Workspace, { foreignKey: "workspaceId" });
Board.hasMany(Notification, { foreignKey: "boardId" });
Notification.belongsTo(Board, { foreignKey: "boardId" });
// Export everything
module.exports = {
  sequelize,
  User,
  Workspace,
  Board,
  Column,
  Task,
  Subtask,
  Comment,
  UserTask,
  ColumnName,
  Notification,
};

// // routes/index.js
// const express = require('express');
// const router = express.Router();
// const userTaskController = require('../controllers/userTaskController');
// const commentController = require('../controllers/commentController');
// const taskController = require('../controllers/taskController');
// const notificationController = require('../controllers/notificationController');

// router.post('/user-task', userTaskController.assignUserToTask);
// router.post('/comment', commentController.createComment);
// router.put('/task/:taskId', taskController.updateTask);
// router.get('/notifications/:userId', notificationController.getNotifications);
// router.put('/notifications/:notificationId/read', notificationController.markNotificationAsRead);

// module.exports = router;
