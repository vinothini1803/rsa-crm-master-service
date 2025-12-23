import { DataTypes } from "sequelize";
import sequelize from "../connection";

const mailConfiguration = sequelize.define(
  "mailConfiguration",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    configId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    toEmail: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ccEmail: {
      type: DataTypes.TEXT,
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
    tableName: "mailConfigurations"
  }
);

export default mailConfiguration;
