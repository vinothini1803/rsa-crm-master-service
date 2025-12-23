import { DataTypes } from "sequelize";
import sequelize from "../connection";
import {
  Asp,
  ServiceOrganisation,
  VehicleMake,
  VehicleModel,
  VehicleType,
  AspMechanic,
} from "./index";

const ownPatrolVehicle = sequelize.define(
  "ownPatrolVehicle",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    vehicleRegistrationNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    vehicleTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    vehicleMakeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    vehicleModelId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    gpsDeviceId: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    serviceOrganisationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    lastGpsCaptured: {
      type: DataTypes.STRING(191),
      allowNull: true,
    },
    inActiveReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    inActiveFromDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    inActiveToDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isActiveReminderSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
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

ownPatrolVehicle.belongsTo(Asp, {
  foreignKey: "aspId",
});

Asp.hasOne(ownPatrolVehicle, {
  foreignKey: "aspId",
});

ownPatrolVehicle.belongsTo(VehicleType, {
  foreignKey: "vehicleTypeId",
  as: "vehicleType",
});

ownPatrolVehicle.belongsTo(ServiceOrganisation, {
  foreignKey: "serviceOrganisationId",
});

ownPatrolVehicle.belongsTo(VehicleMake, {
  foreignKey: "vehicleMakeId",
  as: "vehicleMake",
});

ownPatrolVehicle.belongsTo(VehicleModel, {
  foreignKey: "vehicleModelId",
  as: "vehicleModel",
});

AspMechanic.belongsTo(ownPatrolVehicle, {
  foreignKey: "cocoVehicleId",
  as: "cocoVehicle",
});

export default ownPatrolVehicle;
