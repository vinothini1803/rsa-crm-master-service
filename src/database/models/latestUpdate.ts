import { DataTypes } from "sequelize";
import sequelize from "../connection";

const latestUpdate = sequelize.define(
  "latestUpdate",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isFixed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    fromDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    toDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    displayOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspPortalId: {
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

export default latestUpdate;
