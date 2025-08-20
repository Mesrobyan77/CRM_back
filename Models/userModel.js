const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  return sequelize.define("User", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: true },
    phoneNumber: { type: DataTypes.STRING, allowNull: true },
    avatar: { type: DataTypes.STRING, allowNull: true },
    authProvider: { type: DataTypes.STRING, allowNull: true },
    verifyCode: { type: DataTypes.STRING, allowNull: true },
    isEmailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  });
};
