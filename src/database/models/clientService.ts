import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Service, Config } from "../models/index";

const clientService = sequelize.define(
  "clientService",
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
    serviceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    policyTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    membershipTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    totalService: {
      type: DataTypes.INTEGER,
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
    indexes: [
      {
        unique: true,
        name: "clientServices_unique",
        fields: ["clientId", "serviceId", "policyTypeId"],
      },
    ],
  }
);

//Relationships ---------------------------------
clientService.belongsTo(Service, {
  as: "service",
  foreignKey: "serviceId",
});

clientService.belongsTo(Config, {
  as: "policyType",
  foreignKey: "policyTypeId",
});

export default clientService;
