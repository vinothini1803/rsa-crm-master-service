import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Client } from "../models/index";

const serialNumberCategories = sequelize.define(
  "serialNumberCategories",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    shortName: {
      type: DataTypes.STRING(60),
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
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships ---------------------------------

serialNumberCategories.hasOne(Client, {
  as: "client",
  foreignKey: "deliveryRequestSerialNumberCategoryId",
});
Client.belongsTo(serialNumberCategories, {
  as: "serialNumberCategory",
  foreignKey: "deliveryRequestSerialNumberCategoryId",
});

export default serialNumberCategories;
