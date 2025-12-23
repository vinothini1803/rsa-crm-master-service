import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { LatestUpdate } from ".";

const latestUpdateRole = sequelize.define(
  "latestUpdateRole",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    latestUpdateId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    roleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
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
  }
);

LatestUpdate.hasMany(latestUpdateRole, {
  foreignKey: "latestUpdateId",
});

export default latestUpdateRole;
