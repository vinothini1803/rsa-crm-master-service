import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { State, Config } from "../models/index";
import ServiceOrganisation from "./serviceOrganisation";
import Region from "./region";

const city = sequelize.define(
  "city",
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
    talukId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    districtId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    latitude: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    locationTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    municipalLimitId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    nearestCityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    locationCategoryId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    rmId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    networkHeadId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    customerExperienceHeadId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    commandCentreHeadId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    serviceHeadId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    boHeadId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    stateId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    serviceOrganisationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    regionId: {
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

State.hasMany(city, {
  as: "cities",
  foreignKey: "stateId",
});
city.belongsTo(State, {
  as: "state",
  foreignKey: "stateId",
});
city.belongsTo(Config, {
  as: "locationType",
  foreignKey: "locationTypeId",
});
city.belongsTo(Config, {
  as: "municipalLimit",
  foreignKey: "municipalLimitId",
});
city.belongsTo(Config, {
  as: "locationCategory",
  foreignKey: "locationCategoryId",
});
city.belongsTo(ServiceOrganisation, {
  as: "serviceOrganisation",
  foreignKey: "serviceOrganisationId",
});
city.belongsTo(Region, {
  as: "region",
  foreignKey: "regionId",
});

export default city;
