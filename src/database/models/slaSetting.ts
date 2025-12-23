import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Config } from "./index";

const slaSetting = sequelize.define(
  "slaSetting",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    caseTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    time: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    roleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    locationTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    createdById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    updatedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deletedById: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deletedAt: {
      allowNull: true,
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "slaSettings",
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

// Relationships ---------------------------------

slaSetting.belongsTo(Config, {
  as: "caseType",
  foreignKey: "caseTypeId",
});
slaSetting.belongsTo(Config, {
  as: "type",
  foreignKey: "typeId",
});

export default slaSetting;
