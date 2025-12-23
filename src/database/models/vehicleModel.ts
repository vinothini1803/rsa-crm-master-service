import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { VehicleType, VehicleMake } from "./index";

const vehicleModel = sequelize.define(
  "vehicleModel",
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
    vehicleMakeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    vehicleTypeId: {
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
    timestamps: true,
    paranoid: true,
  }
);

//Relationships ---------------------------------

vehicleModel.belongsTo(VehicleMake, { foreignKey: "vehicleMakeId" });
VehicleMake.hasMany(vehicleModel, { foreignKey: "vehicleMakeId" });

vehicleModel.belongsTo(VehicleType, { foreignKey: "vehicleTypeId" });
VehicleType.hasMany(vehicleModel, { foreignKey: "vehicleTypeId" });

export default vehicleModel;
