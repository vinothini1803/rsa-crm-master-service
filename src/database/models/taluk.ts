import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { City } from "../models/index";

const taluk = sequelize.define(
  "taluk",
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
      allowNull: false,
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
    tableName: "taluks",
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships ---------------------------------

//DO NOT CREATE ALIAS NAME(SINCE WE USED WITHOUT ALIAS IN REPORT)

taluk.hasMany(City, {
  foreignKey: "talukId",
});
City.belongsTo(taluk, {
  foreignKey: "talukId",
});

export default taluk;
