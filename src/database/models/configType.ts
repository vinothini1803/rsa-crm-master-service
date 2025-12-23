import { DataTypes } from "sequelize";
import sequelize from "../connection";

const configType = sequelize.define(
  "configType",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: false,
  }
);

export default configType;
