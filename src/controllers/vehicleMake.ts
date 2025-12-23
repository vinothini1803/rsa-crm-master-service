import { Op, Sequelize } from "sequelize";
import { ClientVehicleMake, VehicleMake } from "../database/models/index";
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

class VehicleMakeController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, apiType, status, clientId } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let vehicleMakes: any;

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        if (clientId) {
          const clientVehicleMakeIds = await ClientVehicleMake.findAll({
            attributes: ["vehicleMakeId"],
            where: {
              clientId: clientId,
            },
            raw: true, // Ensures you get plain objects, not Sequelize instances
          }).then((clientVehicleMakes: any) =>
            clientVehicleMakes.map(
              (clientVehicleMake: any) => clientVehicleMake.vehicleMakeId
            )
          );

          where.id = {
            [Op.in]: clientVehicleMakeIds,
          };
        }

        vehicleMakes = await VehicleMake.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (vehicleMakes.length === 0) {
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
        let limitValue: number = VehicleMakeController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = VehicleMakeController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        vehicleMakes = await VehicleMake.findAndCountAll({
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

        if (vehicleMakes.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: vehicleMakes,
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
      const { makeId } = req.query;

      const vehicleMake: any = await VehicleMake.findOne({
        where: { id: makeId },
        attributes: ["id", "name"],
      });

      if (!vehicleMake) {
        return res.status(200).json({
          success: false,
          error: "Vehicle make not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: vehicleMake,
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
      const { vehicleMakeId } = req.query;
      let vehicleMakeData = null;

      if (vehicleMakeId) {
        const vehicleMakeExists: any = await VehicleMake.findOne({
          where: {
            id: vehicleMakeId,
          },
          paranoid: false,
        });

        if (!vehicleMakeExists) {
          return res.status(200).json({
            success: false,
            error: "Vehicle make not found",
          });
        }

        vehicleMakeData = {
          id: vehicleMakeExists.dataValues.id,
          name: vehicleMakeExists.dataValues.name,
          status: vehicleMakeExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        vehicleMake: vehicleMakeData,
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
        vehicleMakeIds: "required|array",
        "vehicleMakeIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { vehicleMakeIds } = payload;
      if (vehicleMakeIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one vehicle make",
        });
      }

      for (const vehicleMakeId of vehicleMakeIds) {
        const vehicleMakeExists = await VehicleMake.findOne({
          where: {
            id: vehicleMakeId,
          },
          paranoid: false,
        });
        if (!vehicleMakeExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Vehicle make (${vehicleMakeId}) not found`,
          });
        }

        await VehicleMake.destroy({
          where: {
            id: vehicleMakeId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Vehicle make deleted successfully",
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
        vehicleMakeIds: "required|array",
        "vehicleMakeIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { vehicleMakeIds, status, updatedById, deletedById } = payload;
      if (vehicleMakeIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one vehicle make",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const vehicleMakeId of vehicleMakeIds) {
        const vehicleMakeExists = await VehicleMake.findOne({
          where: {
            id: vehicleMakeId,
          },
          paranoid: false,
        });
        if (!vehicleMakeExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Vehicle make (${vehicleMakeId}) not found`,
          });
        }

        await VehicleMake.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: vehicleMakeId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Vehicle make status updated successfully",
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

  public async vehicleMakeDataExport(req: Request, res: Response) {
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

      const vehicleMakeData = await VehicleMake.findAll({
        where,
        attributes: ["name", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!vehicleMakeData || vehicleMakeData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Vehicle make
      const vehicleMakeFinalData: any = await getVehicleMakeFinalData(
        vehicleMakeData
      );

      // Column Filter
      const renamedVehicleMakeColumnNames = Object.keys(
        vehicleMakeFinalData[0]
      );

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          vehicleMakeFinalData,
          renamedVehicleMakeColumnNames,
          format,
          "VehicleMakes"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          vehicleMakeFinalData,
          renamedVehicleMakeColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `Vehicle make data export successfully`,
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

  //Vehicle Make Import;
  public async vehicleMakeDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Status"];

      const importColumnsResponse = await Utils.getExcelImportColumns(1101);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1101,
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

          let reArrangedVehicleMakes: any = {
            Name: String(data3["Name"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedVehicleMakes) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedVehicleMakes[key];
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
              ...reArrangedVehicleMakes,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let vehicleMakeId = null;
          if (record.name) {
            const trimmedVehicleMakeName = record.name.trim();
            const nameAlreadyExists = await VehicleMake.findOne({
              where: {
                name: trimmedVehicleMakeName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              vehicleMakeId = nameAlreadyExists.dataValues.id;
            }
          }

          //REQUESTS FOR VEHICLE MAKE SAVE
          record.vehicleMakeId = vehicleMakeId;
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
              ...reArrangedVehicleMakes,
              Error: errorContent,
            });
          } else {
            if (output.message === "Vehicle make created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New vehicle make created (${newRecordsCreated} records) and existing vehicle make updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New vehicle make created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing vehicle make updated (${existingRecordsUpdated} records)`
          : "No vehicle make updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Vehicle Make
      const vehicleMakeFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(vehicleMakeFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        vehicleMakeFinalData,
        renamedUserColumnNames,
        "xlsx",
        "Vehicle Make"
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
    let payload = req.body;
    if (importData !== undefined) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATIONS
    const v = {
      vehicleMakeId: "numeric",
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

    const { vehicleMakeId, name, ...inputData } = payload;
    const vehicleMakeName = name.trim();
    //CUSTOM VALIDATIONS
    if (vehicleMakeId) {
      const vehicleMake = await VehicleMake.findOne({
        attributes: ["id"],
        where: {
          id: vehicleMakeId,
        },
        paranoid: false,
      });
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

      const vehicleMakeAlreadyExists = await VehicleMake.findOne({
        where: {
          name: vehicleMakeName,
          id: {
            [Op.ne]: vehicleMakeId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (vehicleMakeAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Vehicle make is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Vehicle make is already taken",
          });
        }
      }
    } else {
      const vehicleMakeAlreadyExists = await VehicleMake.findOne({
        where: {
          name: vehicleMakeName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (vehicleMakeAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Vehicle make is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Vehicle make is already taken",
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
      name: vehicleMakeName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (vehicleMakeId) {
      await VehicleMake.update(data, {
        where: {
          id: vehicleMakeId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Vehicle make updated successfully";
    } else {
      await VehicleMake.create(data, {
        transaction: transaction,
      });
      message = "Vehicle make created successfully";
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

//Data Column and Data key, value rearrange (Final Data)
async function getVehicleMakeFinalData(vehicleMakeData: any) {
  const transformedData = await Promise.all(
    vehicleMakeData.map(async (vehicleMakeData: any) => {
      return {
        Name: vehicleMakeData.dataValues.name,
        "Created At": moment
          .tz(vehicleMakeData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: vehicleMakeData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );

  return transformedData;
}

export default new VehicleMakeController();
