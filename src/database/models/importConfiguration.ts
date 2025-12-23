import { DataTypes } from "sequelize";
import sequelize from "../connection";

const importConfiguration = sequelize.define(
  "importConfiguration",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    importTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    excelColumnName: {
      type: DataTypes.STRING(199),
      allowNull: true,
    },
    isRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    tableName: "importConfigurations",
    timestamps: true,
    paranoid: true,
  }
);

export default importConfiguration;
