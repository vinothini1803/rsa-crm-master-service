import { Op, Sequelize } from "sequelize";
import { AnswerType } from "../database/models/index";
import { Request, Response } from "express";
import sequelize from "../database/connection";
import moment from "moment-timezone";
import Utils from "../lib/utils";

class AnswerTypeController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() { }

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType } = req.query;

      let where: any = {};

      let answerTypes = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }
        answerTypes = await AnswerType.findAll({
          where,
          attributes: ["id", "name", "fieldType"],
          order: [["id", "asc"]],
        });

        if (answerTypes.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        if (search) {
          where[Op.or] = [
            Sequelize.literal(
              `IF (answerType.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%"`
            ),
            { name: { [Op.like]: `%${search}%` } },
            { fieldType: { [Op.like]: `%${search}%` } },
          ];
        }

        if (status) {
          if (status.toLowerCase() == "active") {
            where.deletedAt = {
              [Op.is]: null,
            };
          } else if (status.toLowerCase() == "inactive") {
            where.deletedAt = {
              [Op.not]: null,
            };
          }
        }

        let limitValue: number = AnswerTypeController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        let offsetValue: number = AnswerTypeController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        answerTypes = await AnswerType.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "fieldType",
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(answerType.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (answerType.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (answerTypes.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: answerTypes,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getFormData = async (req: Request, res: Response) => {
    try {
      const { answerTypeId } = req.query;
      let answerTypeData = null;

      if (answerTypeId) {
        const answerTypeExists: any = await AnswerType.findOne({
          where: {
            id: answerTypeId,
          },
          paranoid: false,
        });

        if (!answerTypeExists) {
          return res.status(200).json({
            success: false,
            error: "Answer type not found",
          });
        }

        answerTypeData = {
          id: answerTypeExists.dataValues.id,
          name: answerTypeExists.dataValues.name,
          fieldType: answerTypeExists.dataValues.fieldType,
          options: answerTypeExists.dataValues.options
            ? JSON.parse(answerTypeExists.dataValues.options)
            : [],
          conditionalOptions: answerTypeExists.dataValues.conditionalOptions
            ? JSON.parse(answerTypeExists.dataValues.conditionalOptions)
            : [],
          status: answerTypeExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        answerType: answerTypeData,
      };
      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  delete = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        answerTypeIds: "required|array",
        "answerTypeIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { answerTypeIds } = payload;

      if (answerTypeIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one answer type",
        });
      }

      for (const answerTypeId of answerTypeIds) {
        const answerTypeExists = await AnswerType.findOne({
          where: {
            id: answerTypeId,
          },
          paranoid: false,
        });
        if (!answerTypeExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Answer type (${answerTypeId}) not found`,
          });
        }

        await AnswerType.destroy({
          where: {
            id: answerTypeId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Answer type deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        status: "required|numeric",
        answerTypeIds: "required|array",
        "answerTypeIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { answerTypeIds, status, updatedById, deletedById } = payload;
      if (answerTypeIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one answer type",
        });
      }

      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const answerTypeId of answerTypeIds) {
        const answerTypeExists = await AnswerType.findOne({
          where: {
            id: answerTypeId,
          },
          paranoid: false,
        });
        if (!answerTypeExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Answer type (${answerTypeId}) not found`,
          });
        }

        await AnswerType.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: answerTypeId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Answer type status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  saveAndUpdate = async (req: any, res: any) => {
    return await save(req, res);
  };
}

async function save(req: any, res: any) {
  const transaction = await sequelize.transaction();
  try {
    let payload = req.body;

    const v = {
      answerTypeId: "numeric",
      name: "required|string|minLength:1|maxLength:255",
      fieldType: "required|string",
      options: "array",
      "options.*": "string",
      conditionalOptions: "array",
      "conditionalOptions.*": "string",
      status: "required|numeric",
    };

    const errors = await Utils.validateParams(payload, v);

    if (errors) {
      await transaction.rollback();
      return res.status(200).json({
        success: false,
        errors: errors,
      });
    }

    const { answerTypeId, name, fieldType, options, conditionalOptions, ...inputData } = payload;
    const answerTypeName = name.trim();

    // Validate fieldType
    const validFieldTypes = ["option", "text", "option_text", "option_conditional", "rating"];
    if (!validFieldTypes.includes(fieldType)) {
      await transaction.rollback();
      return res.status(200).json({
        success: false,
        error: "Invalid field type",
      });
    }

    // Validate options for field types that require them
    if (
      fieldType === "option" ||
      fieldType === "option_text" ||
      fieldType === "option_conditional" ||
      fieldType === "rating"
    ) {
      if (!options || !Array.isArray(options) || options.length === 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "At least one option is required for this field type",
        });
      }
      const validOptions = options.filter(opt => opt && opt.trim() !== "");
      if (validOptions.length === 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "At least one valid option is required for this field type",
        });
      }
    }

    // Validate conditionalOptions for option_conditional field type
    if (fieldType === "option_conditional") {
      if (!conditionalOptions || !Array.isArray(conditionalOptions) || conditionalOptions.length === 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "At least one option must be selected to trigger the text field for option_conditional field type",
        });
      }
      const validConditionalOptions = conditionalOptions.filter(opt => opt && opt.trim() !== "");
      if (validConditionalOptions.length === 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "At least one valid option must be selected to trigger the text field for option_conditional field type",
        });
      }

      // Validate that conditionalOptions are a subset of options
      if (options && Array.isArray(options) && options.length > 0) {
        const validOptions = options.filter(opt => opt && opt.trim() !== "");
        const invalidConditionalOptions = validConditionalOptions.filter(
          condOpt => !validOptions.includes(condOpt)
        );
        if (invalidConditionalOptions.length > 0) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Conditional options must be a subset of the available options. Invalid options: ${invalidConditionalOptions.join(", ")}`,
          });
        }
      }
    }

    if (answerTypeId) {
      const answerType = await AnswerType.findOne({
        where: {
          id: answerTypeId,
        },
        paranoid: false,
      });
      if (!answerType) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Answer type not found",
        });
      }

      const answerTypeAlreadyExists = await AnswerType.findOne({
        where: {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("name")),
              Sequelize.fn("LOWER", answerTypeName)
            ),
            {
              id: {
                [Op.ne]: answerTypeId,
              },
            },
          ],
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (answerTypeAlreadyExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Answer type name is already taken",
        });
      }
    } else {
      const answerTypeAlreadyExists = await AnswerType.findOne({
        where: {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("name")),
              Sequelize.fn("LOWER", answerTypeName)
            ),
          ],
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (answerTypeAlreadyExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Answer type name is already taken",
        });
      }
    }

    let deletedAt = null;
    let deletedById = null;
    if (inputData.status == 0) {
      deletedAt = new Date();
      deletedById = inputData.authUserId;
    }

    // Prepare options and conditionalOptions as JSON strings
    let optionsValue = null;
    if (options && Array.isArray(options) && options.length > 0) {
      const validOptions = options.filter(opt => opt && opt.trim() !== "");
      if (validOptions.length > 0) {
        optionsValue = JSON.stringify(validOptions);
      }
    }

    let conditionalOptionsValue = null;
    if (fieldType === "option_conditional" && conditionalOptions && Array.isArray(conditionalOptions) && conditionalOptions.length > 0) {
      const validConditionalOptions = conditionalOptions.filter(opt => opt && opt.trim() !== "");
      if (validConditionalOptions.length > 0) {
        conditionalOptionsValue = JSON.stringify(validConditionalOptions);
      }
    }

    const data: any = {
      name: answerTypeName,
      fieldType: fieldType,
      options: optionsValue,
      conditionalOptions: conditionalOptionsValue,
      deletedById: deletedById,
      deletedAt: deletedAt,
      updatedById: inputData.authUserId,
    };

    let message = null;
    if (answerTypeId) {
      await AnswerType.update(data, {
        where: {
          id: answerTypeId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Answer type updated successfully";
    } else {
      data.createdById = inputData.authUserId;
      await AnswerType.create(data, {
        transaction: transaction,
      });
      message = "Answer type created successfully";
    }

    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: message,
    });
  } catch (error: any) {
    await transaction.rollback();

    // Handle unique constraint violation
    if (error.name === 'SequelizeUniqueConstraintError' || error.original?.code === 'ER_DUP_ENTRY') {
      return res.status(200).json({
        success: false,
        error: "Answer type name is already taken",
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export default new AnswerTypeController();

