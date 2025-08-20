const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("Board", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false },
  });
};
