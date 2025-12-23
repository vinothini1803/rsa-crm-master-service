import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Config, CaseStatus, ActivityStatus } from "./index";

const milestone = sequelize.define(
  "milestones",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    milestoneName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    remainder: {
      type: DataTypes.TIME,
      allowNull: true,
    },
    toolTipValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    prevMilestoneId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'milestones',
        key: 'id',
      },
    },
    caseStatusId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: CaseStatus,
        key: 'id',
      },
    },
    activityStatusId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ActivityStatus,
        key: 'id',
      },
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

milestone.belongsTo(milestone, {
  foreignKey: "prevMilestoneId",
});

milestone.belongsTo(CaseStatus, {
  foreignKey: "caseStatusId",
});

milestone.belongsTo(ActivityStatus, {
  foreignKey: "ActivityStatusId",
});
export default milestone;
