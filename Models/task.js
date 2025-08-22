const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Task", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    timeStart: { type: DataTypes.DATE },
    timeEnd: { type: DataTypes.DATE },
    status: { type: DataTypes.STRING, defaultValue: "To Do" }, // optional
    priority: { type: DataTypes.STRING, defaultValue: "Medium" },
    order: { type: DataTypes.INTEGER }, // order in column
    columnId: { type: DataTypes.INTEGER, allowNull: false },
  });
};
