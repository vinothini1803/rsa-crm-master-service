import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { SerialNumberGroups, SerialNumberSegments } from "./index";

const serialNumberGroupSerialNumberSegments = sequelize.define(
  "serialNumberGroupSerialNumberSegments",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    serialNumberGroupId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    segmentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    displayOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
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

SerialNumberGroups.hasMany(serialNumberGroupSerialNumberSegments, {
  as: "segments",
  foreignKey: "serialNumberGroupId",
});
serialNumberGroupSerialNumberSegments.belongsTo(SerialNumberGroups, {
  as: "group",
  foreignKey: "serialNumberGroupId",
});

SerialNumberSegments.hasMany(serialNumberGroupSerialNumberSegments, {
  foreignKey: "segmentId",
});
serialNumberGroupSerialNumberSegments.belongsTo(SerialNumberSegments, {
  foreignKey: "segmentId",
});

export default serialNumberGroupSerialNumberSegments;
