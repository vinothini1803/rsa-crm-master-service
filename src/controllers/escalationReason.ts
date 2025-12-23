import { Op, Sequelize } from "sequelize";
import { EscalationReason } from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class EscalationController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let escalationReasons = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        escalationReasons = await EscalationReason.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (escalationReasons.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        if (search) {
          where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            Sequelize.literal(
              `( IF (deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        if (status) {
          //ACTIVE
          if (status.toLowerCase() == "active") {
            where.deletedAt = {
              [Op.is]: null,
            };
          } else if (status.toLowerCase() == "inactive") {
            //INACTIVE
            where.deletedAt = {
              [Op.not]: null,
            };
          }
        }

        // Limitation value setup
        let limitValue: number = EscalationController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = EscalationController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        escalationReasons = await EscalationReason.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (escalationReasons.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: escalationReasons,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getFormData = async (req: Request, res: Response) => {
    try {
      const { escalationReasonId } = req.query;
      let escalationReasonData = null;
      if (escalationReasonId) {
        const escalationReasonExists: any = await EscalationReason.findOne({
          attributes: ["id", "name", "deletedAt"],
          where: {
            id: escalationReasonId,
          },
          paranoid: false,
        });

        if (!escalationReasonExists) {
          return res.status(200).json({
            success: false,
            error: "Escalation reason not found",
          });
        }

        escalationReasonData = {
          id: escalationReasonExists.dataValues.id,
          name: escalationReasonExists.dataValues.name,
          status: escalationReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        escalationReason: escalationReasonData,
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

  saveAndUpdate = async (req: any, res: any) => {
    return await save(req, res);
  };

  delete = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validatorRules = {
        escalationReasonIds: "required|array",
        "escalationReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { escalationReasonIds } = payload;
      if (escalationReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one escalation reason",
        });
      }

      for (const escalationReasonId of escalationReasonIds) {
        const escalationReasonExists = await EscalationReason.findOne({
          attributes: ["id"],
          where: {
            id: escalationReasonId,
          },
          paranoid: false,
        });
        if (!escalationReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Escalation reason (${escalationReasonId}) not found`,
          });
        }

        await EscalationReason.destroy({
          where: {
            id: escalationReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Escalation reason deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validatorRules = {
        status: "required|numeric",
        escalationReasonIds: "required|array",
        "escalationReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { escalationReasonIds, status, updatedById, deletedById } = payload;
      if (escalationReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atl east one escalation reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const escalationReasonId of escalationReasonIds) {
        const escalationReasonExists = await EscalationReason.findOne({
          attributes: ["id"],
          where: {
            id: escalationReasonId,
          },
          paranoid: false,
        });
        if (!escalationReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Escalation reason (${escalationReasonId}) not found`,
          });
        }

        await EscalationReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: escalationReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Escalation reason status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public async import(req: any, res: any) {
    try {
      const inData: any[] = req.body.jsonDataArray;
      const errorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      // let importColumns = ["Name", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1108);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1108,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const escalationReasonSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const escalationReasonSheet of escalationReasonSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!escalationReasonSheet.hasOwnProperty(importColumn)) {
            escalationReasonSheet[importColumn] = "";
          }
        });

        let reArrangedEscalationReasons: any = {
          Name: escalationReasonSheet["Name"]
            ? String(escalationReasonSheet["Name"])
            : null,
          Status: escalationReasonSheet["Status"]
            ? String(escalationReasonSheet["Status"])
            : null,
        };

        if (escalationReasonSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedEscalationReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            record[transformedKey] = reArrangedEscalationReasons[key];
          }

          const validationErrors = [];
          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          if (validationErrors.length > 0) {
            errorData.push({
              ...reArrangedEscalationReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let escalationReasonId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const escalationReasonAlreadyExists =
              await EscalationReason.findOne({
                where: {
                  name: trimmedName,
                },
                attributes: ["id"],
                paranoid: false,
              });
            if (escalationReasonAlreadyExists) {
              escalationReasonId = escalationReasonAlreadyExists.dataValues.id;
            }
          }

          record.escalationReasonId = escalationReasonId;
          record.authUserId = req.body.authUserId;
          record.createdById = req.body.authUserId;
          record.updatedById = req.body.authUserId;
          record.status =
            record.status && record.status.trim().toLowerCase() === "active"
              ? 1
              : 0;

          //SAVE
          const output = await save({}, {}, record);
          if (output.success === false) {
            errorData.push({
              ...reArrangedEscalationReasons,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "Escalation reason created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedEscalationReasons,
            Error: "Escalation reason name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New escalation reason created (${newRecordsCreated} records) and existing escalation reason updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New escalation reason created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing escalation reason updated (${existingRecordsUpdated} records)`
          : "No escalation reason created or updated";

      if (errorData.length === 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Error Buffer Generation;
      importColumns.push("Error");

      const buffer = generateXLSXAndXLSExport(
        errorData,
        importColumns,
        "xlsx",
        "EscalationReasons"
      );
      Utils.setExcelHeaders(res, "xlsx");

      //Respond
      return res.status(200).json({
        success: true,
        message: successMessage,
        errorReportBuffer: buffer,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async export(req: any, res: any) {
    try {
      const { format, startDate, endDate } = req.query;
      if (!Utils.isValidExportFormat(format)) {
        return res.status(200).json({
          success: false,
          error: "Invalid or missing export format",
        });
      }

      const where: any = {};
      if (startDate && endDate) {
        const dateFilter = Utils.getDateFilter(startDate, endDate);
        where.createdAt = dateFilter;
      }

      const escalationReasons = await EscalationReason.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!escalationReasons || escalationReasons.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let escalationReasonsArray: any[] = [];
      for (const escalationReason of escalationReasons) {
        escalationReasonsArray.push({
          Name: escalationReason.dataValues.name,
          "Created At": moment
            .tz(escalationReason.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: escalationReason.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const escalationReasonColumnNames = escalationReasonsArray
        ? Object.keys(escalationReasonsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          escalationReasonsArray,
          escalationReasonColumnNames,
          format,
          "EscalationReasons"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          escalationReasonsArray,
          escalationReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Escalation reason export successfully`,
        data: buffer,
        format: format,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

async function save(req: any, response: any, importData?: any) {
  const transaction = await sequelize.transaction();
  try {
    let payload = req.body;
    if (importData !== undefined) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATIONS
    const validatorRules = {
      escalationReasonId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      status: "required|numeric",
    };
    const errors = await Utils.validateParams(payload, validatorRules);
    if (errors) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          errors: errors,
          data: payload,
        };
      } else {
        return response.status(200).json({
          success: false,
          errors: errors,
        });
      }
    }

    const { escalationReasonId, name, ...inputData } = payload;
    const escalationReasonName = name.trim();
    let where: any = {
      name: escalationReasonName,
    };
    if (escalationReasonId) {
      const escalationReason = await EscalationReason.findOne({
        attributes: ["id"],
        where: {
          id: escalationReasonId,
        },
        paranoid: false,
      });
      if (!escalationReason) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Escalation reason not found",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "Escalation reason not found",
          });
        }
      }
      where.id = {
        [Op.ne]: escalationReasonId,
      };
    }

    const escalationReasonAlreadyExists = await EscalationReason.findOne({
      where,
      attributes: ["id"],
      paranoid: false,
    });
    if (escalationReasonAlreadyExists) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Escalation reason name is already taken",
          data: payload,
        };
      } else {
        return response.status(200).json({
          success: false,
          error: "Escalation reason name is already taken",
        });
      }
    }

    //DATA PROCESS
    let deletedAt = null;
    let deletedById = null;
    //INACTIVE
    if (inputData.status == 0) {
      deletedAt = new Date();
      deletedById = inputData.authUserId;
    }

    const data: any = {
      ...inputData,
      name: escalationReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (escalationReasonId) {
      await EscalationReason.update(data, {
        where: {
          id: escalationReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Escalation reason updated successfully";
    } else {
      await EscalationReason.create(data, {
        transaction: transaction,
      });
      message = "Escalation reason created successfully";
    }

    await transaction.commit();
    if (importData !== undefined) {
      return {
        success: true,
        message: message,
      };
    } else {
      return response.status(200).json({
        success: true,
        message: message,
      });
    }
  } catch (error: any) {
    await transaction.rollback();
    return response.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export default new EscalationController();
