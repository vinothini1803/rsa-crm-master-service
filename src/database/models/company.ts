import { DataTypes } from "sequelize";
import sequelize from "../connection";

const company = sequelize.define(
  "company",
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
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    legalName: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    tradeName: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    gstin: {
      type: DataTypes.STRING(24),
      allowNull: true,
    },
    phoneNumber: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
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
    tableName: "companies",
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships ---------------------------------

export default company;
