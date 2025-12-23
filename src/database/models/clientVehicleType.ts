import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Client, VehicleType } from ".";

const clientVehicleType = sequelize.define(
  "clientVehicleType",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    vehicleTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    tableName: "clientVehicleTypes",
  }
);

Client.hasMany(clientVehicleType, {
  as: "vehicleTypes",
  foreignKey: "clientId",
});

clientVehicleType.belongsTo(VehicleType, {
  foreignKey: "vehicleTypeId",
});

export default clientVehicleType;
