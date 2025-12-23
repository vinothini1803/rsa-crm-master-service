import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { CaseSubject, AnswerType } from "./index";

const caseSubjectQuestionnaire = sequelize.define(
  "caseSubjectQuestionnaire",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    caseSubjectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    answerTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    sequence: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: 0,
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

//Relationships
CaseSubject.hasMany(caseSubjectQuestionnaire, {
  as: "questionnaires",
  foreignKey: "caseSubjectId",
});

caseSubjectQuestionnaire.belongsTo(CaseSubject, {
  as: "caseSubject",
  foreignKey: "caseSubjectId",
});

caseSubjectQuestionnaire.belongsTo(AnswerType, {
  as: "answerType",
  foreignKey: "answerTypeId",
});

AnswerType.hasMany(caseSubjectQuestionnaire, {
  as: "questionnaires",
  foreignKey: "answerTypeId",
});

export default caseSubjectQuestionnaire;

