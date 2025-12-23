import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { City, Config, State } from "../models/index";

const nearestCity = sequelize.define(
  "nearestCity",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(191),
      unique: true,
      allowNull: false,
    },
    locationCategoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    stateId: {
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
    tableName: "nearestCities",
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships ---------------------------------

//DO NOT CREATE ALIAS NAME(SINCE WE USED WITHOUT ALIAS IN REPORT)

nearestCity.hasMany(City, {
  foreignKey: "nearestCityId",
});
City.belongsTo(nearestCity, {
  foreignKey: "nearestCityId",
});

nearestCity.belongsTo(Config, {
  as: "locationCategory",
  foreignKey: "locationCategoryId",
});

nearestCity.belongsTo(State, {
  foreignKey: "stateId",
});

export default nearestCity;
