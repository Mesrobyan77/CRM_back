const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Subtask", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    isDone: { type: DataTypes.BOOLEAN, defaultValue: false },
    taskId: { type: DataTypes.INTEGER, allowNull: false },
  });
};
