import { Op, Sequelize } from "sequelize";
import { Taluk } from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import Utils from "../lib/utils";

import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class TalukController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let taluks = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        taluks = await Taluk.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (taluks.length === 0) {
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
        let limitValue: number = TalukController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = TalukController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        taluks = await Taluk.findAndCountAll({
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

        if (taluks.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: taluks,
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
      const { talukId } = req.query;
      let talukData = null;
      if (talukId) {
        const talukExists: any = await Taluk.findOne({
          attributes: ["id", "name", "deletedAt"],
          where: {
            id: talukId,
          },
          paranoid: false,
        });

        if (!talukExists) {
          return res.status(200).json({
            success: false,
            error: "Taluk not found",
          });
        }

        talukData = {
          id: talukExists.dataValues.id,
          name: talukExists.dataValues.name,
          status: talukExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        taluk: talukData,
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
        talukIds: "required|array",
        "talukIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { talukIds } = payload;
      if (talukIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one taluk",
        });
      }

      for (const talukId of talukIds) {
        const talukExists = await Taluk.findOne({
          attributes: ["id"],
          where: {
            id: talukId,
          },
          paranoid: false,
        });
        if (!talukExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Taluk (${talukId}) not found`,
          });
        }

        await Taluk.destroy({
          where: {
            id: talukId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Taluk deleted successfully",
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
      //VALIDATION
      const validatorRules = {
        status: "required|numeric",
        talukIds: "required|array",
        "talukIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { talukIds, status, updatedById, deletedById } = payload;
      if (talukIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one taluk",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const talukId of talukIds) {
        const talukExists = await Taluk.findOne({
          attributes: ["id"],
          where: {
            id: talukId,
          },
          paranoid: false,
        });
        if (!talukExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Taluk (${talukId}) not found`,
          });
        }

        await Taluk.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: talukId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Taluk status updated successfully",
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
      const importColumnsResponse = await Utils.getExcelImportColumns(1114);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1114,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const talukSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const talukSheet of talukSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!talukSheet.hasOwnProperty(importColumn)) {
            talukSheet[importColumn] = "";
          }
        });

        let reArrangedTaluks: any = {
          Name: talukSheet["Name"] ? String(talukSheet["Name"]) : null,
          Status: talukSheet["Status"] ? String(talukSheet["Status"]) : null,
        };

        if (talukSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedTaluks) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            record[transformedKey] = reArrangedTaluks[key];
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
              ...reArrangedTaluks,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let talukId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const talukAlreadyExists = await Taluk.findOne({
              where: {
                name: trimmedName,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (talukAlreadyExists) {
              talukId = talukAlreadyExists.dataValues.id;
            }
          }

          record.talukId = talukId;
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
              ...reArrangedTaluks,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "Taluk created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedTaluks,
            Error: "Taluk name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New taluk created (${newRecordsCreated} records) and existing taluk updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New taluk created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing taluk updated (${existingRecordsUpdated} records)`
          : "No taluk created or updated";

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
        "NearestCities"
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

      const taluks = await Taluk.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!taluks || taluks.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let taluksArray: any[] = [];
      for (const taluk of taluks) {
        taluksArray.push({
          Name: taluk.dataValues.name,
          "Created At": moment
            .tz(taluk.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: taluk.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const talukColumnNames = taluksArray ? Object.keys(taluksArray[0]) : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          taluksArray,
          talukColumnNames,
          format,
          "Taluks"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(taluksArray, talukColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Taluk export successfully`,
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

    //VALIDATION
    const validatorRules = {
      talukId: "numeric",
      name: "required|string|minLength:3|maxLength:191",
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

    const { talukId, name, ...inputData } = payload;
    const talukName = name.trim();

    let where: any = {
      name: talukName,
    };

    if (talukId) {
      const taluk = await Taluk.findOne({
        attributes: ["id"],
        where: {
          id: talukId,
        },
        paranoid: false,
      });
      if (!taluk) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Taluk not found",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "Taluk not found",
          });
        }
      }

      where.id = {
        [Op.ne]: talukId,
      };
    }

    const talukAlreadyExists = await Taluk.findOne({
      where,
      attributes: ["id"],
      paranoid: false,
    });
    if (talukAlreadyExists) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Taluk name is already taken",
          data: payload,
        };
      } else {
        return response.status(200).json({
          success: false,
          error: "Taluk name is already taken",
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
      name: talukName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (talukId) {
      await Taluk.update(data, {
        where: {
          id: talukId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Taluk updated successfully";
    } else {
      await Taluk.create(data, {
        transaction: transaction,
      });
      message = "Taluk created successfully";
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

export default new TalukController();
