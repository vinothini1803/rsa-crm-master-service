import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { OwnPatrolVehicle } from ".";

const ownPatrolVehicleTechnicianLogs = sequelize.define(
  "ownPatrolVehicleTechnicianLogs",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    ownPatrolVehicleId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    aspMechanicId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "ownPatrolVehicleTechnicianLogs",
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships ---------------------------------

OwnPatrolVehicle.hasMany(ownPatrolVehicleTechnicianLogs, {
  foreignKey: "ownPatrolVehicleId",
});

export default ownPatrolVehicleTechnicianLogs;
