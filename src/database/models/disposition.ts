import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Config } from "./index";

const disposition = sequelize.define(
  "disposition",
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
    typeId: {
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
    indexes: [
      {
        unique: true,
        fields: ["name", "typeId"],
      },
    ],
  }
);

//Relationships ---------------------------------

disposition.belongsTo(Config, {
  as: "type",
  foreignKey: "typeId",
});

export default disposition;
