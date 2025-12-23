import { Op, Sequelize } from "sequelize";
import { AspActivityRejectReason } from "../database/models/index";
import sequelize from "../database/connection";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import moment, { MomentInput } from "moment-timezone";
import Utils from "../lib/utils";

import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class AspActivityRejectReasonController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, apiType, status } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let aspActivityRejectReasons: any;

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        aspActivityRejectReasons = await AspActivityRejectReason.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (aspActivityRejectReasons.length === 0) {
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
        let limitValue: number = AspActivityRejectReasonController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number =
          AspActivityRejectReasonController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        aspActivityRejectReasons =
          await AspActivityRejectReason.findAndCountAll({
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

        if (aspActivityRejectReasons.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: aspActivityRejectReasons,
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
      const { aspActivityRejectReasonId } = req.query;
      let aspActivityRejectReasonData = null;

      if (aspActivityRejectReasonId) {
        const aspActivityRejectReasonExists: any =
          await AspActivityRejectReason.findOne({
            where: {
              id: aspActivityRejectReasonId,
            },
            paranoid: false,
          });

        if (!aspActivityRejectReasonExists) {
          return res.status(200).json({
            success: false,
            error: "Asp activity reject reason not found",
          });
        }

        aspActivityRejectReasonData = {
          id: aspActivityRejectReasonExists.dataValues.id,
          name: aspActivityRejectReasonExists.dataValues.name,
          status: aspActivityRejectReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        aspActivityRejectReason: aspActivityRejectReasonData,
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
        aspActivityRejectReasonIds: "required|array",
        "aspActivityRejectReasonIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { aspActivityRejectReasonIds } = payload;
      if (aspActivityRejectReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one asp activity reject reason",
        });
      }

      for (const aspActivityRejectReasonId of aspActivityRejectReasonIds) {
        const aspActivityRejectReasonExists =
          await AspActivityRejectReason.findOne({
            where: {
              id: aspActivityRejectReasonId,
            },
            paranoid: false,
          });
        if (!aspActivityRejectReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Asp activity reject reason (${aspActivityRejectReasonId}) not found`,
          });
        }

        await AspActivityRejectReason.destroy({
          where: {
            id: aspActivityRejectReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Asp activity reject reason deleted successfully",
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
        aspActivityRejectReasonIds: "required|array",
        "aspActivityRejectReasonIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { aspActivityRejectReasonIds, status, updatedById, deletedById } =
        payload;
      if (aspActivityRejectReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one asp activity reject reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const aspActivityRejectReasonId of aspActivityRejectReasonIds) {
        const aspActivityRejectReasonExists =
          await AspActivityRejectReason.findOne({
            where: {
              id: aspActivityRejectReasonId,
            },
            paranoid: false,
          });
        if (!aspActivityRejectReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Asp activity reject reason (${aspActivityRejectReasonId}) not found`,
          });
        }

        await AspActivityRejectReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: aspActivityRejectReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Asp activity reject reason status updated successfully",
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

  public async aspActivityRejectReasonExport(req: Request, res: Response) {
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

      const getAspRejReasonData = await AspActivityRejectReason.findAll({
        where,
        attributes: ["name", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!getAspRejReasonData || getAspRejReasonData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      const aspRejReasonFinalData: any = await getAspRejReasonFinalData(
        getAspRejReasonData
      );

      // Column Filter
      const renamedAspActivityRejectReasonColumnNames = Object.keys(
        aspRejReasonFinalData[0]
      );

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          aspRejReasonFinalData,
          renamedAspActivityRejectReasonColumnNames,
          format,
          "AspActivityRejReasons"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          aspRejReasonFinalData,
          renamedAspActivityRejectReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `Asp reject reason data export successfully`,
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

  public async aspActivityRejectReasonImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1104);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1104,
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
          let reArrangedAspActivityRejectReasons: any = {
            Name: String(data3["Name"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedAspActivityRejectReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedAspActivityRejectReasons[key];
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
              ...reArrangedAspActivityRejectReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let aspActivityRejectReasonId = null;
          if (record.name) {
            const trimmedAspRejReasonName = record.name.trim();
            const nameAlreadyExists = await AspActivityRejectReason.findOne({
              where: {
                name: trimmedAspRejReasonName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              aspActivityRejectReasonId = nameAlreadyExists.dataValues.id;
            }
          }

          record.aspActivityRejectReasonId = aspActivityRejectReasonId;
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
              ...reArrangedAspActivityRejectReasons,
              Error: errorContent,
            });
          } else {
            if (
              output.message ===
              "Asp activity reject reason created successfully"
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
          ? `New asp activity reject reason created (${newRecordsCreated} records) and existing asp activity reject reason updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New asp activity reject reason created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing asp activity reject reason updated (${existingRecordsUpdated} records)`
          : "No asp activity reject reason updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      const aspRejectReasonFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(aspRejectReasonFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        aspRejectReasonFinalData,
        renamedUserColumnNames,
        "xlsx",
        "Asp Reject Reason"
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

  getById = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const v = {
        id: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const aspActivityRejectReason = await AspActivityRejectReason.findOne({
        attributes: ["id", "name"],
        where: {
          id: payload.id,
        },
        paranoid: false,
      });
      if (!aspActivityRejectReason) {
        return res.status(200).json({
          success: false,
          error: `ASP activity reject reason not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: aspActivityRejectReason,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
}

async function save(req: any, res: any, importData?: any) {
  const transaction = await sequelize.transaction();
  try {
    let payload = req.body;
    if (importData !== undefined) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATIONS
    const v = {
      aspActivityRejectReasonId: "numeric",
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

    const { aspActivityRejectReasonId, name, ...inputData } = payload;
    const aspActivityRejectReasonName = name.trim();

    //CUSTOM VALIDATIONS
    if (aspActivityRejectReasonId) {
      const aspActivityRejectReason = await AspActivityRejectReason.findOne({
        attributes: ["id"],
        where: {
          id: aspActivityRejectReasonId,
        },
        paranoid: false,
      });
      if (!aspActivityRejectReason) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Asp activity reject reason not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Asp activity reject reason not found",
          });
        }
      }

      const aspActivityRejectReasonAlreadyExists =
        await AspActivityRejectReason.findOne({
          where: {
            name: aspActivityRejectReasonName,
            id: {
              [Op.ne]: aspActivityRejectReasonId,
            },
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (aspActivityRejectReasonAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Asp activity reject reason is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Asp activity reject reason is already taken",
          });
        }
      }
    } else {
      const aspActivityRejectReasonAlreadyExists =
        await AspActivityRejectReason.findOne({
          where: {
            name: aspActivityRejectReasonName,
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (aspActivityRejectReasonAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Asp activity reject reason is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Asp activity reject reason is already taken",
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
      name: aspActivityRejectReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (aspActivityRejectReasonId) {
      await AspActivityRejectReason.update(data, {
        where: {
          id: aspActivityRejectReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Asp activity reject reason updated successfully";
    } else {
      await AspActivityRejectReason.create(data, {
        transaction: transaction,
      });
      message = "Asp activity reject reason created successfully";
    }

    await transaction.commit();
    if (importData !== undefined) {
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

//Data Column and Data key, value rearrange (Final Data)
async function getAspRejReasonFinalData(aspRejReasonData: any) {
  const transformedData = await Promise.all(
    aspRejReasonData.map(async (aspRejReasonData: any) => {
      return {
        Name: aspRejReasonData.dataValues.name,
        "Created At": moment
          .tz(aspRejReasonData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: aspRejReasonData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );

  return transformedData;
}

export const getAspActivityRejectReason = async (id: any) => {
  try {
    return await AspActivityRejectReason.findOne({
      attributes: ["id", "name"],
      where: { id: id },
    });
  } catch (error: any) {
    throw error;
  }
};

export default new AspActivityRejectReasonController();
