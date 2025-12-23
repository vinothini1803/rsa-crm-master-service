import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Client, VehicleMake } from ".";

const clientVehicleMake = sequelize.define(
  "clientVehicleMake",
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
    vehicleMakeId: {
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
    tableName: "clientVehicleMakes",
  }
);

Client.hasMany(clientVehicleMake, {
  as: "vehicleMakes",
  foreignKey: "clientId",
});

clientVehicleMake.belongsTo(VehicleMake, {
  foreignKey: "vehicleMakeId",
});

export default clientVehicleMake;
