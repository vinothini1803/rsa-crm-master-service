import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Asp } from "./index";

const ownPatrolVehicleNewTechnician = sequelize.define(
  "ownPatrolVehicleNewTechnician",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    aspId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    aspMechanicId: {
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

Asp.hasMany(ownPatrolVehicleNewTechnician, {
  foreignKey: "aspId",
  as: "newTechnicians",
});
ownPatrolVehicleNewTechnician.belongsTo(Asp, {
  foreignKey: "aspId",
});

export default ownPatrolVehicleNewTechnician;
