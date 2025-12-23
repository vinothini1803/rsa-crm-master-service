import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { ConfigType } from "./index";

const config = sequelize.define(
  "config",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    typeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: false,
  }
);

//Relationships ---------------------------------

ConfigType.hasMany(config, {
  as: "configs",
  foreignKey: "typeId",
});
config.belongsTo(ConfigType, {
  as: "type",
  foreignKey: "typeId",
});

export default config;
