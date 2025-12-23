import { Op, Sequelize } from "sequelize";
import { ConditionOfVehicle } from "../database/models/index";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class ConditionOfVehicleController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;

  constructor() {}

  public async getList(req: any, res: any) {
    try {
      let { limit, offset, apiType, search, status } = req.query;

      const where: any = {};
      let result: any;

      if (apiType && apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        result = await ConditionOfVehicle.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (result.length === 0) {
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
        let limitValue: number = ConditionOfVehicleController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = ConditionOfVehicleController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        result = await ConditionOfVehicle.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "createdById",
            "updatedById",
            "deletedById",
            // "createdAt",
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            "updatedAt",
            "deletedAt",
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "formattedCreatedAt",
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

        if (result.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      if (result.length === 0) {
        return res.status(200).json({ success: false, error: "No data found" });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  public updateStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = {
        conditionOfVehicleIds: "required|array",
        status: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }
      const { conditionOfVehicleIds, status, updatedById, deletedById } =
        payload;

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const conditionOfVehicleId of conditionOfVehicleIds) {
        const conditionOfVehicleExists = await ConditionOfVehicle.findOne({
          where: {
            id: conditionOfVehicleId,
          },
          paranoid: false,
        });
        if (!conditionOfVehicleExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Condition of Vehicle Id - (${conditionOfVehicleId}) not found`,
          });
        }
        await ConditionOfVehicle.update(
          { updatedById, deletedById, deletedAt },
          {
            where: { id: conditionOfVehicleId },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Condition of Vehicle status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  // public save = async (req: any, res: any) => {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     let payload = req.body;
  //     const v = {
  //       name: "required|string",
  //     };

  //     const errors = await Utils.validateParams(payload, v);

  //     if (errors) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         errors: errors,
  //       });
  //     }

  //     let data: any = { name: payload.name, createdById: payload.createdById };

  //     if (payload.conditionOfVehicleId) {
  //       const conditionOfVehicleExists: any = await ConditionOfVehicle.findOne({
  //         where: { id: payload.conditionOfVehicleId },
  //         paranoid: false,
  //       });
  //       if (!conditionOfVehicleExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `Condition of Vehicle Id - (${payload.conditionOfVehicleId}) not found`,
  //         });
  //       }

  //       // validate check
  //       const validateconditionOfVehicle: any =
  //         await ConditionOfVehicle.findOne({
  //           where: {
  //             id: {
  //               [Op.ne]: payload.conditionOfVehicleId, // Exclude the current record being updated
  //             },
  //             name: payload.name,
  //           },
  //           paranoid: false,
  //         });
  //       if (validateconditionOfVehicle) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `The name ${payload.name} already exists`,
  //         });
  //       }

  //       await ConditionOfVehicle.update(data, {
  //         where: { id: payload.conditionOfVehicleId },
  //         transaction: transaction,
  //       });
  //     } else {
  //       const conditionOfVehicleExists: any = await ConditionOfVehicle.findOne({
  //         where: { name: payload.name },
  //         paranoid: false,
  //       });
  //       if (conditionOfVehicleExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `Condition of Vehicle already exists in this name`,
  //         });
  //       }
  //       await ConditionOfVehicle.create(data, { transaction: transaction });
  //     }
  //     await transaction.commit();
  //     return res.status(200).json({
  //       success: true,
  //       message: "Condition of Vehicle saved successfully",
  //     });
  //   } catch (error: any) {
  //     await transaction.rollback();
  //     return res.status(500).json({ success: false, error: error.message });
  //   }
  // };

  public getFormData = async (req: any, res: any) => {
    try {
      const { conditionOfVehicleId } = req.query;
      let payload = req.query;
      const v = {
        conditionOfVehicleId: "required|numeric",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let conditionOfVehicle: any = {};

      if (conditionOfVehicleId) {
        const conditionOfVehicleExists: any = await ConditionOfVehicle.findOne({
          where: { id: conditionOfVehicleId },
          paranoid: false,
        });

        if (!conditionOfVehicleExists) {
          return res.status(200).json({
            success: false,
            error: "Vehicle Condition not found",
          });
        }

        conditionOfVehicle = {
          id: conditionOfVehicleExists.dataValues.id,
          name: conditionOfVehicleExists.dataValues.name,
          status: conditionOfVehicleExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      return res.status(200).json({
        success: true,
        data: { conditionOfVehicle: conditionOfVehicle },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public delete = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = { conditionOfVehicleIds: "required|array" };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { conditionOfVehicleIds } = payload;

      for (const conditionOfVehicleId of conditionOfVehicleIds) {
        const conditionOfVehicleExists = await ConditionOfVehicle.findOne({
          where: {
            id: conditionOfVehicleId,
          },
          paranoid: false,
        });
        if (!conditionOfVehicleExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Vehicle Condition Id - (${conditionOfVehicleId}) not found`,
          });
        }

        await ConditionOfVehicle.destroy({
          where: {
            id: conditionOfVehicleId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Condition of Vehicle deleted successfully",
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
      const importColumnsResponse = await Utils.getExcelImportColumns(1118);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1118,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const conditionOfVehicleSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const conditionOfVehicleSheet of conditionOfVehicleSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!conditionOfVehicleSheet.hasOwnProperty(importColumn)) {
            conditionOfVehicleSheet[importColumn] = "";
          }
        });

        let reArrangedConditionOfVehicles: any = {
          Name: conditionOfVehicleSheet["Name"]
            ? String(conditionOfVehicleSheet["Name"])
            : null,
          Status: conditionOfVehicleSheet["Status"]
            ? String(conditionOfVehicleSheet["Status"])
            : null,
        };

        if (conditionOfVehicleSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedConditionOfVehicles) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            record[transformedKey] = reArrangedConditionOfVehicles[key];
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
              ...reArrangedConditionOfVehicles,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let conditionOfVehicleId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const conditionOfVehicleAlreadyExists =
              await ConditionOfVehicle.findOne({
                where: {
                  name: trimmedName,
                },
                attributes: ["id"],
                paranoid: false,
              });
            if (conditionOfVehicleAlreadyExists) {
              conditionOfVehicleId =
                conditionOfVehicleAlreadyExists.dataValues.id;
            }
          }

          record.conditionOfVehicleId = conditionOfVehicleId;
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
              ...reArrangedConditionOfVehicles,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (
              output.message === "Condition of vehicle created successfully"
            ) {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedConditionOfVehicles,
            Error: "Condition of vehicle name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New condition of vehicle created (${newRecordsCreated} records) and existing condition of vehicle updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New condition of vehicle created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing condition of vehicle updated (${existingRecordsUpdated} records)`
          : "No condition of vehicle created or updated";

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
        "ConditionOfVehicles"
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

      const conditionOfVehicles = await ConditionOfVehicle.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!conditionOfVehicles || conditionOfVehicles.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let conditionOfVehiclesArray: any[] = [];
      for (const conditionOfVehicle of conditionOfVehicles) {
        conditionOfVehiclesArray.push({
          Name: conditionOfVehicle.dataValues.name,

          "Created At": moment
            .tz(conditionOfVehicle.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: conditionOfVehicle.dataValues.deletedAt
            ? "Inactive"
            : "Active",
        });
      }

      // Column Filter;
      const conditionOfVehicleColumnNames = conditionOfVehiclesArray
        ? Object.keys(conditionOfVehiclesArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          conditionOfVehiclesArray,
          conditionOfVehicleColumnNames,
          format,
          "ConditionOfVehicles"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          conditionOfVehiclesArray,
          conditionOfVehicleColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Condition of vehicle data export successfully`,
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
    if (importData) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATIONS
    const v = {
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

    let data: any = { name: payload.name };

    data.deletedAt = null;
    data.deletedById = null;
    //INACTIVE
    if (payload.status == 0) {
      data.deletedAt = new Date();
      data.deletedById = payload.authUserId;
    }

    let message = null;
    if (payload.conditionOfVehicleId) {
      const conditionOfVehicleExists: any = await ConditionOfVehicle.findOne({
        where: { id: payload.conditionOfVehicleId },
        paranoid: false,
      });
      if (!conditionOfVehicleExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `Condition of Vehicle Id - (${payload.conditionOfVehicleId}) not found`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `Condition of Vehicle Id - (${payload.conditionOfVehicleId}) not found`,
          });
        }
      }

      // validate check
      const validateConditionOfVehicle: any = await ConditionOfVehicle.findOne({
        where: {
          id: {
            [Op.ne]: payload.conditionOfVehicleId, // Exclude the current record being updated
          },
          name: payload.name,
        },
        paranoid: false,
      });
      if (validateConditionOfVehicle) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `The name ${payload.name} already exists`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `The name ${payload.name} already exists`,
          });
        }
      }

      data.updatedById = payload.authUserId;
      await ConditionOfVehicle.update(data, {
        where: { id: payload.conditionOfVehicleId },
        transaction: transaction,
        paranoid: false,
      });

      message = "Condition of vehicle updated successfully";
    } else {
      const conditionOfVehicleExists: any = await ConditionOfVehicle.findOne({
        where: { name: payload.name },
        paranoid: false,
      });
      if (conditionOfVehicleExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `Condition of Vehicle already exists in this name`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `Condition of Vehicle already exists in this name`,
          });
        }
      }

      data.createdById = payload.authUserId;
      await ConditionOfVehicle.create(data, { transaction: transaction });

      message = "Condition of vehicle created successfully";
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

export default new ConditionOfVehicleController();
