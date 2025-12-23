import { DataTypes } from "sequelize";
import sequelize from "../connection";
import AnswerType from "./answerType";

const feedbackQuestion = sequelize.define(
  "feedbackQuestion",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    callStatusId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    reportColumn: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Corresponding column name in customerFeedbackReportDetails table",
    },
    questionType: {
      type: DataTypes.ENUM(
        "customer_feedback",
        "satisfied_question",
        "not_satisfied_question",
        "not_connected_reason"
      ),
      allowNull: false,
    },
    parentQuestionId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment: "For conditional questions (e.g., questions under Satisfied or Not Satisfied)",
    },
    sequence: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      defaultValue: 0,
    },
    answerTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
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
    tableName: "feedbackQuestions",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships
feedbackQuestion.belongsTo(AnswerType, {
  as: "answerType",
  foreignKey: "answerTypeId",
});

export default feedbackQuestion;

