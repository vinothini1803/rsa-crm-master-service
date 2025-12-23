import { Op, Sequelize } from "sequelize";
import { TowFailureReason } from "../database/models/index";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import config from "../config/config.json";
import axios from "axios";
import moment from "moment-timezone";

import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class TowFailureReasonController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() { }

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, id, apiType, search, status } = req.query;
      const where: any = {};
      if (id) {
        where.id = id;
      }

      let towFailureReasons: any = null;
      if (apiType === "dropdown") {
        if (search) {
          where.name = { [Op.like]: `%${search}%` };
        }

        towFailureReasons = await TowFailureReason.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (towFailureReasons.length === 0) {
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

        let limitValue: number = TowFailureReasonController.defaultLimit;
        if (limit) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        let offsetValue: number = TowFailureReasonController.defaultOffset;
        if (offset) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        const towFailureReasonDetails = await TowFailureReason.findAndCountAll({
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
        if (towFailureReasonDetails.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }

        towFailureReasons = {
          count: towFailureReasonDetails.count,
          rows: towFailureReasonDetails.rows,
        };
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: towFailureReasons,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  updateStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = {
        status: "required|numeric",
        towFailureReasonIds: "required|array",
        "towFailureReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { towFailureReasonIds, status, updatedById, deletedById } = payload;
      if (towFailureReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one Tow failure reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const towFailureReasonId of towFailureReasonIds) {
        const towFailureReasonExists = await TowFailureReason.findOne({
          attributes: ["id"],
          where: {
            id: towFailureReasonId,
          },
          paranoid: false,
        });
        if (!towFailureReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Tow failure reason (${towFailureReasonId}) not found`,
          });
        }

        await TowFailureReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: towFailureReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Tow failure reason status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  delete = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = {
        towFailureReasonIds: "required|array",
        "towFailureReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { towFailureReasonIds } = payload;
      if (towFailureReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one Tow failure reason",
        });
      }

      for (const towFailureReasonId of towFailureReasonIds) {
        const towFailureReasonExists = await TowFailureReason.findOne({
          attributes: ["id"],
          where: {
            id: towFailureReasonId,
          },
          paranoid: false,
        });
        if (!towFailureReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Tow failure reason (${towFailureReasonId}) not found`,
          });
        }

        await TowFailureReason.destroy({
          where: {
            id: towFailureReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Tow failure reason deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getFormData = async (req: any, res: any) => {
    try {
      const { towFailureReasonId } = req.query;
      let towFailureReasonData = null;
      if (towFailureReasonId) {
        const towFailureReasonExists: any = await TowFailureReason.findOne({
          attributes: ["id", "name", "deletedAt"],
          where: {
            id: towFailureReasonId,
          },
          paranoid: false,
        });

        if (!towFailureReasonExists) {
          return res.status(200).json({
            success: false,
            error: "Tow failure reason not found",
          });
        }

        towFailureReasonData = {
          id: towFailureReasonExists.dataValues.id,
          name: towFailureReasonExists.dataValues.name,
          status: towFailureReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        towFailureReason: towFailureReasonData,
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

  getById = async (req: any, res: any) => {
    try {
      const { towFailureReasonId } = req.query;
      const towFailureReason: any = await TowFailureReason.findOne({
        attributes: ["id", "name"],
        where: {
          id: towFailureReasonId,
        },
        paranoid: false,
      });

      if (!towFailureReason) {
        return res.status(200).json({
          success: false,
          error: "Tow failure reason not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          towFailureReason: towFailureReason,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  saveAndUpdate = async (req: any, res: any) => {
    return save(req, res);
  };

  public async import(req: any, res: any) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      const importColumnsResponse = await Utils.getExcelImportColumns(1401);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1401,
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

          let reArrangedTowFailureReasons: any = {
            Name: data3["Name"] ? String(data3["Name"]) : null,
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedTowFailureReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedTowFailureReasons[key];
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
              ...reArrangedTowFailureReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //ROS SUCCESS REASON
          let towFailureReasonId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const towFailureReasonExists = await TowFailureReason.findOne({
              attributes: ["id"],
              where: {
                name: trimmedName,
              },
              paranoid: false,
            });

            if (towFailureReasonExists) {
              towFailureReasonId = towFailureReasonExists.dataValues.id;
            }
          }

          //REQUESTS
          record.towFailureReasonId = towFailureReasonId;
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
              ...reArrangedTowFailureReasons,
              Error: errorContent,
            });
          } else {
            if (output.message === "Tow failure reason created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New Tow failure reason created (${newRecordsCreated} records) and existing Tow failure reason updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New Tow failure reason created (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing Tow failure reason updated (${existingRecordsUpdated} records)`
              : "No Tow failure reason updated or created";

      //If No Record Have Error Send Respond
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data
      const towFailureReasonData: any = errorOutData;

      // Column Filter
      const renamedTowFailureReasonColumnNames = Object.keys(
        towFailureReasonData[0]
      );

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        towFailureReasonData,
        renamedTowFailureReasonColumnNames,
        "xlsx",
        "Tow Failure Reason"
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

      const towFailureReasons: any = await TowFailureReason.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!towFailureReasons || towFailureReasons.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let towFailureReasonDetailsArray: any[] = [];
      for (const towFailureReason of towFailureReasons) {
        towFailureReasonDetailsArray.push({
          Name: towFailureReason.dataValues.name,
          "Created At": moment
            .tz(towFailureReason.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: towFailureReason.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const towFailureReasonColumnNames = towFailureReasonDetailsArray
        ? Object.keys(towFailureReasonDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          towFailureReasonDetailsArray,
          towFailureReasonColumnNames,
          format,
          "Tow Failure Reason"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          towFailureReasonDetailsArray,
          towFailureReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Tow failure reason data export successfully`,
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
    let payload;
    if (importData) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATIONS
    const v = {
      towFailureReasonId: "numeric",
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

    const { towFailureReasonId, name, ...inputData } = payload;
    const towFailureReasonName = name.trim();

    if (towFailureReasonId) {
      const towFailureReason = await TowFailureReason.findOne({
        attributes: ["id"],
        where: {
          id: towFailureReasonId,
        },
        paranoid: false,
      });
      if (!towFailureReason) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "Tow failure reason not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Tow failure reason not found",
          });
        }
      }

      const towFailureReasonAlreadyExists = await TowFailureReason.findOne({
        where: {
          name: towFailureReasonName,
          id: {
            [Op.ne]: towFailureReasonId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (towFailureReasonAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "Tow failure reason name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Tow failure reason name is already taken",
          });
        }
      }
    } else {
      const towFailureReasonAlreadyExists = await TowFailureReason.findOne({
        where: {
          name: towFailureReasonName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (towFailureReasonAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "Tow failure reason name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Tow failure reason name is already taken",
          });
        }
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
      name: towFailureReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (towFailureReasonId) {
      await TowFailureReason.update(data, {
        where: {
          id: towFailureReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Tow failure reason updated successfully";
    } else {
      await TowFailureReason.create(data, {
        transaction: transaction,
      });
      message = "Tow failure reason created successfully";
    }

    await transaction.commit();

    if (importData) {
      return {
        success: true,
        message: message,
        data: payload,
      };
    } else {
      return res.status(200).json({
        success: true,
        message: message,
      });
    }
  } catch (error: any) {
    await transaction.rollback();
    if (importData) {
      return {
        success: false,
        error: error.message,
        data: importData,
      };
    } else {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
export default new TowFailureReasonController();

