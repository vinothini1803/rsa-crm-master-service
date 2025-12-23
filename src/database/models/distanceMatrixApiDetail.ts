import { DataTypes } from "sequelize";
import sequelize from "../connection";

const distanceMatrixApiDetail = sequelize.define(
  "distanceMatrixApiDetail",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    fromLocation: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    toLocation: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    response: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "distanceMatrixApiDetails",
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

export default distanceMatrixApiDetail;
