import { Op, Sequelize } from "sequelize";
import { SystemIssueReason } from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class SystemIssueReasonController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let systemIssueReasons = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        systemIssueReasons = await SystemIssueReason.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (systemIssueReasons.length === 0) {
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
        let limitValue: number = SystemIssueReasonController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = SystemIssueReasonController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        systemIssueReasons = await SystemIssueReason.findAndCountAll({
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

        if (systemIssueReasons.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: systemIssueReasons,
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
      const { systemIssueReasonId } = req.query;
      let systemIssueReasonData = null;
      if (systemIssueReasonId) {
        const systemIssueReasonExists: any = await SystemIssueReason.findOne({
          attributes: ["id", "name", "deletedAt"],
          where: {
            id: systemIssueReasonId,
          },
          paranoid: false,
        });

        if (!systemIssueReasonExists) {
          return res.status(200).json({
            success: false,
            error: "System issue reason not found",
          });
        }

        systemIssueReasonData = {
          id: systemIssueReasonExists.dataValues.id,
          name: systemIssueReasonExists.dataValues.name,
          status: systemIssueReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        systemIssueReason: systemIssueReasonData,
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
        systemIssueReasonIds: "required|array",
        "systemIssueReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { systemIssueReasonIds } = payload;
      if (systemIssueReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one system issue reason",
        });
      }

      for (const systemIssueReasonId of systemIssueReasonIds) {
        const systemIssueReasonExists = await SystemIssueReason.findOne({
          attributes: ["id"],
          where: {
            id: systemIssueReasonId,
          },
          paranoid: false,
        });
        if (!systemIssueReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `System issue reason (${systemIssueReasonId}) not found`,
          });
        }

        await SystemIssueReason.destroy({
          where: {
            id: systemIssueReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "System issue reason deleted successfully",
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
        systemIssueReasonIds: "required|array",
        "systemIssueReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { systemIssueReasonIds, status, updatedById, deletedById } =
        payload;
      if (systemIssueReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one system issue reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const systemIssueReasonId of systemIssueReasonIds) {
        const systemIssueReasonExists = await SystemIssueReason.findOne({
          attributes: ["id"],
          where: {
            id: systemIssueReasonId,
          },
          paranoid: false,
        });
        if (!systemIssueReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `System issue reason (${systemIssueReasonId}) not found`,
          });
        }

        await SystemIssueReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: systemIssueReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "System issue reason status updated successfully",
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
      const importColumnsResponse = await Utils.getExcelImportColumns(1109);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1109,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const systemIssueReasonSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const systemIssueReasonSheet of systemIssueReasonSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!systemIssueReasonSheet.hasOwnProperty(importColumn)) {
            systemIssueReasonSheet[importColumn] = "";
          }
        });

        let reArrangedSystemIssueReasons: any = {
          Name: systemIssueReasonSheet["Name"]
            ? String(systemIssueReasonSheet["Name"])
            : null,
          Status: systemIssueReasonSheet["Status"]
            ? String(systemIssueReasonSheet["Status"])
            : null,
        };

        if (systemIssueReasonSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedSystemIssueReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            record[transformedKey] = reArrangedSystemIssueReasons[key];
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
              ...reArrangedSystemIssueReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let systemIssueReasonId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const systemIssueReasonAlreadyExists =
              await SystemIssueReason.findOne({
                where: {
                  name: trimmedName,
                },
                attributes: ["id"],
                paranoid: false,
              });
            if (systemIssueReasonAlreadyExists) {
              systemIssueReasonId =
                systemIssueReasonAlreadyExists.dataValues.id;
            }
          }

          record.systemIssueReasonId = systemIssueReasonId;
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
              ...reArrangedSystemIssueReasons,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "System issue reason created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedSystemIssueReasons,
            Error: "System issue reason name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New system issue reason created (${newRecordsCreated} records) and existing system issue reason updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New system issue reason created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing system issue reason updated (${existingRecordsUpdated} records)`
          : "No system issue reason created or updated";

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
        "SystemIssueReasons"
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

      const systemIssueReasons = await SystemIssueReason.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!systemIssueReasons || systemIssueReasons.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let systemIssueReasonsArray: any[] = [];
      for (const systemIssueReason of systemIssueReasons) {
        systemIssueReasonsArray.push({
          Name: systemIssueReason.dataValues.name,
          "Created At": moment
            .tz(systemIssueReason.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: systemIssueReason.dataValues.deletedAt
            ? "Inactive"
            : "Active",
        });
      }

      // Column Filter;
      const systemIssueReasonColumnNames = systemIssueReasonsArray
        ? Object.keys(systemIssueReasonsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          systemIssueReasonsArray,
          systemIssueReasonColumnNames,
          format,
          "SystemIssueReasons"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          systemIssueReasonsArray,
          systemIssueReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `System issue reason data export successfully`,
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
      systemIssueReasonId: "numeric",
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

    const { systemIssueReasonId, name, ...inputData } = payload;
    const systemIssueReasonName = name.trim();
    let where: any = {
      name: systemIssueReasonName,
    };
    if (systemIssueReasonId) {
      const systemIssueReason = await SystemIssueReason.findOne({
        attributes: ["id"],
        where: {
          id: systemIssueReasonId,
        },
        paranoid: false,
      });
      if (!systemIssueReason) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "System issue reason not found",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "System issue reason not found",
          });
        }
      }
      where.id = {
        [Op.ne]: systemIssueReasonId,
      };
    }

    const systemIssueReasonAlreadyExists = await SystemIssueReason.findOne({
      where,
      attributes: ["id"],
      paranoid: false,
    });
    if (systemIssueReasonAlreadyExists) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "System issue reason name is already taken",
          data: payload,
        };
      } else {
        return response.status(200).json({
          success: false,
          error: "System issue reason name is already taken",
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
      name: systemIssueReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (systemIssueReasonId) {
      await SystemIssueReason.update(data, {
        where: {
          id: systemIssueReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "System issue reason updated successfully";
    } else {
      await SystemIssueReason.create(data, {
        transaction: transaction,
      });
      message = "System issue reason created successfully";
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

export default new SystemIssueReasonController();
