import { Op, Sequelize } from "sequelize";
import { NearestCity, Config, State } from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import Utils from "../lib/utils";

import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class NearestCityController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() { }

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      let nearestCities = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }
        nearestCities = await NearestCity.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (nearestCities.length === 0) {
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
              `( IF (nearestCity.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
            Sequelize.literal(`locationCategory.name LIKE "%${search}%"`),
            Sequelize.literal(`state.name LIKE "%${search}%"`),
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
        let limitValue: number = NearestCityController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = NearestCityController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        nearestCities = await NearestCity.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(nearestCity.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (nearestCity.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
            [
              Sequelize.col("locationCategory.name"),
              "locationCategoryName",
            ],
            [
              Sequelize.col("state.name"),
              "stateName",
            ],
          ],
          include: [
            {
              model: Config,
              as: "locationCategory",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: State,
              attributes: ["id", "name"],
              required: false,
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (nearestCities.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: nearestCities,
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
      const { nearestCityId } = req.query;
      let nearestCityData = null;
      if (nearestCityId) {
        const nearestCityExists: any = await NearestCity.findOne({
          attributes: ["id", "name", "locationCategoryId", "stateId", "deletedAt"],
          where: {
            id: nearestCityId,
          },
          paranoid: false,
        });

        if (!nearestCityExists) {
          return res.status(200).json({
            success: false,
            error: "Nearest city not found",
          });
        }

        nearestCityData = {
          id: nearestCityExists.dataValues.id,
          name: nearestCityExists.dataValues.name,
          locationCategoryId: nearestCityExists.dataValues.locationCategoryId,
          stateId: nearestCityExists.dataValues.stateId,
          status: nearestCityExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      // Fetch location categories (typeId = 55)
      const locationCategories = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 55,
        },
        order: [["id", "asc"]],
      });

      // Fetch states
      const states = await State.findAll({
        attributes: ["id", "name"],
        order: [["name", "asc"]],
        paranoid: false,
      });

      const data = {
        nearestCity: nearestCityData,
        extras: {
          locationCategories,
          states,
        },
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
        nearestCityIds: "required|array",
        "nearestCityIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { nearestCityIds } = payload;
      if (nearestCityIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one nearest city",
        });
      }

      for (const nearestCityId of nearestCityIds) {
        const nearestCityExists = await NearestCity.findOne({
          attributes: ["id"],
          where: {
            id: nearestCityId,
          },
          paranoid: false,
        });
        if (!nearestCityExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Nearest city (${nearestCityId}) not found`,
          });
        }

        await NearestCity.destroy({
          where: {
            id: nearestCityId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Nearest city deleted successfully",
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
        nearestCityIds: "required|array",
        "nearestCityIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { nearestCityIds, status, updatedById, deletedById } = payload;
      if (nearestCityIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one nearest city",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const nearestCityId of nearestCityIds) {
        const nearestCityExists = await NearestCity.findOne({
          attributes: ["id"],
          where: {
            id: nearestCityId,
          },
          paranoid: false,
        });
        if (!nearestCityExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Nearest city (${nearestCityId}) not found`,
          });
        }

        await NearestCity.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: nearestCityId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Nearest city status updated successfully",
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
      const importColumnsResponse = await Utils.getExcelImportColumns(1116);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1116,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const nearestCitySheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const nearestCitySheet of nearestCitySheets) {
        importColumns.forEach((importColumn: any) => {
          if (!nearestCitySheet.hasOwnProperty(importColumn)) {
            nearestCitySheet[importColumn] = "";
          }
        });

        let reArrangedNearestCities: any = {
          Name: nearestCitySheet["Name"]
            ? String(nearestCitySheet["Name"])
            : null,
          "Location Category": nearestCitySheet["Location Category"]
            ? String(nearestCitySheet["Location Category"])
            : null,
          "State": nearestCitySheet["State"]
            ? String(nearestCitySheet["State"])
            : null,
          Status: nearestCitySheet["Status"]
            ? String(nearestCitySheet["Status"])
            : null,
        };

        if (nearestCitySheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedNearestCities) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            record[transformedKey] = reArrangedNearestCities[key];
          }

          const validationErrors = [];
          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          // Validate and map location category
          let locationCategoryId = null;
          if (record.locationCategory) {
            const trimmedLocationCategory = record.locationCategory.trim();
            const locationCategoryExists = await Config.findOne({
              where: {
                name: trimmedLocationCategory,
                typeId: 55,
              },
              attributes: ["id"],
            });
            if (!locationCategoryExists) {
              validationErrors.push(
                `Location Category "${trimmedLocationCategory}" not found.`
              );
            } else {
              locationCategoryId = locationCategoryExists.dataValues.id;
            }
          } else {
            validationErrors.push("Location Category is required.");
          }

          // Validate and map state
          let stateId = null;
          if (record.state) {
            const trimmedState = record.state.trim();
            const stateExists = await State.findOne({
              where: {
                name: trimmedState,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (!stateExists) {
              validationErrors.push(
                `State "${trimmedState}" not found.`
              );
            } else {
              stateId = stateExists.dataValues.id;
            }
          }

          if (validationErrors.length > 0) {
            errorData.push({
              ...reArrangedNearestCities,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let nearestCityId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const nearestCityAlreadyExists = await NearestCity.findOne({
              where: {
                name: trimmedName,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (nearestCityAlreadyExists) {
              nearestCityId = nearestCityAlreadyExists.dataValues.id;
            }
          }

          record.nearestCityId = nearestCityId;
          record.locationCategoryId = locationCategoryId;
          record.stateId = stateId;
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
              ...reArrangedNearestCities,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "Nearest city created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedNearestCities,
            Error: "Nearest city name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New nearest city created (${newRecordsCreated} records) and existing nearest city updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New nearest city created (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing nearest city updated (${existingRecordsUpdated} records)`
              : "No nearest city created or updated";

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

      const nearestCities = await NearestCity.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        include: [
          {
            model: Config,
            as: "locationCategory",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: State,
            attributes: ["id", "name"],
            required: false,
          },
        ],
        paranoid: false,
      });
      if (!nearestCities || nearestCities.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let nearestCitiesArray: any[] = [];
      for (const nearestCity of nearestCities) {
        nearestCitiesArray.push({
          Name: nearestCity.dataValues.name,
          "Location Category": nearestCity.dataValues.locationCategory
            ? nearestCity.dataValues.locationCategory.name
            : "",
          State: nearestCity.dataValues.state
            ? nearestCity.dataValues.state.name
            : "",
          "Created At": moment
            .tz(nearestCity.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: nearestCity.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const nearestCityColumnNames = nearestCitiesArray
        ? Object.keys(nearestCitiesArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          nearestCitiesArray,
          nearestCityColumnNames,
          format,
          "NearestCities"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(nearestCitiesArray, nearestCityColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Nearest city export successfully`,
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
      nearestCityId: "numeric",
      name: "required|string|minLength:3|maxLength:191",
      locationCategoryId: "required|numeric",
      stateId: "numeric",
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

    // Validate locationCategory exists with typeId = 55
    if (payload.locationCategoryId) {
      const locationCategory = await Config.findOne({
        where: {
          id: payload.locationCategoryId,
          typeId: 55,
        },
        attributes: ["id"],
      });
      if (!locationCategory) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Location category not found",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "Location category not found",
          });
        }
      }
    }

    // Validate stateId exists if provided
    if (payload.stateId) {
      const state = await State.findOne({
        where: {
          id: payload.stateId,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (!state) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "State not found",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "State not found",
          });
        }
      }
    }

    const { nearestCityId, name, ...inputData } = payload;
    const nearestCityName = name.trim();
    let where: any = {
      name: nearestCityName,
    };
    if (nearestCityId) {
      const nearestCity = await NearestCity.findOne({
        attributes: ["id"],
        where: {
          id: nearestCityId,
        },
        paranoid: false,
      });
      if (!nearestCity) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Nearest city not found",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "Nearest city not found",
          });
        }
      }
      where.id = {
        [Op.ne]: nearestCityId,
      };
    }

    const nearestCityAlreadyExists = await NearestCity.findOne({
      where,
      attributes: ["id"],
      paranoid: false,
    });
    if (nearestCityAlreadyExists) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Nearest city name is already taken",
          data: payload,
        };
      } else {
        return response.status(200).json({
          success: false,
          error: "Nearest city name is already taken",
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
      name: nearestCityName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (nearestCityId) {
      await NearestCity.update(data, {
        where: {
          id: nearestCityId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Nearest city updated successfully";
    } else {
      await NearestCity.create(data, {
        transaction: transaction,
      });
      message = "Nearest city created successfully";
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

export default new NearestCityController();
