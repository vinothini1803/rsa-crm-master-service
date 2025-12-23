import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Asp, City, Config } from "./index";

const aspMechanic = sequelize.define(
  "aspMechanic",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    aspTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    aspId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    code: {
      type: DataTypes.STRING(60),
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
    alternateContactNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    businessHourId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    performanceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    priorityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    dynamicTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    locationCapturedViaId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    workStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    cocoVehicleId: {
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

aspMechanic.belongsTo(Asp, {
  foreignKey: "aspId",
});

Asp.hasMany(aspMechanic, {
  foreignKey: "aspId",
});

aspMechanic.belongsTo(Config, {
  foreignKey: "performanceId",
  as: "performance",
});

aspMechanic.belongsTo(Config, {
  foreignKey: "priorityId",
  as: "priority",
});

aspMechanic.belongsTo(Config, {
  foreignKey: "aspTypeId",
  as: "aspType",
});

aspMechanic.belongsTo(City, {
  foreignKey: "cityId",
  as: "city",
});

aspMechanic.belongsTo(Config, {
  foreignKey: "locationCapturedViaId",
  as: "locationCapturedVia",
});

aspMechanic.belongsTo(Config, {
  foreignKey: "dynamicTypeId",
  as: "dynamicType",
});

export default aspMechanic;
