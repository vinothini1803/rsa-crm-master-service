import { Op, Sequelize } from "sequelize";
import {
  VehicleModel,
  VehicleMake,
  VehicleType,
} from "../database/models/index";
import sequelize from "../database/connection";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import moment, { MomentInput } from "moment-timezone";

import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import Utils from "../lib/utils";

class VehicleModelController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;

  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const {
        vehicleMakeId,
        vehicleTypeId,
        limit,
        offset,
        search,
        apiType,
        status,
      } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let vehicleModels: any;
      if (vehicleMakeId) {
        where.vehicleMakeId = vehicleMakeId;
      }
      if (vehicleTypeId) {
        where.vehicleTypeId = vehicleTypeId;
      }

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        vehicleModels = await VehicleModel.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (vehicleModels.length === 0) {
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
              `( IF (vehicleModel.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
            {
              "$vehicleMake.name$": { [Op.like]: `%${search}%` },
            },
            {
              "$vehicleType.name$": { [Op.like]: `%${search}%` },
            },
          ];
        }

        // Limitation value setup
        let limitValue: number = VehicleModelController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = VehicleModelController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        vehicleModels = await VehicleModel.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            [
              Sequelize.literal("( SELECT vehicleMake.name)"),
              "vehicleMakeName",
            ],
            [
              Sequelize.literal("( SELECT vehicleType.name)"),
              "vehicleTypeName",
            ],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(vehicleModel.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (vehicleModel.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: VehicleMake,
              as: "vehicleMake",
              attributes: [],
              required: false,
              paranoid: false,
            },
            {
              model: VehicleType,
              as: "vehicleType",
              attributes: [],
              required: false,
              paranoid: false,
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (vehicleModels.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: vehicleModels,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public async getById(req: any, res: any) {
    try {
      const { modelId } = req.query;

      const vehicleModel: any = await VehicleModel.findOne({
        where: { id: modelId },
        attributes: ["id", "name"],
      });

      if (!vehicleModel) {
        return res.status(200).json({
          success: false,
          error: "Vehicle model not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: vehicleModel,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  getFormData = async (req: Request, res: Response) => {
    try {
      const { vehicleModelId } = req.query;
      let vehicleModelData = null;

      if (vehicleModelId) {
        const vehicleModelExists: any = await VehicleModel.findOne({
          where: {
            id: vehicleModelId,
          },
          paranoid: false,
        });

        if (!vehicleModelExists) {
          return res.status(200).json({
            success: false,
            error: "Vehicle model not found",
          });
        }

        vehicleModelData = {
          id: vehicleModelExists.dataValues.id,
          name: vehicleModelExists.dataValues.name,
          vehicleMakeId: vehicleModelExists.dataValues.vehicleMakeId,
          vehicleTypeId: vehicleModelExists.dataValues.vehicleTypeId,
          status: vehicleModelExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const vehicleMakes = await VehicleMake.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });
      const vehicleTypes = await VehicleType.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      const extras = {
        vehicleMakes: vehicleMakes,
        vehicleTypes: vehicleTypes,
      };

      const data = {
        vehicleModel: vehicleModelData,
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
        vehicleModelIds: "required|array",
        "vehicleModelIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { vehicleModelIds } = payload;
      if (vehicleModelIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one vehicle model",
        });
      }

      for (const vehicleModelId of vehicleModelIds) {
        const vehicleModelExists = await VehicleModel.findOne({
          where: {
            id: vehicleModelId,
          },
          paranoid: false,
        });
        if (!vehicleModelExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Vehicle model (${vehicleModelId}) not found`,
          });
        }

        await VehicleModel.destroy({
          where: {
            id: vehicleModelId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Vehicle model deleted successfully",
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
        vehicleModelIds: "required|array",
        "vehicleModelIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { vehicleModelIds, status, updatedById, deletedById } = payload;
      if (vehicleModelIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one vehicle model",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const vehicleModelId of vehicleModelIds) {
        const vehicleModelExists = await VehicleModel.findOne({
          where: {
            id: vehicleModelId,
          },
          paranoid: false,
        });
        if (!vehicleModelExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Vehicle model (${vehicleModelId}) not found`,
          });
        }

        await VehicleModel.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: vehicleModelId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Vehicle model status updated successfully",
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

  vehicleModelDataExport = async (req: any, res: any) => {
    try {
      const { format, startDate, endDate } = req.query;
      if (!Utils.isValidExportFormat(format)) {
        return res.status(200).json({
          success: false,
          error: "Invalid or missing export format",
        });
      }

      let where: any = {};
      if (startDate && endDate) {
        const dateFilter = Utils.getDateFilter(startDate, endDate);
        where.createdAt = dateFilter;
      }

      const vehicleModelData = await VehicleModel.findAll({
        where,
        attributes: [
          "name",
          "vehicleMakeId",
          "vehicleTypeId",
          "createdAt",
          "deletedAt",
        ],
        paranoid: false,
      });

      if (!vehicleModelData || vehicleModelData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Vehicle Model
      const vehicleModelFinalData: any = await getVehicleModelFinalData(
        vehicleModelData
      );

      // Column Filter
      const renamedUserColumnNames = Object.keys(vehicleModelFinalData[0]);

      let buffer;

      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          vehicleModelFinalData,
          renamedUserColumnNames,
          format,
          "VehicleModels"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          vehicleModelFinalData,
          renamedUserColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `vehicle model data export successfully`,
        data: buffer,
        format: format,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  vehicleModelDataImport = async (req: any, res: any) => {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Vehicle Make", "Vehicle Type", "Status"];

      const importColumnsResponse = await Utils.getExcelImportColumns(1103);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1103,
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

          let reArrangedVehicleModels: any = {
            Name: data3["Name"] ? String(data3["Name"]) : null,
            "Vehicle Make": data3["Vehicle Make"]
              ? String(data3["Vehicle Make"])
              : null,
            "Vehicle Type": data3["Vehicle Type"]
              ? String(data3["Vehicle Type"])
              : null,
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          const keyMapping: any = {
            vehicleMake: "vehicleMakeId",
          };
          for (const key in reArrangedVehicleModels) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedVehicleModels[key];
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
              ...reArrangedVehicleModels,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //VEHICLE MAKE
          let vehicleMakeId = 0;
          if (record.vehicleMakeId) {
            const trimmedVehicleMakeName = record.vehicleMakeId.trim();
            const vehicleMakeExists = await VehicleMake.findOne({
              where: {
                name: trimmedVehicleMakeName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (vehicleMakeExists) {
              vehicleMakeId = vehicleMakeExists.dataValues.id;
            }
          }

          //VEHICLE MODEL
          let vehicleModelId = null;
          if (record.name && vehicleMakeId) {
            const trimmedVehicleModelName = record.name.trim();
            const vehicleModelExists = await VehicleModel.findOne({
              where: {
                name: trimmedVehicleModelName,
                vehicleMakeId: vehicleMakeId,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (vehicleModelExists) {
              vehicleModelId = vehicleModelExists.dataValues.id;
            }
          }

          //VEHICLE TYPE
          let vehicleTypeId = null;
          if (record.vehicleType) {
            const trimmedVehicleTypeName = record.vehicleType.trim();
            const vehicleTypeExists = await VehicleType.findOne({
              where: {
                name: trimmedVehicleTypeName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (vehicleTypeExists) {
              vehicleTypeId = vehicleTypeExists.dataValues.id;
            }
          }

          //REQUESTS FOR VEHICLE TYPE SAVE
          record.vehicleModelId = vehicleModelId;
          record.vehicleMakeId = vehicleMakeId;
          record.vehicleTypeId = vehicleTypeId;
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
              ...reArrangedVehicleModels,
              Error: errorContent,
            });
          } else {
            if (output.message === "Vehicle model created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New vehicle model created (${newRecordsCreated} records) and existing vehicle model updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New vehicle model created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing vehicle model updated (${existingRecordsUpdated} records)`
          : "No vehicle model updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of User
      const vehicleModelFinalData: any = errorOutData;

      // Column Filter
      const renamedVehicleModelColumnNames = Object.keys(
        vehicleModelFinalData[0]
      );

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        vehicleModelFinalData,
        renamedVehicleModelColumnNames,
        "xlsx",
        "VehicleModel"
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
  };
}

//Data Column and Data key, value rearrange (Final Data)
async function getVehicleModelFinalData(vehicleModelData: any) {
  const transformedData = await Promise.all(
    vehicleModelData.map(async (vehicleModelData: any) => {
      const [vehicleMakeById, vehicleTypeById]: any = await Promise.all([
        VehicleMake.findOne({
          attributes: ["id", "name"],
          where: { id: vehicleModelData.dataValues.vehicleMakeId },
          paranoid: false,
        }),
        VehicleType.findOne({
          attributes: ["id", "name"],
          where: { id: vehicleModelData.dataValues.vehicleTypeId },
          paranoid: false,
        }),
      ]);
      return {
        Name: vehicleModelData.dataValues.name,
        VehicleMake: vehicleMakeById ? vehicleMakeById.dataValues.name : null,
        VehicleType: vehicleTypeById ? vehicleTypeById.dataValues.name : null,
        "Created At": moment
          .tz(vehicleModelData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: vehicleModelData.dataValues.deletedAt ? "Inactive" : "Active",
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
      vehicleModelId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      vehicleMakeId: "required|numeric",
      vehicleTypeId: "nullable|numeric",
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

    const { vehicleModelId, name, ...inputData } = payload;
    const vehicleModelName = name.trim();

    //CUSTOM VALIDATIONS
    const vehicleMake = await VehicleMake.findByPk(inputData.vehicleMakeId);
    if (!vehicleMake) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Vehicle make not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Vehicle make not found",
        });
      }
    }

    if (inputData.vehicleTypeId != null) {
      const vehicleType = await VehicleType.findByPk(inputData.vehicleTypeId);
      if (!vehicleType) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Vehicle type not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Vehicle type not found",
          });
        }
      }
    }

    //VEHICLE TYPE VALIDATION FOR IMPORT
    if (importData && inputData.vehicleType && !inputData.vehicleTypeId) {
      await transaction.rollback();
      return {
        success: false,
        error: "Vehicle type not found",
        data: payload,
      };
    }

    if (vehicleModelId) {
      const vehicleModel = await VehicleModel.findOne({
        attributes: ["id"],
        where: {
          id: vehicleModelId,
        },
        paranoid: false,
      });
      if (!vehicleModel) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Vehicle model not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Vehicle model not found",
          });
        }
      }

      const vehicleModelAlreadyExists = await VehicleModel.findOne({
        where: {
          name: vehicleModelName,
          vehicleMakeId: vehicleMake.dataValues.id,
          id: {
            [Op.ne]: vehicleModelId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (vehicleModelAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Vehicle model is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Vehicle model is already taken",
          });
        }
      }
    } else {
      const vehicleModelAlreadyExists = await VehicleModel.findOne({
        where: {
          name: vehicleModelName,
          vehicleMakeId: vehicleMake.dataValues.id,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (vehicleModelAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Vehicle model is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Vehicle model is already taken",
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
      name: vehicleModelName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (vehicleModelId) {
      await VehicleModel.update(data, {
        where: {
          id: vehicleModelId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Vehicle model updated successfully";
    } else {
      await VehicleModel.create(data, {
        transaction: transaction,
      });
      message = "Vehicle model created successfully";
    }

    await transaction.commit();
    if (importData !== undefined) {
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
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export default new VehicleModelController();
