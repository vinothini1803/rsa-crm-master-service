import { Op, Sequelize } from "sequelize";
import { Entitlement, Config } from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class EntitlementController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, unitId, search, status, apiType } = req.query;

      let where: any = {};
      if (unitId) {
        where.unitId = unitId;
      }

      let entitlements = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }
        entitlements = await Entitlement.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (entitlements.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        if (search) {
          where[Op.or] = [
            Sequelize.literal(
              `IF (entitlement.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%"`
            ),
            { name: { [Op.like]: `%${search}%` } },
            {
              "$unit.name$": { [Op.like]: `%${search}%` },
            },
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
        let limitValue: number = EntitlementController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = EntitlementController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        entitlements = await Entitlement.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "limit",
            [Sequelize.col("unit.name"), "unitName"],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(entitlement.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (entitlement.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: {
            model: Config,
            as: "unit",
            attributes: [],
            required: false,
            paranoid: false,
          },
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (entitlements.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: entitlements,
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
      const { entitlementId } = req.query;
      let entitlementData = null;

      if (entitlementId) {
        const entitlementExists: any = await Entitlement.findOne({
          where: {
            id: entitlementId,
          },
          paranoid: false,
        });

        if (!entitlementExists) {
          return res.status(200).json({
            success: false,
            error: "Entitlement not found",
          });
        }

        entitlementData = {
          id: entitlementExists.dataValues.id,
          name: entitlementExists.dataValues.name,
          limit: entitlementExists.dataValues.limit,
          unitId: entitlementExists.dataValues.unitId,
          status: entitlementExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const units = await Config.findAll({
        where: {
          typeId: 44,
        },
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      const extras = {
        units: units,
      };
      const data = {
        extras: extras,
        entitlement: entitlementData,
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
        entitlementIds: "required|array",
        "entitlementIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { entitlementIds } = payload;
      if (entitlementIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one entitlement",
        });
      }

      for (const entitlementId of entitlementIds) {
        const entitlementExists = await Entitlement.findOne({
          where: {
            id: entitlementId,
          },
          paranoid: false,
        });
        if (!entitlementExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Entitlement (${entitlementId}) not found`,
          });
        }

        await Entitlement.destroy({
          where: {
            id: entitlementId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Entitlement deleted successfully",
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
        entitlementIds: "required|array",
        "entitlementIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { entitlementIds, status, updatedById, deletedById } = payload;
      if (entitlementIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one entitlement",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const entitlementId of entitlementIds) {
        const entitlementExists = await Entitlement.findOne({
          where: {
            id: entitlementId,
          },
          paranoid: false,
        });
        if (!entitlementExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Entitlement (${entitlementId}) not found`,
          });
        }

        await Entitlement.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: entitlementId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Entitlement status updated successfully",
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

      let importColumns = ["Name", "Limit", "Unit Name", "Status"];

      const entitlementSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const entitlementSheet of entitlementSheets) {
        importColumns.forEach((importColumn) => {
          if (!entitlementSheet.hasOwnProperty(importColumn)) {
            entitlementSheet[importColumn] = "";
          }
        });

        let reArrangedEntitlements: any = {
          Name: entitlementSheet["Name"]
            ? String(entitlementSheet["Name"])
            : null,
          Limit: entitlementSheet["Limit"]
            ? String(entitlementSheet["Limit"])
            : null,
          "Unit Name": entitlementSheet["Unit Name"]
            ? String(entitlementSheet["Unit Name"])
            : null,
          Status: entitlementSheet["Status"]
            ? String(entitlementSheet["Status"])
            : null,
        };

        if (entitlementSheet["Name"]) {
          const record: any = {};
          const keyMapping: any = {
            unitName: "unitId",
          };

          for (const key in reArrangedEntitlements) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedEntitlements[key];
          }

          //ENTITLEMENT
          let entitlementId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const entitlementAlreadyExists = await Entitlement.findOne({
              where: {
                name: trimmedName,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (entitlementAlreadyExists) {
              entitlementId = entitlementAlreadyExists.dataValues.id;
            }
          }

          //UNIT
          let unitId = 0;
          if (record.unitId) {
            const trimmedUnitId = record.unitId.trim();
            const unit = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedUnitId,
                typeId: 44, //Entitlement Units
              },
            });
            if (unit) {
              unitId = unit.dataValues.id;
            }
          }

          record.entitlementId = entitlementId;
          record.unitId = unitId;
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
              ...reArrangedEntitlements,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "Entitlement created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedEntitlements,
            Error: "Entitlement name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New entitlement created successfully (${newRecordsCreated} records) and existing entitlement updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New entitlement created successfully (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing entitlement updated (${existingRecordsUpdated} records)`
          : "No entitlement created or updated";

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
        "EntitlementDetails"
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

      const entitlementDetails = await Entitlement.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!entitlementDetails || entitlementDetails.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Entitlement data not found",
        });
      }

      let entitlementDetailsArray: any[] = [];
      for (const entitlementDetail of entitlementDetails) {
        const unit = await Config.findOne({
          attributes: ["id", "name"],
          where: { id: entitlementDetail.dataValues.unitId },
        });

        entitlementDetailsArray.push({
          Name: entitlementDetail.dataValues.name,
          Limit: entitlementDetail.dataValues.limit,
          "Unit Name": unit ? unit.dataValues.name : "",
          "Created At": moment
            .tz(entitlementDetail.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: entitlementDetail.dataValues.deletedAt
            ? "Inactive"
            : "Active",
        });
      }

      // Column Filter;
      const entitlementColumnNames = entitlementDetailsArray
        ? Object.keys(entitlementDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          entitlementDetailsArray,
          entitlementColumnNames,
          format,
          "Entitlement Details"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          entitlementDetailsArray,
          entitlementColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Entitlement data export successfully`,
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
    if (importData !== undefined) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATIONS
    const v = {
      entitlementId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      limit: "nullable|numeric",
      unitId: "required|numeric",
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

    const { entitlementId, name, ...inputData } = payload;
    const entitlementName = name.trim();

    const unit = await Config.findByPk(inputData.unitId);
    if (!unit) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Unit not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Unit not found",
        });
      }
    }

    if (entitlementId) {
      const entitlement = await Entitlement.findOne({
        where: {
          id: entitlementId,
        },
        paranoid: false,
      });
      if (!entitlement) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Entitlement not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Entitlement not found",
          });
        }
      }

      const entitlementExists = await Entitlement.findOne({
        where: {
          name: entitlementName,
          id: {
            [Op.ne]: entitlementId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (entitlementExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Entitlement is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Entitlement is already taken",
          });
        }
      }
    } else {
      const entitlementAlreadyExists = await Entitlement.findOne({
        where: {
          name: entitlementName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (entitlementAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Entitlement is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Entitlement is already taken",
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
      name: entitlementName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (entitlementId) {
      await Entitlement.update(data, {
        where: {
          id: entitlementId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Entitlement updated successfully";
    } else {
      await Entitlement.create(data, {
        transaction: transaction,
      });
      message = "Entitlement created successfully";
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

export const getEntitlements = async (ids: any) => {
  try {
    if (ids.length) {
      const entitlements: any = await Entitlement.findAll({
        attributes: {
          exclude: [
            "createdById",
            "updatedById",
            "deletedById",
            "createdAt",
            "updatedAt",
            "deletedAt",
          ],
        },
        where: { id: { [Op.in]: ids } },
        paranoid: false,
      });

      if (entitlements.length == 0) {
        return {
          success: false,
          error: "Entitlements not found",
        };
      }
      return {
        success: true,
        data: entitlements,
      };
    }
    return {
      success: false,
      error: "Entitlement ID is required",
    };
  } catch (error: any) {
    throw error;
  }
};

export default new EntitlementController();
