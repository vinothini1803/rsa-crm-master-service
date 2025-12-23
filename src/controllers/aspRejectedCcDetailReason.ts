import { Op, Sequelize } from "sequelize";
import { AspRejectedCcDetailReason } from "../database/models/index";
import sequelize from "../database/connection";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import Utils from "../lib/utils";
import moment from "moment-timezone";

class AspRejectedCcDetailReasonController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, apiType, status } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let aspRejCcReason: any;

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        aspRejCcReason = await AspRejectedCcDetailReason.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (aspRejCcReason.length === 0) {
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
        let limitValue: number =
          AspRejectedCcDetailReasonController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number =
          AspRejectedCcDetailReasonController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        aspRejCcReason = await AspRejectedCcDetailReason.findAndCountAll({
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

        if (aspRejCcReason.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: aspRejCcReason,
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
      const { aspRejCcReasonId } = req.query;
      let aspRejCcReasonData = null;

      if (aspRejCcReasonId) {
        const aspRejCcReasonExists: any =
          await AspRejectedCcDetailReason.findOne({
            where: {
              id: aspRejCcReasonId,
            },
            paranoid: false,
          });

        if (!aspRejCcReasonExists) {
          return res.status(200).json({
            success: false,
            error: "Asp rejected cc detail reason not found",
          });
        }

        aspRejCcReasonData = {
          id: aspRejCcReasonExists.dataValues.id,
          name: aspRejCcReasonExists.dataValues.name,
          status: aspRejCcReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        aspRejCcReason: aspRejCcReasonData,
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

  // save = async (req: Request, res: Response) => {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     const payload = req.body;
  //     const validatorParams = {
  //       aspRejCcReasonId: "numeric",
  //       name: "required|string|minLength:3|maxLength:255",
  //       status: "required|numeric",
  //     };
  //     //VALIDATIONS
  //     const v = new Validator(payload, validatorParams);
  //     const matched = await v.check();
  //     if (!matched) {
  //       const errors: any = [];
  //       Object.keys(validatorParams).forEach((key) => {
  //         if (v.errors[key]) {
  //           errors.push(v.errors[key].message);
  //         }
  //       });

  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         errors: errors,
  //       });
  //     }

  //     const { aspRejCcReasonId, name, ...inputData } = payload;
  //     const aspRejCcReasonName = name.trim();

  //     //CUSTOM VALIDATIONS
  //     if (aspRejCcReasonId) {
  //       const aspRejCcReason = await AspRejectedCcDetailReason.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: aspRejCcReasonId,
  //         },
  //         paranoid: false,
  //       });
  //       if (!aspRejCcReason) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "Asp rejected cc detail reason not found",
  //         });
  //       }

  //       const aspRejCcReasonNameAlreadyExists =
  //         await AspRejectedCcDetailReason.findOne({
  //           where: {
  //             name: aspRejCcReasonName,
  //             id: {
  //               [Op.ne]: aspRejCcReasonId,
  //             },
  //           },
  //           attributes: ["id"],
  //           paranoid: false,
  //         });
  //       if (aspRejCcReasonNameAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "Asp rejected cc detail is already taken",
  //         });
  //       }
  //     } else {
  //       const aspRejCcReasonNameAlreadyExists =
  //         await AspRejectedCcDetailReason.findOne({
  //           where: {
  //             name: aspRejCcReasonName,
  //           },
  //           attributes: ["id"],
  //           paranoid: false,
  //         });
  //       if (aspRejCcReasonNameAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "Asp rejected cc detail is already taken",
  //         });
  //       }
  //     }

  //     // SAVE PROCESS
  //     let deletedAt = null;
  //     let deletedById = null;
  //     //INACTIVE
  //     if (inputData.status == 0) {
  //       deletedAt = new Date();
  //       deletedById = inputData.authUserId;
  //     }

  //     const data: any = {
  //       ...inputData,
  //       name: aspRejCcReasonName,
  //       deletedById: deletedById,
  //       deletedAt: deletedAt,
  //     };

  //     let message = null;
  //     if (aspRejCcReasonId) {
  //       await AspRejectedCcDetailReason.update(data, {
  //         where: {
  //           id: aspRejCcReasonId,
  //         },
  //         paranoid: false,
  //         transaction: transaction,
  //       });
  //       message = "Asp rejected cc detail reason updated successfully";
  //     } else {
  //       await AspRejectedCcDetailReason.create(data, {
  //         transaction: transaction,
  //       });
  //       message = "Asp rejected cc detail reason created successfully";
  //     }
  //     await transaction.commit();
  //     return res.status(200).json({
  //       success: true,
  //       message: message,
  //     });
  //   } catch (error: any) {
  //     await transaction.rollback();
  //     return res.status(500).json({
  //       success: false,
  //       error: error.message,
  //     });
  //   }
  // };

  delete = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        aspRejCcReasonIds: "required|array",
        "aspRejCcReasonIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { aspRejCcReasonIds } = payload;
      if (aspRejCcReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one asp rejected cc detail reason",
        });
      }

      for (const aspRejCcReasonId of aspRejCcReasonIds) {
        const aspRejCcReasonNameAlreadyExists =
          await AspRejectedCcDetailReason.findOne({
            where: {
              id: aspRejCcReasonId,
            },
            paranoid: false,
          });
        if (!aspRejCcReasonNameAlreadyExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Asp rejected cc detail reason(${aspRejCcReasonId}) not found`,
          });
        }

        await AspRejectedCcDetailReason.destroy({
          where: {
            id: aspRejCcReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Asp rejected cc detail reason deleted successfully",
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
        aspRejCcReasonIds: "required|array",
        "aspRejCcReasonIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { aspRejCcReasonIds, status, updatedById, deletedById } = payload;
      if (aspRejCcReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one asp rejected cc detail reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const aspRejCcReasonId of aspRejCcReasonIds) {
        const aspRejCcReasonNameAlreadyExists =
          await AspRejectedCcDetailReason.findOne({
            where: {
              id: aspRejCcReasonId,
            },
            paranoid: false,
          });
        if (!aspRejCcReasonNameAlreadyExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Asp rejected cc detail reason(${aspRejCcReasonId}) not found`,
          });
        }

        await AspRejectedCcDetailReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: aspRejCcReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Asp rejected cc detail reason status updated successfully",
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

  public async import(req: any, res: any) {
    try {
      const inData: any[] = req.body.jsonDataArray;
      const errorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      // let importColumns = ["Name", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1117);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1117,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const aspRejectedCcDetailReasonSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const aspRejectedCcDetailReasonSheet of aspRejectedCcDetailReasonSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!aspRejectedCcDetailReasonSheet.hasOwnProperty(importColumn)) {
            aspRejectedCcDetailReasonSheet[importColumn] = "";
          }
        });

        let reArrangedAspRejectedCcDetailReasons: any = {
          Name: aspRejectedCcDetailReasonSheet["Name"]
            ? String(aspRejectedCcDetailReasonSheet["Name"])
            : null,
          Status: aspRejectedCcDetailReasonSheet["Status"]
            ? String(aspRejectedCcDetailReasonSheet["Status"])
            : null,
        };

        if (aspRejectedCcDetailReasonSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedAspRejectedCcDetailReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedAspRejectedCcDetailReasons[key];
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
              ...reArrangedAspRejectedCcDetailReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //ASP REJECTED CC DETAIL REASON
          let aspRejCcReasonId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const aspRejectedCcDetailReasonAlreadyExists =
              await AspRejectedCcDetailReason.findOne({
                where: {
                  name: trimmedName,
                },
                attributes: ["id"],
                paranoid: false,
              });
            if (aspRejectedCcDetailReasonAlreadyExists) {
              aspRejCcReasonId =
                aspRejectedCcDetailReasonAlreadyExists.dataValues.id;
            }
          }

          record.aspRejCcReasonId = aspRejCcReasonId;
          record.authUserId = req.body.authUserId;
          record.createdById = req.body.authUserId;
          record.updatedById = req.body.authUserId;
          record.status =
            record.status && record.status.trim().toLowerCase() === "active"
              ? 1
              : 0;

          const output = await save({}, {}, record);
          if (output.success === false) {
            errorData.push({
              ...reArrangedAspRejectedCcDetailReasons,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (
              output.message ===
              "Asp rejected cc detail reason created successfully"
            ) {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedAspRejectedCcDetailReasons,
            Error: "Asp rejected cc detail name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New asp rejected cc detail created (${newRecordsCreated} records) and existing asp rejected cc detail updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New asp rejected cc detail created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing asp rejected cc detail updated (${existingRecordsUpdated} records)`
          : "No asp rejected cc detail created or updated";

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
        "AspRejectedCcDetailReason"
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

      const aspRejectedCcDetailReasonDetails =
        await AspRejectedCcDetailReason.findAll({
          where,
          attributes: {
            exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
          },
          paranoid: false,
        });
      if (
        !aspRejectedCcDetailReasonDetails ||
        aspRejectedCcDetailReasonDetails.length === 0
      ) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let aspRejectedCcDetailReasonDetailsArray: any[] = [];
      for (const aspRejectedCcDetailReasonDetail of aspRejectedCcDetailReasonDetails) {
        aspRejectedCcDetailReasonDetailsArray.push({
          Name: aspRejectedCcDetailReasonDetail.dataValues.name,
          "Created At": moment
            .tz(
              aspRejectedCcDetailReasonDetail.dataValues.createdAt,
              "Asia/Kolkata"
            )
            .format("DD/MM/YYYY hh:mm A"),
          Status: aspRejectedCcDetailReasonDetail.dataValues.deletedAt
            ? "Inactive"
            : "Active",
        });
      }

      const aspRejectedCcDetailReasonColumnNames =
        aspRejectedCcDetailReasonDetailsArray
          ? Object.keys(aspRejectedCcDetailReasonDetailsArray[0])
          : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          aspRejectedCcDetailReasonDetailsArray,
          aspRejectedCcDetailReasonColumnNames,
          format,
          "AspRejectedCcDetailReason"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          aspRejectedCcDetailReasonDetailsArray,
          aspRejectedCcDetailReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Asp rejected cc detail reason data export successfully`,
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
      aspRejCcReasonId: "numeric",
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

    const { aspRejCcReasonId, name, ...inputData } = payload;
    const aspRejCcReasonName = name.trim();

    //CUSTOM VALIDATIONS
    if (aspRejCcReasonId) {
      const aspRejCcReason = await AspRejectedCcDetailReason.findOne({
        attributes: ["id"],
        where: {
          id: aspRejCcReasonId,
        },
        paranoid: false,
      });
      if (!aspRejCcReason) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "Asp rejected cc detail reason not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Asp rejected cc detail reason not found",
          });
        }
      }

      const aspRejCcReasonNameAlreadyExists =
        await AspRejectedCcDetailReason.findOne({
          where: {
            name: aspRejCcReasonName,
            id: {
              [Op.ne]: aspRejCcReasonId,
            },
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (aspRejCcReasonNameAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "Asp rejected cc detail is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Asp rejected cc detail is already taken",
          });
        }
      }
    } else {
      const aspRejCcReasonNameAlreadyExists =
        await AspRejectedCcDetailReason.findOne({
          where: {
            name: aspRejCcReasonName,
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (aspRejCcReasonNameAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "Asp rejected cc detail is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Asp rejected cc detail is already taken",
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
      name: aspRejCcReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (aspRejCcReasonId) {
      await AspRejectedCcDetailReason.update(data, {
        where: {
          id: aspRejCcReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Asp rejected cc detail reason updated successfully";
    } else {
      await AspRejectedCcDetailReason.create(data, {
        transaction: transaction,
      });
      message = "Asp rejected cc detail reason created successfully";
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
      error: error?.message,
    });
  }
}

export default new AspRejectedCcDetailReasonController();
