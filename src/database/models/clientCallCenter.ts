import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CallCenter, Client } from "./index";

const clientCallCenter = sequelize.define(
  "clientCallCenter",
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
    callCenterId: {
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
    tableName: "clientCallCenters",
  }
);

//Relationships ---------------------------------

CallCenter.hasMany(clientCallCenter, {
  as: "clients",
  foreignKey: "callCenterId",
});

Client.hasMany(clientCallCenter, {
  as: "callCenters",
  foreignKey: "clientId",
});

clientCallCenter.belongsTo(CallCenter, {
  foreignKey: "callCenterId",
});

export default clientCallCenter;
