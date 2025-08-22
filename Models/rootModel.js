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

const User = userModel(sequelize);
const Workspace = workspaceModel(sequelize);
const Board = boardModel(sequelize);
const Column = columnModel(sequelize);
const Task = taskModel(sequelize);
const Subtask = subtaskModel(sequelize);
const Comment = commentModel(sequelize);
const UserTask = userTaskModel(sequelize);
const ColumnName = columnNameModel(sequelize);

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
};
