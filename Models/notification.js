// models/notification.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Notification", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    message: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    taskId: { type: DataTypes.INTEGER, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    subtaskId: { type: DataTypes.INTEGER, allowNull: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: true },
    boardId: { type: DataTypes.INTEGER, allowNull: true },
    columnId: { type: DataTypes.INTEGER, allowNull: true },
  });
};
