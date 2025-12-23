import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { City, OwnPatrolVehicle } from ".";

const ownPatrolVehicleHelper = sequelize.define(
  "ownPatrolVehicleHelper",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    mobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    ownPatrolVehicleId: {
      type: DataTypes.INTEGER.UNSIGNED,
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
    tableName: "ownPatrolVehicleHelpers",
    timestamps: true,
    paranoid: true,
  }
);

ownPatrolVehicleHelper.belongsTo(City, {
  foreignKey: "cityId",
  as: "city",
});

ownPatrolVehicleHelper.belongsTo(OwnPatrolVehicle, {
  as: "ownPatrolVehicle",
  foreignKey: "ownPatrolVehicleId",
});

export default ownPatrolVehicleHelper;
