import { DataTypes } from "sequelize";
import sequelize from "../connection";

const aspRejectedCcDetailReason = sequelize.define(
  "aspRejectedCcDetailReasons",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
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
    collate: "aspRejectedCcDetailReasons",
    timestamps: true,
    paranoid: true,
  }
);

export default aspRejectedCcDetailReason;
