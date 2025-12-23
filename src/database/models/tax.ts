import { DataTypes } from "sequelize";
import sequelize from "../connection";

const tax = sequelize.define(
  "tax",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    percentage: {
      type: DataTypes.DECIMAL(4, 2).UNSIGNED,
      allowNull: true,
    },
    deletedAt: {
      allowNull: true,
      type: DataTypes.DATE,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

export default tax;
