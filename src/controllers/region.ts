import { Op, Sequelize } from "sequelize";
import { Region, State, Country } from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import moment, { MomentInput } from "moment-timezone";

import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import Utils from "../lib/utils";

class RegionController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType, stateId } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      if (stateId) {
        where.stateId = stateId;
      }

      let regions = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
          ];
        }

        regions = await Region.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (regions.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
            Sequelize.literal(`state.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (region.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
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
        let limitValue: number = RegionController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = RegionController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        regions = await Region.findAndCountAll({
          where,
          attributes: [
            "id",
            "code",
            "name",
            [Sequelize.col("state.code"), "stateCode"],
            [Sequelize.col("state.name"), "stateName"],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(region.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (region.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: {
            model: State,
            as: "state",
            attributes: [],
            required: false,
            paranoid: false,
          },
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (regions.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: regions,
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
      const { regionId } = req.query;
      let regionData = null;
      if (regionId) {
        const regionExists: any = await Region.findOne({
          where: {
            id: regionId,
          },
          include: {
            model: State,
            as: "state",
            attributes: ["countryId"],
            required: false,
            paranoid: false,
          },
          paranoid: false,
        });
        if (!regionExists) {
          return res.status(200).json({
            success: false,
            error: "Region not found",
          });
        }

        regionData = {
          id: regionExists.dataValues.id,
          code: regionExists.dataValues.code,
          name: regionExists.dataValues.name,
          countryId: regionExists.dataValues.state
            ? regionExists.dataValues.state.countryId
            : null,
          stateId: regionExists.dataValues.stateId,
          status: regionExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const countries = await Country.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      const extras = {
        countries: countries,
      };

      const data = {
        region: regionData,
        extras: extras,
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
        regionIds: "required|array",
        "regionIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { regionIds } = payload;
      if (regionIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one region",
        });
      }

      for (const regionId of regionIds) {
        const regionExists = await Region.findOne({
          where: {
            id: regionId,
          },
          paranoid: false,
        });
        if (!regionExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Region (${regionId}) not found`,
          });
        }

        await Region.destroy({
          where: {
            id: regionId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Region deleted successfully",
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
        regionIds: "required|array",
        "regionIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { regionIds, status, updatedById, deletedById } = payload;
      if (regionIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one region",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const regionId of regionIds) {
        const regionExists = await Region.findOne({
          where: {
            id: regionId,
          },
          paranoid: false,
        });
        if (!regionExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Region (${regionId}) not found`,
          });
        }

        await Region.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: regionId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Region status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getStateBaseCountry = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const v = {
        countryId: "required|numeric",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { countryId } = payload;
      const states = await State.findAll({
        where: {
          countryId: countryId,
        },
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      const data = {
        states: states.length > 0 ? states : null,
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

  //Region Export
  public async regionDataExport(req: Request, res: Response) {
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

      const regionData = await Region.findAll({
        where,
        attributes: ["name", "code", "stateId", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!regionData || regionData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Region
      const regionFinalData: any = await getRegionFinalData(regionData);

      // Column Filter
      const renamedRegionColumnNames = Object.keys(regionFinalData[0]);

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          regionFinalData,
          renamedRegionColumnNames,
          format,
          "Regions"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(regionFinalData, renamedRegionColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `region data export successfully`,
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

  //Region Import;
  public async regionDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Code", "Country", "State", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1112);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1112,
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

          let reArrangedRegions: any = {
            Name: data3["Name"],
            Code: String(data3["Code"]),
            Country: String(data3["Country"]),
            State: String(data3["State"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedRegions) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedRegions[key];
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
              ...reArrangedRegions,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let countryId = 0;
          if (record.country) {
            const trimmedCountryName = record.country.trim();
            const countryExists = await Country.findOne({
              where: {
                name: trimmedCountryName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (countryExists) {
              countryId = countryExists.dataValues.id;
            }
          }

          let stateId = 0;
          if (record.state && countryId) {
            const trimmedStateName = record.state.trim();
            const stateExists = await State.findOne({
              where: {
                name: trimmedStateName,
                countryId: countryId,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (stateExists) {
              stateId = stateExists.dataValues.id;
            }
          }

          let regionId = null;
          if (record.name && stateId) {
            const trimmedRegionName = record.name.trim();
            const regionExists = await Region.findOne({
              where: {
                name: trimmedRegionName,
                stateId: stateId,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (regionExists) {
              regionId = regionExists.dataValues.id;
            }
          }

          //REQUESTS FOR STATE SAVE
          record.regionId = regionId;
          record.countryId = countryId;
          record.stateId = stateId;
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
            // errorData.push({
            //   ...record,
            //   error: errorContent,
            // });
            // errorOutData.push({
            //   ...reArrangedRegions,
            //   Error: errorContent,
            // });
            errorData.push({
              ...reArrangedRegions,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "Region created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New region created (${newRecordsCreated} records) and existing region updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New region created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing region updated (${existingRecordsUpdated} records)`
          : "No region updated or created";

      //If No Record Have Error Send Respond
      if (errorData.length  == 0) {
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
        "PolicyPremium"
      );
      Utils.setExcelHeaders(res, "xlsx");

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

//Data Column and Data key, value rearrange (Final Data)
async function getRegionFinalData(regionData: any) {
  const transformedData = await Promise.all(
    regionData.map(async (regionData: any) => {
      const stateById: any = await State.findOne({
        attributes: ["id", "name", "countryId"],
        where: { id: regionData.dataValues.stateId },
        paranoid: false,
      });
      let country = null;
      if (stateById) {
        country = await Country.findOne({
          attributes: ["id", "name"],
          where: { id: stateById.dataValues.countryId },
          paranoid: false,
        });
      }

      return {
        Name: regionData.dataValues.name,
        Code: regionData.dataValues.code,
        Country: country ? country.dataValues.name : null,
        State: stateById ? stateById.dataValues.name : null,
        "Created At": moment
          .tz(regionData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: regionData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );
  return transformedData;
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
      regionId: "numeric",
      code: "required|string|maxLength:20",
      name: "required|string|minLength:3|maxLength:255",
      countryId: "required|numeric",
      stateId: "required|numeric",
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

    const { regionId, code, name, ...inputData } = payload;
    const regionCode = code.trim();
    const regionName = name.trim();

    const country = await Country.findByPk(inputData.countryId);
    if (!country) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Country not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Country not found",
        });
      }
    }

    const state = await State.findByPk(inputData.stateId);
    if (!state) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "State not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "State not found",
        });
      }
    }

    if (regionId) {
      const region = await Region.findOne({
        where: {
          id: regionId,
        },
        paranoid: false,
      });
      if (!region) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Region not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Region not found",
          });
        }
      }

      const regionAlreadyExists = await Region.findOne({
        where: {
          name: regionName,
          stateId: inputData.stateId,
          id: {
            [Op.ne]: regionId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (regionAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Region name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Region name is already taken",
          });
        }
      }
    } else {
      const regionAlreadyExists = await Region.findOne({
        where: {
          name: regionName,
          stateId: inputData.stateId,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (regionAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Region name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Region name is already taken",
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
      code: regionCode,
      name: regionName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (regionId) {
      await Region.update(data, {
        where: {
          id: regionId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Region updated successfully";
    } else {
      await Region.create(data, {
        transaction: transaction,
      });
      message = "Region created successfully";
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

export default new RegionController();
