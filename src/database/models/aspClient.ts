import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Asp, Client } from ".";

const aspClient = sequelize.define(
  "aspClient",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    aspId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
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
    tableName: "aspClients",
  }
);

Asp.hasMany(aspClient, {
  as: "clients",
  foreignKey: "aspId",
});

aspClient.belongsTo(Client, {
  as: "client",
  foreignKey: "clientId",
});
aspClient.belongsTo(Asp, { as: "asp", foreignKey: "aspId" });

export default aspClient;
