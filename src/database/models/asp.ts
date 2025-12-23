import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { State, City, Config } from "../models/index";

const asp = sequelize.define(
  "asp",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    tierId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    axaptaCode: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    salutationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    workingHourId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    code: {
      type: DataTypes.STRING(60),
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    workshopName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    whatsAppNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    contactNumber: {
      type: DataTypes.STRING(20),
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
    isOwnPatrol: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    rmId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    rmName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rmContactNumber: {
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
    addressLineOne: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    addressLineTwo: {
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
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    hasMechanic: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    isFinanceAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: 0,
    },
    financeAdminId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    lastLatitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    lastLongitude: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    lastLocationUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastLocationAttendanceLogId: {
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

asp.belongsTo(Config, {
  foreignKey: "tierId",
  as: "tier",
});

asp.belongsTo(State, {
  foreignKey: "stateId",
});

asp.belongsTo(City, {
  foreignKey: "cityId",
});

asp.belongsTo(Config, {
  foreignKey: "salutationId",
  as: "salutation",
});

asp.belongsTo(Config, {
  foreignKey: "workingHourId",
  as: "workingHour",
});

asp.belongsTo(Config, {
  foreignKey: "performanceId",
  as: "performance",
});

asp.belongsTo(Config, {
  foreignKey: "priorityId",
  as: "priority",
});

asp.belongsTo(asp, {
  foreignKey: "financeAdminId",
  as: "financeAdmin",
});

export default asp;
