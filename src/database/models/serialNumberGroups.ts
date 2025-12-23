import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { SerialNumberCategories, FinancialYears } from "./index";

const serialNumberGroups = sequelize.define(
  "serialNumberGroups",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    financialYearId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    length: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    nextNumber: {
      type: DataTypes.INTEGER.UNSIGNED,
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
      allowNull: true,
      type: DataTypes.DATE,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
  }
);

//Relationships ---------------------------------

SerialNumberCategories.hasMany(serialNumberGroups, {
  foreignKey: "categoryId",
});
serialNumberGroups.belongsTo(SerialNumberCategories, {
  foreignKey: "categoryId",
});

FinancialYears.hasMany(serialNumberGroups, {
  foreignKey: "financialYearId",
});
serialNumberGroups.belongsTo(FinancialYears, {
  foreignKey: "financialYearId",
});

export default serialNumberGroups;
