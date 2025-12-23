import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Dealer, CaseSubject, Config, CallCenter } from "../models/index";

const client = sequelize.define(
  "client",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    invoiceName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    businessCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    legalName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tradeName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    axaptaCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    financialDimension: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gstin: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tollFreeNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contactNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    socialTypeID: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    accountCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    accountTypeID: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    customerTollFreeNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    asmTollFreeNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    nmTollFreeNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    fhTollFreeNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    displayOptionID: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspTollFreeNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    rmTollFreeNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    didNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    serviceContractID: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    parentAccountID: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    deliveryRequestSerialNumberCategoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    spocUserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    dialerCampaignName: {
      type: DataTypes.STRING(199),
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

client.hasMany(Dealer, {
  as: "dealers",
  foreignKey: "clientId",
});
Dealer.belongsTo(client, {
  as: "client",
  foreignKey: "clientId",
});
CaseSubject.belongsTo(client, {
  as: "client",
  foreignKey: "clientId",
});
Config.hasMany(client, {
  as: "clients",
  foreignKey: "businessCategoryId",
});
client.belongsTo(Config, {
  as: "businessCategory",
  foreignKey: "businessCategoryId",
});

export default client;
