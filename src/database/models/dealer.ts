import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { State, City } from "../models/index";

const dealer = sequelize.define(
  "dealer",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    groupCode: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    code: {
      type: DataTypes.STRING(60),
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    legalName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tradeName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mobileNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gstin: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    pan: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    cin: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    isExclusive: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    dealerForId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    mechanicalType: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    bodyPartType: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    rsaPersonName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rsaPersonNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    rsaPersonAlternateNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    smName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    smNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    smAlternateNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    oemAsmName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    oemAsmNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    oemAsmAlternateNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    addressLineOne: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    addressLineTwo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    correspondenceAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    stateId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    cityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    area: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    lat: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    long: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    serviceRmId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    salesRmId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    zoneId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    walletBalance: {
      type: DataTypes.DECIMAL(12, 2).UNSIGNED,
      allowNull: true,
    },
    autoCancelForDelivery: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    financeAdminUserId: {
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

dealer.belongsTo(State, {
  foreignKey: "stateId",
});
dealer.belongsTo(City, {
  foreignKey: "cityId",
});

export default dealer;
