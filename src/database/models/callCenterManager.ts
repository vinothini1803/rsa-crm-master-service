import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CallCenter } from ".";

const callCenterManager = sequelize.define(
  "callCenterManager",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    callCenterId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    managerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
    tableName: "callCenterManagers",
  }
);

CallCenter.hasMany(callCenterManager, {
  foreignKey: "callCenterId",
  as: "callCenterManagers",
});

export default callCenterManager;
