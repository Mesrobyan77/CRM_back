const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Column", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    order: { type: DataTypes.INTEGER }, // for drag-and-drop sorting
    boardId: { type: DataTypes.INTEGER, allowNull: false },
    columnNameId: { type: DataTypes.INTEGER, allowNull: false}, // foreign key
  });
};
