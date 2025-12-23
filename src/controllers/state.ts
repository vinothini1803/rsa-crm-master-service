import { Op, Sequelize } from "sequelize";
import { Country, State } from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import moment, { MomentInput } from "moment-timezone";
import Utils from "../lib/utils";

import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class StateController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { countryId, limit, offset, search, status, apiType } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      if (countryId) {
        where.countryId = countryId;
      }

      let states = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
          ];
        }
        states = await State.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (states.length === 0) {
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
            Sequelize.literal(`country.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (state.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
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
        let limitValue: number = StateController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = StateController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        states = await State.findAndCountAll({
          where,
          attributes: [
            "id",
            "code",
            "name",
            [Sequelize.col("country.name"), "countryName"],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(state.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (state.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: {
            model: Country,
            as: "country",
            attributes: [],
            required: false,
            paranoid: false,
          },
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (states.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: states,
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
      const { stateId } = req.query;
      let stateData = null;
      if (stateId) {
        const stateExists: any = await State.findOne({
          where: {
            id: stateId,
          },
          paranoid: false,
        });

        if (!stateExists) {
          return res.status(200).json({
            success: false,
            error: "State not found",
          });
        }

        stateData = {
          id: stateExists.dataValues.id,
          code: stateExists.dataValues.code,
          name: stateExists.dataValues.name,
          countryId: stateExists.dataValues.countryId,
          status: stateExists.dataValues.deletedAt ? 0 : 1,
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
        state: stateData,
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

  saveAndUpdate = async (req: any, res: any) => {
    return await save(req, res);
  };

  delete = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;

      const v = {
        stateIds: "required|array",
        "stateIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { stateIds } = payload;
      if (stateIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one state",
        });
      }

      for (const stateId of stateIds) {
        const stateExists = await State.findOne({
          where: {
            id: stateId,
          },
          paranoid: false,
        });
        if (!stateExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `State (${stateId}) not found`,
          });
        }

        await State.destroy({
          where: {
            id: stateId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "State deleted successfully",
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
        stateIds: "required|array",
        "stateIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { stateIds, status, updatedById, deletedById } = payload;
      if (stateIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one state",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const stateId of stateIds) {
        const stateExists = await State.findOne({
          where: {
            id: stateId,
          },
          paranoid: false,
        });
        if (!stateExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `State (${stateId}) not found`,
          });
        }

        await State.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: stateId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "State status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  //State Export
  public async stateDataExport(req: Request, res: Response) {
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

      const stateData = await State.findAll({
        where,
        attributes: ["name", "code", "countryId", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!stateData || stateData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of City
      const stateFinalData: any = await getStateFinalData(stateData);

      // Column Filter
      const renamedStateColumnNames = Object.keys(stateFinalData[0]);

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          stateFinalData,
          renamedStateColumnNames,
          format,
          "States"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(stateFinalData, renamedStateColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `state data export successfully`,
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

  public async getByName(req: any, res: any) {
    try {
      const payload = req.body;
      const v = new Validator(payload, {
        stateName: "required|string",
      });

      const matched = await v.check();
      if (!matched) {
        const errors: any = [];
        Object.keys(payload).forEach((key) => {
          if (v.errors[key]) {
            errors.push(v.errors[key].message);
          }
        });

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const trimmedStateName = payload.stateName.trim();
      const state = await State.findOne({
        where: {
          [Op.and]: [
            Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("name")),
              Sequelize.fn("LOWER", trimmedStateName)
            ),
          ],
        },
        attributes: ["id", "name"],
        paranoid: false,
      });
      if (!state) {
        return res.status(200).json({
          success: false,
          error: "State details not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: state,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //State Import;
  public async stateDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Code", "Country", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1113);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1113,
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

          let reArrangedStates: any = {
            Name: data3["Name"],
            Code: String(data3["Code"]),
            Country: String(data3["Country"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedStates) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedStates[key];
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
              ...reArrangedStates,
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

          let stateId = null;
          if (record.name && countryId) {
            const trimmedStateName = record.name.trim();
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

          //REQUESTS FOR STATE SAVE
          record.stateId = stateId;
          record.countryId = countryId;
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
              ...reArrangedStates,
              Error: errorContent,
            });
          } else {
            if (output.message === "State created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New state created successfully (${newRecordsCreated} records) and existing state updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New state created successfully (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing state updated (${existingRecordsUpdated} records)`
          : "No state updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of User
      const userFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(userFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        userFinalData,
        renamedUserColumnNames,
        "xlsx",
        "State"
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

  getByGoogleMapCode = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        code: "required|string|maxLength:20",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { code } = payload;
      const trimmedCode = code.trim();

      const state = await State.findOne({
        where: {
          googleMapCode: trimmedCode,
        },
        attributes: ["id", "name"],
      });

      if (!state) {
        return res.status(200).json({
          success: false,
          error: `State not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: state,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
}

//Data Column and Data key, value rearrange (Final Data)
async function getStateFinalData(stateData: any) {
  const transformedData = await Promise.all(
    stateData.map(async (stateData: any) => {
      const countryById: any = await Country.findOne({
        attributes: ["id", "name"],
        where: { id: stateData.dataValues.countryId },
        paranoid: false,
      });
      return {
        Name: stateData.dataValues.name,
        Code: stateData.dataValues.code,
        Country: countryById ? countryById.dataValues.name : null,
        "Created At": moment
          .tz(stateData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: stateData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );
  return transformedData;
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
    const v = {
      stateId: "numeric",
      code: "nullable|string|maxLength:20",
      name: "required|string|minLength:3|maxLength:255",
      countryId: "required|numeric",
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
        return response.status(200).json({
          success: false,
          errors: errors,
        });
      }
    }

    const { stateId, code, name, ...inputData } = payload;
    const stateCode = code ? code.trim() : null;
    const stateName = name.trim();
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
        return response.status(200).json({
          success: false,
          error: "Country not found",
        });
      }
    }

    if (stateId) {
      const state = await State.findOne({
        where: {
          id: stateId,
        },
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

      const stateAlreadyExists = await State.findOne({
        where: {
          name: stateName,
          countryId: country.dataValues.id,
          id: {
            [Op.ne]: stateId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (stateAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "State name is already taken",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "State name is already taken",
          });
        }
      }
    } else {
      const stateAlreadyExists = await State.findOne({
        where: {
          name: stateName,
          countryId: country.dataValues.id,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (stateAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "State name is already taken",
            data: payload,
          };
        } else {
          return response.status(200).json({
            success: false,
            error: "State name is already taken",
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
      code: stateCode,
      name: stateName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (stateId) {
      await State.update(data, {
        where: {
          id: stateId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "State updated successfully";
    } else {
      await State.create(data, {
        transaction: transaction,
      });
      message = "State created successfully";
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

export default new StateController();
