import { Request, Response } from "express";
import { Language, Config, AnswerType } from "../database/models/index";
import FeedbackQuestionModel from "../database/models/feedbackQuestion";

class CustomerFeedbackController {
  constructor() { }

  getFormData = async (req: Request, res: Response) => {
    try {
      const languages = await Language.findAll({
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      });

      const callStatuses = await Config.findAll({
        where: {
          typeId: 91, // Customer Feedback Call Statuses
        },
        attributes: ["id", "name"],
        order: [["id", "ASC"]],
      });

      const data = {
        languages: languages,
        callStatuses: callStatuses,
      };

      return res.status(200).json({
        success: true,
        message: "Form data fetched successfully",
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getQuestionsByCallStatus = async (req: Request, res: Response) => {
    try {
      const { callStatusId, clientId } = req.query;

      if (!callStatusId) {
        return res.status(200).json({
          success: false,
          error: "Call status ID is required",
        });
      }

      if (!clientId) {
        return res.status(200).json({
          success: false,
          error: "Client ID is required",
        });
      }

      // Common query options
      const commonQueryOptions: any = {
        include: [
          {
            model: AnswerType,
            as: "answerType",
            attributes: ["id", "name", "fieldType", "options", "conditionalOptions"],
          },
        ],
        attributes: [
          "id",
          "question",
          "reportColumn",
          "questionType",
          "parentQuestionId",
          "sequence",
          "answerTypeId",
          "clientId",
        ],
        order: [["sequence", "ASC"]],
      };

      // Try to get client-specific questions first
      let questions = await FeedbackQuestionModel.findAll({
        where: {
          callStatusId: callStatusId,
          clientId: clientId,
          isActive: true,
          deletedAt: null,
        },
        include: commonQueryOptions.include,
        attributes: commonQueryOptions.attributes,
        order: commonQueryOptions.order,
      });

      // Organize questions using helper function
      const organizedQuestions = this.organizeQuestions(questions);

      return res.status(200).json({
        success: true,
        message: "Questions fetched successfully",
        data: organizedQuestions,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  // Helper function to organize questions with answerType parsing and formatting
  private organizeQuestions = (questions: any[]): any[] => {
    return questions.map((q: any) => {
      // Parse answerType options if they exist
      let answerTypeOptions = null;
      if (q.answerType?.options) {
        answerTypeOptions = typeof q.answerType.options === 'string'
          ? JSON.parse(q.answerType.options)
          : q.answerType.options;
      }

      // Parse conditionalOptions if they exist
      let conditionalOptions = null;
      if (q.answerType?.conditionalOptions) {
        conditionalOptions = typeof q.answerType.conditionalOptions === 'string'
          ? JSON.parse(q.answerType.conditionalOptions)
          : q.answerType.conditionalOptions;
      }

      // Format options for dropdown questions (fieldType === "option")
      // Convert answerType.options array to format: [{label: string, value: string}]
      let formattedOptions: any[] = [];
      if (q.answerType?.fieldType === "option" && answerTypeOptions && Array.isArray(answerTypeOptions)) {
        formattedOptions = answerTypeOptions.map((opt: any, index: number) => ({
          label: opt,
          value: opt,
          id: index + 1, // Use index as id for compatibility
        }));
      }

      const questionData: any = {
        id: q.id,
        question: q.question,
        reportColumn: q.reportColumn,
        questionType: q.questionType,
        parentQuestionId: q.parentQuestionId,
        sequence: q.sequence,
        answerType: {
          id: q.answerType?.id,
          name: q.answerType?.name,
          fieldType: q.answerType?.fieldType,
          options: answerTypeOptions,
          conditionalOptions: conditionalOptions,
        },
        options: formattedOptions, // Use formatted options from answerType
      };
      return questionData;
    });
  };
}

export default new CustomerFeedbackController();

