import { Op, Sequelize } from "sequelize";
import { ServiceOrganisation } from "../database/models/index";
import { Request, Response } from "express";
import sequelize from "../database/connection";
import { Validator } from "node-input-validator";
import moment, { MomentInput } from "moment-timezone";

import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import Utils from "../lib/utils";

class ServiceOrganisationController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, apiType, status } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let serviceOrganisations: any;

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        serviceOrganisations = await ServiceOrganisation.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (serviceOrganisations.length === 0) {
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
        let limitValue: number = ServiceOrganisationController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = ServiceOrganisationController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        serviceOrganisations = await ServiceOrganisation.findAndCountAll({
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

        if (serviceOrganisations.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: serviceOrganisations,
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
      const { serviceOrganisationId } = req.query;
      let serviceOrganisationData = null;

      if (serviceOrganisationId) {
        const serviceOrganisationExists: any =
          await ServiceOrganisation.findOne({
            where: {
              id: serviceOrganisationId,
            },
            paranoid: false,
          });

        if (!serviceOrganisationExists) {
          return res.status(200).json({
            success: false,
            error: "Service organisation not found",
          });
        }

        serviceOrganisationData = {
          id: serviceOrganisationExists.dataValues.id,
          name: serviceOrganisationExists.dataValues.name,
          status: serviceOrganisationExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        serviceOrganisation: serviceOrganisationData,
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
        serviceOrganisationIds: "required|array",
        "serviceOrganisationIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { serviceOrganisationIds } = payload;
      if (serviceOrganisationIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one service organisation",
        });
      }

      for (const serviceOrganisationId of serviceOrganisationIds) {
        const serviceOrganisationExists = await ServiceOrganisation.findOne({
          where: {
            id: serviceOrganisationId,
          },
          paranoid: false,
        });
        if (!serviceOrganisationExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Service organisation (${serviceOrganisationId}) not found`,
          });
        }

        await ServiceOrganisation.destroy({
          where: {
            id: serviceOrganisationId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Service organisation deleted successfully",
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
        serviceOrganisationIds: "required|array",
        "serviceOrganisationIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { serviceOrganisationIds, status, updatedById, deletedById } =
        payload;
      if (serviceOrganisationIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one service organisation",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const serviceOrganisationId of serviceOrganisationIds) {
        const serviceOrganisationExists = await ServiceOrganisation.findOne({
          where: {
            id: serviceOrganisationId,
          },
          paranoid: false,
        });
        if (!serviceOrganisationExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Service organisation (${serviceOrganisationId}) not found`,
          });
        }

        await ServiceOrganisation.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: serviceOrganisationId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Service organisation status updated successfully",
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

  public async serviceOrganisaionExport(req: Request, res: Response) {
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

      const serviceOrganisationData = await ServiceOrganisation.findAll({
        where,
        attributes: ["name", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!serviceOrganisationData || serviceOrganisationData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Service Organisation
      const serviceOrganisationFinalData: any =
        await getServiceOrganisationFinalData(serviceOrganisationData);

      // Column Filter
      const renamedServiceOrganisationColumnNames = Object.keys(
        serviceOrganisationFinalData[0]
      );

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          serviceOrganisationFinalData,
          renamedServiceOrganisationColumnNames,
          format,
          "ServiceOrganisations"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          serviceOrganisationFinalData,
          renamedServiceOrganisationColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `service organisation export successfully`,
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

  //Service Organisation Import;
  public async serviceOrganisationImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1098);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1098,
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
          let reArrangedServiceOrganisations: any = {
            Name: data3["Name"] ? String(data3["Name"]) : null,
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };
          const record: any = {};
          for (const key in reArrangedServiceOrganisations) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );
            record[transformedKey] = reArrangedServiceOrganisations[key];
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
              ...reArrangedServiceOrganisations,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //SERVICE ORGANISATION
          let serviceOrganisationId = null;
          if (record.name) {
            const trimmedServiceOrganisationName = record.name.trim();
            const serviceOrganisationExists = await ServiceOrganisation.findOne(
              {
                where: {
                  name: trimmedServiceOrganisationName,
                },
                attributes: ["id"],
                paranoid: false,
              }
            );

            if (serviceOrganisationExists) {
              serviceOrganisationId = serviceOrganisationExists.dataValues.id;
            }
          }

          //REQUESTS FOR SAVE
          record.serviceOrganisationId = serviceOrganisationId;
          record.authUserId = req.body.authUserId;
          record.createdById = req.body.authUserId;
          record.updatedById = req.body.authUserId;
          record.status =
            record.status && record.status.trim().toLowerCase() === "active"
              ? 1
              : 0;
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
              ...reArrangedServiceOrganisations,
              Error: errorContent,
            });
          } else {
            if (
              output.message === "Service organisation created successfully"
            ) {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New service organisation created (${newRecordsCreated} records) and existing service organisation updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New service organisation created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing service organisation updated (${existingRecordsUpdated} records)`
          : "No Service organisation updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Service Organisation
      const serviceOrganisationFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(
        serviceOrganisationFinalData[0]
      );

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        serviceOrganisationFinalData,
        renamedUserColumnNames,
        "xlsx",
        "Service Organisation"
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
      serviceOrganisationId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      status: "required|numeric",
    };

    const errors = await Utils.validateParams(payload, v);
    if (errors) {
      await transaction.rollback();
      if (importData !== undefined) {
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

    const { serviceOrganisationId, name, ...inputData } = payload;
    const serviceOrganisationName = name.trim();

    //CUSTOM VALIDATIONS
    if (serviceOrganisationId) {
      const serviceOrganisation = await ServiceOrganisation.findOne({
        attributes: ["id"],
        where: {
          id: serviceOrganisationId,
        },
        paranoid: false,
      });
      if (!serviceOrganisation) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Service organisation not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Service organisation not found",
          });
        }
      }

      const serviceOrganisationAlreadyExists =
        await ServiceOrganisation.findOne({
          where: {
            name: serviceOrganisationName,
            id: {
              [Op.ne]: serviceOrganisationId,
            },
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (serviceOrganisationAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Service organisation is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Service organisation is already taken",
          });
        }
      }
    } else {
      const serviceOrganisationAlreadyExists =
        await ServiceOrganisation.findOne({
          where: {
            name: serviceOrganisationName,
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (serviceOrganisationAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Service organisation is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Service organisation is already taken",
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
      name: serviceOrganisationName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (serviceOrganisationId) {
      await ServiceOrganisation.update(data, {
        where: {
          id: serviceOrganisationId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Service organisation updated successfully";
    } else {
      await ServiceOrganisation.create(data, {
        transaction: transaction,
      });
      message = "Service organisation created successfully";
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
async function getServiceOrganisationFinalData(serviceOrganisationData: any) {
  const transformedData = await Promise.all(
    serviceOrganisationData.map(async (serviceOrganisationData: any) => {
      return {
        Name: serviceOrganisationData.dataValues.name,
        "Created At": moment
          .tz(serviceOrganisationData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: serviceOrganisationData.dataValues.deletedAt
          ? "Inactive"
          : "Active",
      };
    })
  );

  return transformedData;
}

export const getAllServiceOrganisation = async () => {
  try {
    return await ServiceOrganisation.findAll({
      attributes: ["id", "name"],
    });
  } catch (error: any) {
    throw error;
  }
};

export const getServiceOrganisation = async (id: any) => {
  try {
    let serviceOrganisation: any = await ServiceOrganisation.findOne({
      attributes: ["id"],
      where: { id: id },
      paranoid: false,
    });
    return serviceOrganisation ? serviceOrganisation : false;
  } catch (error: any) {
    throw error;
  }
};

export default new ServiceOrganisationController();
