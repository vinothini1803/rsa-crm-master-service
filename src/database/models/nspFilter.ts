import { DataTypes } from "sequelize";
import sequelize from "../connection";

const nspFilter = sequelize.define(
  "nspFilter",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    limitQuery: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    havingQuery: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    kmLimit: {
      type: DataTypes.DECIMAL(10, 2).UNSIGNED,
      allowNull: true,
    },
    displayOrder: {
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
    indexes: [
      {
        unique: true,
        name: "nspFilters_uk",
        fields: ["typeId", "name"],
      },
    ],
  }
);

export default nspFilter;
