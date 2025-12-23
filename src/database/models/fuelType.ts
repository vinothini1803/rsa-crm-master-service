import { DataTypes } from "sequelize";
import sequelize from "../connection";

const fuelType = sequelize.define(
  "fuelType",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(191),
      unique: true,
      allowNull: true,
    },
    displayName: {
      type: DataTypes.STRING(191),
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
    tableName: "fuelTypes",
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

export default fuelType;
