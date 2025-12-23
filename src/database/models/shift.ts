import { DataTypes } from "sequelize";
import sequelize from "../connection";

const shift = sequelize.define(
  "shift",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    value: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    typeId: {
      type: DataTypes.TINYINT,
      allowNull: true,
    },
    displayOrder: {
      type: DataTypes.INTEGER,
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
    tableName: "shifts",
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

//Relationships ---------------------------------

export default shift;
