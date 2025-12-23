import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Client, Entitlement } from ".";

const clientEntitlement = sequelize.define(
  "clientEntitlement",
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
    entitlementId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    limit: {
      type: DataTypes.INTEGER,
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
    tableName: "clientEntitlements",
  }
);

//Relationships ---------------------------------
clientEntitlement.belongsTo(Client, {
  foreignKey: "clientId",
});

clientEntitlement.belongsTo(Entitlement, {
  foreignKey: "entitlementId",
});

Client.hasMany(clientEntitlement, {
  as: "clientEntitlements",
  foreignKey: "clientId",
});

export default clientEntitlement;
