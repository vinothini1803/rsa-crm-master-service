import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Config, ConfigType, State, City } from "./index";

const address = sequelize.define(
  "address",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    addressTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    addressOfId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    entityId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    address: {
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
    pincode: {
      type: DataTypes.STRING(10),
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
  }
);

//Relationships ---------------------------------

address.belongsTo(ConfigType, {
  as: "type",
  foreignKey: "addressTypeId",
});

address.belongsTo(Config, {
  as: "addressOf",
  foreignKey: "addressOfId",
});

address.belongsTo(State, {
  foreignKey: "stateId",
});

address.belongsTo(City, {
  foreignKey: "cityId",
});

export default address;
