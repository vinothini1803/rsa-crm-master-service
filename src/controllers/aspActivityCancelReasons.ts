import { Op, Sequelize } from "sequelize";
import { AspActivityCancelReason } from "../database/models/index";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import moment from "moment-timezone";

class AspActivityCancelReasonController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  // public async getList(req: any, res: any) {
  //   try {
  //     const { limit, offset } = req.query;

  //     console.log(limit, offset);

  //     // Set default values if parameters are not provided or are invalid
  //     const where: any = {};

  //     // Limitation value setup
  //     let limitValue: number = AspActivityCancelReasonController.defaultLimit;

  //     if (limit !== undefined) {
  //       const parsedLimit = parseInt(limit);
  //       if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
  //         limitValue = parsedLimit;
  //       }
  //     }

  //     // Offset value config
  //     let offsetValue: number = AspActivityCancelReasonController.defaultOffset;

  //     if (offset !== undefined) {
  //       const parsedOffset = parseInt(offset);
  //       if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
  //         offsetValue = parsedOffset;
  //       }
  //     }

  //     const aspActivityCancelReasons = await AspActivityCancelReason.findAll({
  //       attributes: ["id", "name"],
  //       order: [["id", "asc"]],
  //       limit: limitValue,
  //       offset: offsetValue,
  //     });

  //     if (aspActivityCancelReasons.length === 0) {
  //       return res.status(200).json({
  //         success: false,
  //         error: "No data found",
  //       });
  //     }

  //     return res.status(200).json({
  //       success: true,
  //       message: "Data Fetched Successfully",
  //       data: aspActivityCancelReasons,
  //     });
  //   } catch (error: any) {
  //     return res.status(500).json({
  //       success: false,
  //       error: error.message,
  //     });
  //   }
  // }

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let aspActivityCancelReasons = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        aspActivityCancelReasons = await AspActivityCancelReason.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (aspActivityCancelReasons.length === 0) {
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
        let limitValue: number = AspActivityCancelReasonController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number =
          AspActivityCancelReasonController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        aspActivityCancelReasons =
          await AspActivityCancelReason.findAndCountAll({
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

        if (aspActivityCancelReasons.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: aspActivityCancelReasons,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getFormData = async (req: any, res: any) => {
    try {
      const { aspActivityCancelReasonId } = req.query;
      let aspActivityCancelReasonData = null;
      if (aspActivityCancelReasonId) {
        const aspActivityCancelReasonExists: any =
          await AspActivityCancelReason.findOne({
            attributes: ["id", "name", "deletedAt"],
            where: {
              id: aspActivityCancelReasonId,
            },
            paranoid: false,
          });

        if (!aspActivityCancelReasonExists) {
          return res.status(200).json({
            success: false,
            error: "Asp activity cancel reason not found",
          });
        }

        aspActivityCancelReasonData = {
          id: aspActivityCancelReasonExists.dataValues.id,
          name: aspActivityCancelReasonExists.dataValues.name,
          status: aspActivityCancelReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        aspActivityCancelReason: aspActivityCancelReasonData,
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

  delete = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validatorRules = {
        aspActivityCancelReasonIds: "required|array",
        "aspActivityCancelReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { aspActivityCancelReasonIds } = payload;
      if (aspActivityCancelReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one asp activity cancel reason",
        });
      }

      for (const aspActivityCancelReasonId of aspActivityCancelReasonIds) {
        const aspActivityCancelReasonExists =
          await AspActivityCancelReason.findOne({
            attributes: ["id"],
            where: {
              id: aspActivityCancelReasonId,
            },
            paranoid: false,
          });
        if (!aspActivityCancelReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Asp activity cancel reason (${aspActivityCancelReasonId}) not found`,
          });
        }

        await AspActivityCancelReason.destroy({
          where: {
            id: aspActivityCancelReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Asp activity cancel reason deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  updateStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      //VALIDATION
      const validatorRules = {
        status: "required|numeric",
        aspActivityCancelReasonIds: "required|array",
        "aspActivityCancelReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { aspActivityCancelReasonIds, status, updatedById, deletedById } =
        payload;
      if (aspActivityCancelReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one asp activity cancel reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const aspActivityCancelReasonId of aspActivityCancelReasonIds) {
        const aspActivityCancelReasonExists =
          await AspActivityCancelReason.findOne({
            attributes: ["id"],
            where: {
              id: aspActivityCancelReasonId,
            },
            paranoid: false,
          });
        if (!aspActivityCancelReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Asp activity cancel reason (${aspActivityCancelReasonId}) not found`,
          });
        }

        await AspActivityCancelReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: aspActivityCancelReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Asp activity cancel reason status updated successfully",
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
      const importColumnsResponse = await Utils.getExcelImportColumns(1123);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1123,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const aspActivityCancelReasonSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const aspActivityCancelReasonSheet of aspActivityCancelReasonSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!aspActivityCancelReasonSheet.hasOwnProperty(importColumn)) {
            aspActivityCancelReasonSheet[importColumn] = "";
          }
        });

        let reArrangedAspActivityCancelReasons: any = {
          Name: aspActivityCancelReasonSheet["Name"]
            ? String(aspActivityCancelReasonSheet["Name"])
            : null,
          Status: aspActivityCancelReasonSheet["Status"]
            ? String(aspActivityCancelReasonSheet["Status"])
            : null,
        };

        if (aspActivityCancelReasonSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedAspActivityCancelReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            record[transformedKey] = reArrangedAspActivityCancelReasons[key];
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
              ...reArrangedAspActivityCancelReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let aspActivityCancelReasonId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const aspActivityCancelReasonAlreadyExists =
              await AspActivityCancelReason.findOne({
                where: {
                  name: trimmedName,
                },
                attributes: ["id"],
                paranoid: false,
              });
            if (aspActivityCancelReasonAlreadyExists) {
              aspActivityCancelReasonId =
                aspActivityCancelReasonAlreadyExists.dataValues.id;
            }
          }

          record.aspActivityCancelReasonId = aspActivityCancelReasonId;
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
              ...reArrangedAspActivityCancelReasons,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (
              output.message ===
              "Asp activity cancel reason created successfully"
            ) {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedAspActivityCancelReasons,
            Error: "Asp activity cancel reason name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New asp activity cancel reason created (${newRecordsCreated} records) and existing asp activity cancel reason updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New asp activity cancel reason created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing asp activity cancel reason updated (${existingRecordsUpdated} records)`
          : "No asp activity cancel reason created or updated";

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
        "AspActivityCancelReasons"
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

      const aspActivityCancelReasons = await AspActivityCancelReason.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!aspActivityCancelReasons || aspActivityCancelReasons.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let aspActivityCancelReasonsArray: any[] = [];
      for (const aspActivityCancelReason of aspActivityCancelReasons) {
        aspActivityCancelReasonsArray.push({
          Name: aspActivityCancelReason.dataValues.name,
          "Created At": moment
            .tz(aspActivityCancelReason.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: aspActivityCancelReason.dataValues.deletedAt
            ? "Inactive"
            : "Active",
        });
      }

      // Column Filter;
      const aspActivityCancelReasonColumnNames = aspActivityCancelReasonsArray
        ? Object.keys(aspActivityCancelReasonsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          aspActivityCancelReasonsArray,
          aspActivityCancelReasonColumnNames,
          format,
          "AspActivityCancelReasons"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          aspActivityCancelReasonsArray,
          aspActivityCancelReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Asp activity cancel reason export successfully`,
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
    if (importData) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATION
    const validatorRules = {
      aspActivityCancelReasonId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      status: "required|numeric",
    };
    const errors = await Utils.validateParams(payload, validatorRules);
    if (errors) {
      await transaction.rollback();
      if (importData) {
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

    const { aspActivityCancelReasonId, name, ...inputData } = payload;
    const aspActivityCancelReasonName = name.trim();

    let where: any = {
      name: aspActivityCancelReasonName,
    };

    if (aspActivityCancelReasonId) {
      const aspActivityCancelReason = await AspActivityCancelReason.findOne({
        attributes: ["id"],
        where: {
          id: aspActivityCancelReasonId,
        },
        paranoid: false,
      });
      if (!aspActivityCancelReason) {
        await transaction.rollback();
        if (importData) {
          return {
            success: false,
            error: "Asp activity cancel reason not found",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "Asp activity cancel reason not found",
          });
        }
      }

      where.id = {
        [Op.ne]: aspActivityCancelReasonId,
      };
    }

    const aspActivityCancelReasonAlreadyExists =
      await AspActivityCancelReason.findOne({
        where,
        attributes: ["id"],
        paranoid: false,
      });
    if (aspActivityCancelReasonAlreadyExists) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Asp activity cancel reason name is already taken",
          data: payload,
        };
      } else {
        return response.status(200).json({
          success: false,
          error: "Asp activity cancel reason name is already taken",
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
      name: aspActivityCancelReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (aspActivityCancelReasonId) {
      await AspActivityCancelReason.update(data, {
        where: {
          id: aspActivityCancelReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Asp activity cancel reason updated successfully";
    } else {
      await AspActivityCancelReason.create(data, {
        transaction: transaction,
      });
      message = "Asp activity cancel reason created successfully";
    }

    await transaction.commit();
    if (importData) {
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

export default new AspActivityCancelReasonController();
