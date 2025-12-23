import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Service } from "./index";

const subService = sequelize.define(
  "subService",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    serviceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    hasAspAssignment: {
      type: DataTypes.BOOLEAN,
      defaultValue: 1,
    },
    hasLimit: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    hasEntitlement: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    activityTime: {
      type: DataTypes.STRING,
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
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships ---------------------------------

subService.belongsTo(Service, { foreignKey: "serviceId" });
Service.hasMany(subService, { foreignKey: "serviceId" });

export default subService;
