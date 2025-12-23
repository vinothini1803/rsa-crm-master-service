import { Op, Sequelize } from "sequelize";
import { ClientVehicleType, VehicleType } from "../database/models/index";
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

class VehicleTypeController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType, clientId } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      let vehicleTypes = null;
      if (apiType === "dropdown") {
        if (search) {
          where.name = { [Op.like]: `%${search}%` };
        }

        if (clientId) {
          const clientVehicleTypeIds = await ClientVehicleType.findAll({
            attributes: ["vehicleTypeId"],
            where: {
              clientId: clientId,
            },
            raw: true, // Ensures you get plain objects, not Sequelize instances
          }).then((clientVehicleTypes: any) =>
            clientVehicleTypes.map(
              (clientVehicleType: any) => clientVehicleType.vehicleTypeId
            )
          );

          where.id = {
            [Op.in]: clientVehicleTypeIds,
          };
        }

        vehicleTypes = await VehicleType.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (vehicleTypes.length === 0) {
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
              `( IF (vehicleType.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
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
        let limitValue: number = VehicleTypeController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value
        let offsetValue: number = VehicleTypeController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        vehicleTypes = await VehicleType.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(vehicleType.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (vehicleType.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],

          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (vehicleTypes.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: vehicleTypes,
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
      const { vehicleTypeId } = req.query;
      let vehicleTypeData = null;
      if (vehicleTypeId) {
        const vehicleTypeExists: any = await VehicleType.findOne({
          where: {
            id: vehicleTypeId,
          },
          paranoid: false,
        });

        if (!vehicleTypeExists) {
          return res.status(200).json({
            success: false,
            error: "Vehicle Type not found",
          });
        }

        vehicleTypeData = {
          id: vehicleTypeExists.dataValues.id,
          name: vehicleTypeExists.dataValues.name,
          status: vehicleTypeExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        vehicleType: vehicleTypeData,
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
        vehicleTypeIds: "required|array",
        "vehicleTypeIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { vehicleTypeIds } = payload;
      if (vehicleTypeIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one vehicle type",
        });
      }

      for (const vehicleTypeId of vehicleTypeIds) {
        const vehicleTypeExists = await VehicleType.findOne({
          where: {
            id: vehicleTypeId,
          },
          paranoid: false,
        });
        if (!vehicleTypeExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Vehicle Type (${vehicleTypeId}) not found`,
          });
        }

        await VehicleType.destroy({
          where: {
            id: vehicleTypeId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Vehicle Type deleted successfully",
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
        vehicleTypeIds: "required|array",
        "vehicleTypeIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { vehicleTypeIds, status, updatedById, deletedById } = payload;
      if (vehicleTypeIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one vehicle type",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const vehicleTypeId of vehicleTypeIds) {
        const vehicleTypeExists = await VehicleType.findOne({
          where: {
            id: vehicleTypeId,
          },
          paranoid: false,
        });
        if (!vehicleTypeExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Vehicle Type (${vehicleTypeId}) not found`,
          });
        }

        await VehicleType.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: vehicleTypeId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Vehicle Type status updated successfully",
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

  // Vehicle Type Export
  public async vehicleTypeDataExport(req: Request, res: Response) {
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

      const vehicleTypeData = await VehicleType.findAll({
        where,
        attributes: ["name", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!vehicleTypeData || vehicleTypeData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Vehicle type
      const vehicleTypeFinalData: any = await getVehicleTypeFinalData(
        vehicleTypeData
      );

      // Column Filter
      const renamedVehicleTypeColumnNames = Object.keys(
        vehicleTypeFinalData[0]
      );

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          vehicleTypeFinalData,
          renamedVehicleTypeColumnNames,
          format,
          "VehicleTypes"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          vehicleTypeFinalData,
          renamedVehicleTypeColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Vehicle type data export successfully`,
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

  //Vehicle Type Import;
  public async vehicleTypeDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Status"];

      const importColumnsResponse = await Utils.getExcelImportColumns(1102);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1102,
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
          let reArrangedVehicleTypes: any = {
            Name: String(data3["Name"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedVehicleTypes) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedVehicleTypes[key];
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
              ...reArrangedVehicleTypes,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let vehicleTypeId = null;
          if (record.name) {
            const trimmedVehicleTypeName = record.name.trim();
            const nameAlreadyExists = await VehicleType.findOne({
              where: {
                name: trimmedVehicleTypeName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              vehicleTypeId = nameAlreadyExists.dataValues.id;
            }
          }

          //REQUESTS FOR VEHICLE MAKE SAVE
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
              ...reArrangedVehicleTypes,
              Error: errorContent,
            });
          } else {
            if (output.message === "Vehicle Type created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New vehicle type created (${newRecordsCreated} records) and existing vehicle type updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New vehicle type created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing vehicle type updated (${existingRecordsUpdated} records)`
          : "No vehicle type updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Vehicle Type
      const vehicleTypeData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(vehicleTypeData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        vehicleTypeData,
        renamedUserColumnNames,
        "xlsx",
        "Vehicle Type"
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
}
async function save(req: any, res: any, importData?: any) {
  const transaction = await sequelize.transaction();
  try {
    let payload;
    if (importData !== undefined) {
      payload = importData;
    } else {
      payload = req.body;
    }
    //VALIDATIONS
    const v = {
      vehicleTypeId: "numeric",
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

    const { vehicleTypeId, name, ...inputData } = payload;
    const vehicleTypeName = name.trim();

    if (vehicleTypeId) {
      const vehicleType = await VehicleType.findOne({
        where: {
          id: vehicleTypeId,
        },
        paranoid: false,
      });
      if (!vehicleType) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Vehicle Type not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Vehicle Type not found",
          });
        }
      }

      const vehicleAlreadyExists = await VehicleType.findOne({
        where: {
          name: vehicleTypeName,
          id: {
            [Op.ne]: vehicleTypeId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (vehicleAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Vehicle Type name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Vehicle Type name is already taken",
          });
        }
      }
    } else {
      const vehicleAlreadyExists = await VehicleType.findOne({
        where: {
          name: vehicleTypeName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (vehicleAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Vehicle Type name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Vehicle Type name is already taken",
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
      name: vehicleTypeName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (vehicleTypeId) {
      await VehicleType.update(data, {
        where: {
          id: vehicleTypeId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Vehicle Type updated successfully";
    } else {
      await VehicleType.create(data, {
        transaction: transaction,
      });
      message = "Vehicle Type created successfully";
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

//Data Column and Data key, value rearrange (Final Data)
async function getVehicleTypeFinalData(vehicleTypeData: any) {
  const transformedData = await Promise.all(
    vehicleTypeData.map(async (vehicleTypeData: any) => {
      return {
        Name: vehicleTypeData.dataValues.name,
        "Created At": moment
          .tz(vehicleTypeData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: vehicleTypeData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );

  return transformedData;
}

export const getAllVehicleType = async () => {
  try {
    return await VehicleType.findAll({
      attributes: ["id", "name"],
    });
  } catch (error: any) {
    throw error;
  }
};

export const getVehicleType = async (id: any) => {
  try {
    let vehicleType = await VehicleType.findOne({
      attributes: ["id"],
      where: { id: id },
      paranoid: false,
    });
    return vehicleType ? vehicleType : false;
  } catch (error: any) {
    throw error;
  }
};

export default new VehicleTypeController();
