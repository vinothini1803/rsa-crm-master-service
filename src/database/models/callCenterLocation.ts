import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CallCenter } from "./index";

const callCenterLocation = sequelize.define(
  "callCenterLocation",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    callCenterId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
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
  }
);

//Relationships ---------------------------------

callCenterLocation.belongsTo(CallCenter, {
  foreignKey: "callCenterId",
});
CallCenter.hasMany(callCenterLocation, {
  as: "locations",
  foreignKey: "callCenterId",
});

export default callCenterLocation;
