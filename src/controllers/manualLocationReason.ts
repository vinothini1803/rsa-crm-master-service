import { Op, Sequelize } from "sequelize";
import { ManualLocationReason } from "../database/models/index";
import sequelize from "../database/connection";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import moment, { MomentInput } from "moment-timezone";
import Utils from "../lib/utils";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class ManualLocationReasonController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, apiType, status } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let manualLocationReasons: any;

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        manualLocationReasons = await ManualLocationReason.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (manualLocationReasons.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        // LIST API
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

        if (search) {
          where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            Sequelize.literal(
              `( IF (deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = ManualLocationReasonController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = ManualLocationReasonController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        manualLocationReasons = await ManualLocationReason.findAndCountAll({
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

        if (manualLocationReasons.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: manualLocationReasons,
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
      const { manualLocationReasonId } = req.query;
      let manualLocationReasonData = null;

      if (manualLocationReasonId) {
        const manualLocationReasonExists: any =
          await ManualLocationReason.findOne({
            where: {
              id: manualLocationReasonId,
            },
            paranoid: false,
          });

        if (!manualLocationReasonExists) {
          return res.status(200).json({
            success: false,
            error: "Manual location reason not found",
          });
        }

        manualLocationReasonData = {
          id: manualLocationReasonExists.dataValues.id,
          name: manualLocationReasonExists.dataValues.name,
          status: manualLocationReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        manualLocationReason: manualLocationReasonData,
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
        manualLocationReasonIds: "required|array",
        "manualLocationReasonIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { manualLocationReasonIds } = payload;
      if (manualLocationReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one manual location reason",
        });
      }

      for (const manualLocationReasonId of manualLocationReasonIds) {
        const manualLocationReasonExists = await ManualLocationReason.findOne({
          where: {
            id: manualLocationReasonId,
          },
          paranoid: false,
        });
        if (!manualLocationReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Manual location reason (${manualLocationReasonId}) not found`,
          });
        }

        await ManualLocationReason.destroy({
          where: {
            id: manualLocationReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Manual location reason deleted successfully",
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
        manualLocationReasonIds: "required|array",
        "manualLocationReasonIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { manualLocationReasonIds, status, updatedById, deletedById } =
        payload;
      if (manualLocationReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one manual location reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const manualLocationReasonId of manualLocationReasonIds) {
        const manualLocationReasonExists = await ManualLocationReason.findOne({
          where: {
            id: manualLocationReasonId,
          },
          paranoid: false,
        });
        if (!manualLocationReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Manual location reason (${manualLocationReasonId}) not found`,
          });
        }

        await ManualLocationReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: manualLocationReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Manual location reason updated successfully",
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
    try {
      return await save(req, res);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public async export(req: Request, res: Response) {
    try {
      const { format, startDate, endDate }: any = req.query;
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

      const manualLocationReasonData = await ManualLocationReason.findAll({
        where,
        attributes: ["name", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!manualLocationReasonData || manualLocationReasonData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let manualLocationReasonFinalData: any = [];
      for (const manualLocationReason of manualLocationReasonData) {
        manualLocationReasonFinalData.push({
          Name: manualLocationReason.dataValues.name,
          "Created At": moment
            .tz(manualLocationReason.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: manualLocationReason.dataValues.deletedAt
            ? "Inactive"
            : "Active",
        });
      }

      const renamedManualLocationReasonColumnNames = Object.keys(
        manualLocationReasonFinalData[0]
      );
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          manualLocationReasonFinalData,
          renamedManualLocationReasonColumnNames,
          format,
          "ManualLocationReasons"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          manualLocationReasonFinalData,
          renamedManualLocationReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `Manual location reason data export successfully`,
        data: buffer,
        format: format,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async import(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1119);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1119,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      for (const data1 of inData) {
        let data2 = data1["data"];
        for (const data3 of data2) {
          importColumns.forEach((importColumn: any) => {
            if (!data3.hasOwnProperty(importColumn)) {
              data3[importColumn] = "";
            }
          });
          let reArrangedManualLocationReasons: any = {
            Name: String(data3["Name"]),
            Status: String(data3["Status"]),
          };
          const record: any = {};
          for (const key in reArrangedManualLocationReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedManualLocationReasons[key];
          }

          const validationErrors = [];
          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          if (validationErrors.length > 0) {
            errorOutData.push({
              ...reArrangedManualLocationReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let manualLocationReasonId = null;
          if (record.name) {
            const trimmedManualLocationReasonName = record.name.trim();
            const nameAlreadyExists = await ManualLocationReason.findOne({
              where: {
                name: trimmedManualLocationReasonName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              manualLocationReasonId = nameAlreadyExists.dataValues.id;
            }
          }

          record.manualLocationReasonId = manualLocationReasonId;
          record.authUserId = req.body.authUserId;
          record.createdById = req.body.authUserId;
          record.updatedById = req.body.authUserId;
          record.status =
            record.status && record.status.toLowerCase() === "active" ? 1 : 0;
          const output = await save({}, {}, record);
          if (output.success === false) {
            let errorContent = null;
            if (output.errors && output.errors.length > 0) {
              errorContent = output.errors.join(",");
            } else {
              errorContent = output.error;
            }
            errorData.push({
              ...record,
              error: errorContent,
            });
            errorOutData.push({
              ...reArrangedManualLocationReasons,
              Error: errorContent,
            });
          } else {
            if (
              output.message === "Manual location reason created successfully"
            ) {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New manual location reason created (${newRecordsCreated} records) and existing manual location reason updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New manual location reason created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing manual location reason updated (${existingRecordsUpdated} records)`
          : "No manual location reason updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      const manualLocationReasonFinalData: any = errorOutData;

      // Column Filter
      const renamedManualLocationReasonColumnNames = Object.keys(
        manualLocationReasonFinalData[0]
      );

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        manualLocationReasonFinalData,
        renamedManualLocationReasonColumnNames,
        "xlsx",
        "Manual Location Reason"
      );

      //Set Header;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.status(200).json({
        success: true,
        message: successMessage,
        errorReportBuffer: buffer,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

async function save(req: any, res: any, importData?: any) {
  const transaction = await sequelize.transaction();
  try {
    let payload = req.body;
    if (importData) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATIONS
    const v = {
      manualLocationReasonId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      status: "required|numeric",
    };

    const errors = await Utils.validateParams(payload, v);
    if (errors) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          errors: errors,
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }
    }

    const { manualLocationReasonId, name, ...inputData } = payload;
    const manualLocationReasonName = name.trim();

    //CUSTOM VALIDATIONS
    if (manualLocationReasonId) {
      const manualLocationReason = await ManualLocationReason.findOne({
        attributes: ["id"],
        where: {
          id: manualLocationReasonId,
        },
        paranoid: false,
      });
      if (!manualLocationReason) {
        await transaction.rollback();
        if (importData) {
          return {
            success: false,
            error: "Manual location reason not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Manual location reason not found",
          });
        }
      }

      const manualLocationReasonAlreadyExists =
        await ManualLocationReason.findOne({
          where: {
            name: manualLocationReasonName,
            id: {
              [Op.ne]: manualLocationReasonId,
            },
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (manualLocationReasonAlreadyExists) {
        await transaction.rollback();
        if (importData) {
          return {
            success: false,
            error: "Manual location reason is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Manual location reason is already taken",
          });
        }
      }
    } else {
      const manualLocationReasonAlreadyExists =
        await ManualLocationReason.findOne({
          where: {
            name: manualLocationReasonName,
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (manualLocationReasonAlreadyExists) {
        await transaction.rollback();
        if (importData) {
          return {
            success: false,
            error: "Manual location reason is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Manual location reason is already taken",
          });
        }
      }
    }

    // SAVE PROCESS
    let deletedAt = null;
    let deletedById = null;
    //INACTIVE
    if (inputData.status == 0) {
      deletedAt = new Date();
      deletedById = inputData.authUserId;
    }

    const data: any = {
      ...inputData,
      name: manualLocationReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (manualLocationReasonId) {
      await ManualLocationReason.update(data, {
        where: {
          id: manualLocationReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Manual location reason updated successfully";
    } else {
      await ManualLocationReason.create(data, {
        transaction: transaction,
      });
      message = "Manual location reason created successfully";
    }

    await transaction.commit();
    if (importData) {
      return {
        success: true,
        message: message,
      };
    } else {
      return res.status(200).json({
        success: true,
        message: message,
      });
    }
  } catch (error: any) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export default new ManualLocationReasonController();
