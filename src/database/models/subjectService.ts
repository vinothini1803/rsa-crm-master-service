import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CaseSubject } from "../models/index";

const subjectService = sequelize.define(
  "subjectService",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    subjectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    serviceId: {
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

CaseSubject.hasMany(subjectService, {
  as: "subjectServices",
  foreignKey: "subjectId",
});

export default subjectService;
