import { DataTypes } from "sequelize";
import sequelize from "../connection";

const callCenter = sequelize.define(
  "callCenter",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    callCentreHeadId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    isCommandCenter: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    phoneNumber: {
      type: DataTypes.STRING(15),
      allowNull: true,
    },
    tollFreeNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    whatsappNumber: {
      type: DataTypes.STRING(15),
      allowNull: true,
    },
    spocEmailIds: {
      type: DataTypes.TEXT,
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

export default callCenter;
