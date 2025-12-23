import { DataTypes } from "sequelize";
import sequelize from "../connection";

const answerType = sequelize.define(
  "answerType",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    fieldType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    options: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    conditionalOptions: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "JSON array of option values that trigger the text field for option_conditional type",
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

export default answerType;

