import { Op, Sequelize } from "sequelize";
import { CaseCancelReason } from "../database/models/index";
import Utils from "../lib/utils";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import moment from "moment-timezone";
import sequelize from "../database/connection";

class CaseCancelReasonController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  // public async getList(req: any, res: any) {
  //   try {
  //     const { limit, offset } = req.query;

  //     // Set default values if parameters are not provided or are invalid
  //     const where: any = {};

  //     // Limitation value setup
  //     let limitValue: number = CaseCancelReasonController.defaultLimit;

  //     if (limit !== undefined) {
  //       const parsedLimit = parseInt(limit);
  //       if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
  //         limitValue = parsedLimit;
  //       }
  //     }

  //     // Offset value config
  //     let offsetValue: number = CaseCancelReasonController.defaultOffset;

  //     if (offset !== undefined) {
  //       const parsedOffset = parseInt(offset);
  //       if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
  //         offsetValue = parsedOffset;
  //       }
  //     }
  //     const caseCancelReasons = await CaseCancelReason.findAll({
  //       attributes: ["id", "name"],
  //       order: [["id", "asc"]],
  //       limit: limitValue,
  //       offset: offsetValue,
  //     });

  //     if (caseCancelReasons.length === 0) {
  //       return res.status(200).json({
  //         success: false,
  //         error: "No data found",
  //       });
  //     }

  //     return res.status(200).json({
  //       success: true,
  //       message: "Data Fetched Successfully",
  //       data: caseCancelReasons,
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
      let caseCancelReasons = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        caseCancelReasons = await CaseCancelReason.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (caseCancelReasons.length === 0) {
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
        let limitValue: number = CaseCancelReasonController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = CaseCancelReasonController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        caseCancelReasons = await CaseCancelReason.findAndCountAll({
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

        if (caseCancelReasons.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseCancelReasons,
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
      const { caseCancelReasonId } = req.query;
      let caseCancelReasonData = null;
      if (caseCancelReasonId) {
        const caseCancelReasonExists: any = await CaseCancelReason.findOne({
          attributes: ["id", "name", "deletedAt"],
          where: {
            id: caseCancelReasonId,
          },
          paranoid: false,
        });

        if (!caseCancelReasonExists) {
          return res.status(200).json({
            success: false,
            error: "Case cancel reason not found",
          });
        }

        caseCancelReasonData = {
          id: caseCancelReasonExists.dataValues.id,
          name: caseCancelReasonExists.dataValues.name,
          status: caseCancelReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        caseCancelReason: caseCancelReasonData,
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
        caseCancelReasonIds: "required|array",
        "caseCancelReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { caseCancelReasonIds } = payload;
      if (caseCancelReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one case cancel reason",
        });
      }

      for (const caseCancelReasonId of caseCancelReasonIds) {
        const caseCancelReasonExists = await CaseCancelReason.findOne({
          attributes: ["id"],
          where: {
            id: caseCancelReasonId,
          },
          paranoid: false,
        });
        if (!caseCancelReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Case cancel reason (${caseCancelReasonId}) not found`,
          });
        }

        await CaseCancelReason.destroy({
          where: {
            id: caseCancelReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Case cancel reason deleted successfully",
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
        caseCancelReasonIds: "required|array",
        "caseCancelReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { caseCancelReasonIds, status, updatedById, deletedById } = payload;
      if (caseCancelReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one case cancel reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const caseCancelReasonId of caseCancelReasonIds) {
        const caseCancelReasonExists = await CaseCancelReason.findOne({
          attributes: ["id"],
          where: {
            id: caseCancelReasonId,
          },
          paranoid: false,
        });
        if (!caseCancelReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Case cancel reason (${caseCancelReasonId}) not found`,
          });
        }

        await CaseCancelReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: caseCancelReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Case cancel reason status updated successfully",
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
      const importColumnsResponse = await Utils.getExcelImportColumns(1120);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1120,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const caseCancelReasonSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const caseCancelReasonSheet of caseCancelReasonSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!caseCancelReasonSheet.hasOwnProperty(importColumn)) {
            caseCancelReasonSheet[importColumn] = "";
          }
        });

        let reArrangedCaseCancelReasons: any = {
          Name: caseCancelReasonSheet["Name"]
            ? String(caseCancelReasonSheet["Name"])
            : null,
          Status: caseCancelReasonSheet["Status"]
            ? String(caseCancelReasonSheet["Status"])
            : null,
        };

        if (caseCancelReasonSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedCaseCancelReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            record[transformedKey] = reArrangedCaseCancelReasons[key];
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
              ...reArrangedCaseCancelReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let caseCancelReasonId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const caseCancelReasonAlreadyExists =
              await CaseCancelReason.findOne({
                where: {
                  name: trimmedName,
                },
                attributes: ["id"],
                paranoid: false,
              });
            if (caseCancelReasonAlreadyExists) {
              caseCancelReasonId = caseCancelReasonAlreadyExists.dataValues.id;
            }
          }

          record.caseCancelReasonId = caseCancelReasonId;
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
              ...reArrangedCaseCancelReasons,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "Case cancel reason created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedCaseCancelReasons,
            Error: "Case cancel reason name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New case cancel reason created (${newRecordsCreated} records) and existing case cancel reason updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New case cancel reason created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing case cancel reason updated (${existingRecordsUpdated} records)`
          : "No case cancel reason created or updated";

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
        "CaseCancelReasons"
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

      const caseCancelReasons = await CaseCancelReason.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!caseCancelReasons || caseCancelReasons.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let caseCancelReasonsArray: any[] = [];
      for (const caseCancelReason of caseCancelReasons) {
        caseCancelReasonsArray.push({
          Name: caseCancelReason.dataValues.name,
          "Created At": moment
            .tz(caseCancelReason.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: caseCancelReason.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const caseCancelReasonColumnNames = caseCancelReasonsArray
        ? Object.keys(caseCancelReasonsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          caseCancelReasonsArray,
          caseCancelReasonColumnNames,
          format,
          "CaseCancelReasons"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          caseCancelReasonsArray,
          caseCancelReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Case cancel reason export successfully`,
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
      caseCancelReasonId: "numeric",
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

    const { caseCancelReasonId, name, ...inputData } = payload;
    const caseCancelReasonName = name.trim();

    let where: any = {
      name: caseCancelReasonName,
    };

    if (caseCancelReasonId) {
      const caseCancelReason = await CaseCancelReason.findOne({
        attributes: ["id"],
        where: {
          id: caseCancelReasonId,
        },
        paranoid: false,
      });
      if (!caseCancelReason) {
        await transaction.rollback();
        if (importData) {
          return {
            success: false,
            error: "Case cancel reason not found",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "Case cancel reason not found",
          });
        }
      }

      where.id = {
        [Op.ne]: caseCancelReasonId,
      };
    }

    const caseCancelReasonAlreadyExists = await CaseCancelReason.findOne({
      where,
      attributes: ["id"],
      paranoid: false,
    });
    if (caseCancelReasonAlreadyExists) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Case cancel reason name is already taken",
          data: payload,
        };
      } else {
        return response.status(200).json({
          success: false,
          error: "Case cancel reason name is already taken",
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
      name: caseCancelReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (caseCancelReasonId) {
      await CaseCancelReason.update(data, {
        where: {
          id: caseCancelReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Case cancel reason updated successfully";
    } else {
      await CaseCancelReason.create(data, {
        transaction: transaction,
      });
      message = "Case cancel reason created successfully";
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

export default new CaseCancelReasonController();
