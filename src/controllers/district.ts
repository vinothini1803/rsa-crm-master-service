import { Op, Sequelize } from "sequelize";
import { District } from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import { district } from "../routes/masterRouter";

import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class DistrictController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let districts = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }
        districts = await District.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (districts.length === 0) {
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
        let limitValue: number = DistrictController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = DistrictController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        districts = await District.findAndCountAll({
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

        if (districts.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: districts,
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
      const { districtId } = req.query;
      let districtData = null;
      if (districtId) {
        const districtExists: any = await District.findOne({
          attributes: ["id", "name", "deletedAt"],
          where: {
            id: districtId,
          },
          paranoid: false,
        });

        if (!districtExists) {
          return res.status(200).json({
            success: false,
            error: "District not found",
          });
        }

        districtData = {
          id: districtExists.dataValues.id,
          name: districtExists.dataValues.name,
          status: districtExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        district: districtData,
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
        districtIds: "required|array",
        "districtIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { districtIds } = payload;
      if (districtIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one district",
        });
      }

      for (const districtId of districtIds) {
        const districtExists = await District.findOne({
          attributes: ["id"],
          where: {
            id: districtId,
          },
          paranoid: false,
        });
        if (!districtExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `District (${districtId}) not found`,
          });
        }

        await District.destroy({
          where: {
            id: districtId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "District deleted successfully",
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
      const validatorRules = {
        status: "required|numeric",
        districtIds: "required|array",
        "districtIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { districtIds, status, updatedById, deletedById } = payload;
      if (districtIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one district",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const districtId of districtIds) {
        const districtExists = await District.findOne({
          attributes: ["id", "name"],
          where: {
            id: districtId,
          },
          paranoid: false,
        });
        if (!districtExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `District (${districtId}) not found`,
          });
        }

        await District.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: districtId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "District status updated successfully",
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
      const importColumnsResponse = await Utils.getExcelImportColumns(1115);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1115,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const districtSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const districtSheet of districtSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!districtSheet.hasOwnProperty(importColumn)) {
            districtSheet[importColumn] = "";
          }
        });

        let reArrangedDistricts: any = {
          Name: districtSheet["Name"] ? String(districtSheet["Name"]) : null,
          Status: districtSheet["Status"]
            ? String(districtSheet["Status"])
            : null,
        };

        if (districtSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedDistricts) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            record[transformedKey] = reArrangedDistricts[key];
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
              ...reArrangedDistricts,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let districtId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const districtAlreadyExists = await District.findOne({
              where: {
                name: trimmedName,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (districtAlreadyExists) {
              districtId = districtAlreadyExists.dataValues.id;
            }
          }

          record.districtId = districtId;
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
              ...reArrangedDistricts,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "District created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedDistricts,
            Error: "District name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New district created (${newRecordsCreated} records) and existing district updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New district created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing district updated (${existingRecordsUpdated} records)`
          : "No district created or updated";

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
        "Districts"
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

      const districts = await District.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!districts || districts.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let districtsArray: any[] = [];
      for (const district of districts) {
        districtsArray.push({
          Name: district.dataValues.name,
          "Created At": moment
            .tz(district.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: district.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const districtColumnNames = districtsArray
        ? Object.keys(districtsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          districtsArray,
          districtColumnNames,
          format,
          "Districts"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(districtsArray, districtColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `District export successfully`,
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
      districtId: "numeric",
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

    const { districtId, name, ...inputData } = payload;
    const districtName = name.trim();
    let where: any = {
      name: districtName,
    };
    if (districtId) {
      const district = await District.findOne({
        attributes: ["id", "name"],
        where: {
          id: districtId,
        },
        paranoid: false,
      });
      if (!district) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "District not found",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "District not found",
          });
        }
      }

      where.id = {
        [Op.ne]: districtId,
      };
    }

    const districtAlreadyExists = await District.findOne({
      where,
      attributes: ["id"],
      paranoid: false,
    });
    if (districtAlreadyExists) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "District name is already taken",
          data: payload,
        };
      } else {
        return response.status(200).json({
          success: false,
          error: "District name is already taken",
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
      name: districtName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (districtId) {
      await District.update(data, {
        where: {
          id: districtId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "District updated successfully";
    } else {
      await District.create(data, {
        transaction: transaction,
      });
      message = "District created successfully";
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

export default new DistrictController();
