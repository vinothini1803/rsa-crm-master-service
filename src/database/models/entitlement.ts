import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Config } from "../models/index";

const entitlement = sequelize.define(
  "entitlement",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    unitId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    hasLimit: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
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

entitlement.belongsTo(Config, {
  as: "unit",
  foreignKey: "unitId",
});

export default entitlement;
