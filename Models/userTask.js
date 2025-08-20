const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("UserTask", {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    taskId: { type: DataTypes.INTEGER, allowNull: false },
  });
};
