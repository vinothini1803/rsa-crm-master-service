import { Op, Sequelize } from "sequelize";
import { ServiceDescription } from "../database/models/index";
import sequelize from "../database/connection";
import Utils from "../lib/utils";

import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class ServiceDescriptionController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;

  constructor() {}

  public async getList(req: any, res: any) {
    try {
      let { limit, offset, apiType, search, status } = req.query;
      let query: any = {
        where: {},
      };
      let result: any;

      if (search) {
        query.where.name = {
          [Op.like]: `%${search}%`,
        };
      }

      if (apiType && apiType == "dropdown") {
        query.attributes = ["id", "name"];
        query.order = [["id", "asc"]];
        result = await ServiceDescription.findAll(query);
      } else {
        if (status) {
          //ACTIVE
          if (status.toLowerCase() == "active") {
            query.where.deletedAt = {
              [Op.is]: null,
            };
          } else if (status.toLowerCase() == "inactive") {
            //INACTIVE
            query.where.deletedAt = {
              [Op.not]: null,
            };
          }
        }

        if (!limit) {
          limit = ServiceDescriptionController.defaultLimit;
        }

        if (!offset) {
          offset = ServiceDescriptionController.defaultOffset;
        }

        query.limit = parseInt(limit);
        query.offset = parseInt(offset);
        query.paranoid = false;
        query.order = [["id", "desc"]];

        query.attributes = [
          "id",
          "name",
          "createdById",
          "updatedById",
          "deletedById",
          "createdAt",
          "updatedAt",
          "deletedAt",
          [
            Sequelize.literal(
              "( SELECT DATE_FORMAT(serviceDescription.createdAt,'%d/%m/%Y %h:%i %p') )"
            ),
            "formattedCreatedAt",
          ],
          [
            Sequelize.literal(
              "( SELECT IF (serviceDescription.deletedAt IS NULL, 'Active', 'Inactive') )"
            ),
            "status",
          ],
        ];

        result = await ServiceDescription.findAndCountAll(query);
      }

      if (result.length === 0) {
        return res.status(200).json({ success: false, error: "No data found" });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  public updateStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = {
        serviceDescriptionIds: "required|array",
        status: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }
      const { serviceDescriptionIds, status, updatedById, deletedById } = payload;

      //Inactive
      let deletedAt = null;
      let deletedByAuthId = null;
      if (status == 0) {
        deletedAt = new Date();
        deletedByAuthId = deletedById;
      }

      for (const serviceDescriptionId of serviceDescriptionIds) {
        const serviceDescriptionExists = await ServiceDescription.findOne({
          attributes: ["id"],
          where: {
            id: serviceDescriptionId,
          },
          paranoid: false,
        });
        if (!serviceDescriptionExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Service Description Id - (${serviceDescriptionId}) not found`,
          });
        }
        await ServiceDescription.update(
          { updatedById, deletedById : deletedByAuthId, deletedAt },
          {
            where: { id: serviceDescriptionId },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Service Description status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  public getFormData = async (req: any, res: any) => {
    try {
      const { serviceDescriptionId } = req.query;
      let payload = req.query;
      const v = {
        serviceDescriptionId: "required|numeric",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let serviceDescription: any = {};

      if (serviceDescriptionId) {
        const serviceDescriptionExists: any = await ServiceDescription.findOne({
          where: { id: serviceDescriptionId },
          paranoid: false,
        });

        if (!serviceDescriptionExists) {
          return res.status(200).json({
            success: false,
            error: "Service Description not found",
          });
        }

        serviceDescription = {
          id: serviceDescriptionExists.dataValues.id,
          name: serviceDescriptionExists.dataValues.name,
          status: serviceDescriptionExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      return res.status(200).json({
        success: true,
        data: { serviceDescription: serviceDescription },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public delete = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = { serviceDescriptionIds: "required|array" };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { serviceDescriptionIds } = payload;

      for (const serviceDescriptionId of serviceDescriptionIds) {
        const serviceDescriptionExists = await ServiceDescription.findOne({
          attributes: ["id"],
          where: {
            id: serviceDescriptionId,
          },
          paranoid: false,
        });
        if (!serviceDescriptionExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Service Description Id - (${serviceDescriptionId}) not found`,
          });
        }

        await ServiceDescription.destroy({
          where: {
            id: serviceDescriptionId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Service Description deleted successfully",
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
    return save(req, res);
  };

  public async import(req: any, res: any) {
    try {
      const inData: any[] = req.body.jsonDataArray;
      const errorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      const importColumnsResponse = await Utils.getExcelImportColumns(1402);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1402,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const serviceDescriptionSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const serviceDescriptionSheet of serviceDescriptionSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!serviceDescriptionSheet.hasOwnProperty(importColumn)) {
            serviceDescriptionSheet[importColumn] = "";
          }
        });

        let reArrangedServiceDescriptions: any = {
          Name: serviceDescriptionSheet["Name"]
            ? String(serviceDescriptionSheet["Name"])
            : null,
          Status: serviceDescriptionSheet["Status"]
            ? String(serviceDescriptionSheet["Status"])
            : null,
        };

        if (serviceDescriptionSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedServiceDescriptions) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedServiceDescriptions[key];
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
              ...reArrangedServiceDescriptions,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //SERVICE DESCRIPTION
          let serviceDescriptionId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const serviceDescriptionAlreadyExists = await ServiceDescription.findOne({
              where: {
                name: trimmedName,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (serviceDescriptionAlreadyExists) {
              serviceDescriptionId = serviceDescriptionAlreadyExists.dataValues.id;
            }
          }

          record.serviceDescriptionId = serviceDescriptionId;
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
              ...reArrangedServiceDescriptions,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "Service description created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedServiceDescriptions,
            Error: "Service description name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New service description created (${newRecordsCreated} records) and existing service description updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New service description created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing service description updated (${existingRecordsUpdated} records)`
          : "No service description created or updated";

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
        "ServiceDescription"
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

      const serviceDescriptions = await ServiceDescription.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!serviceDescriptions || serviceDescriptions.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let serviceDescriptionDetailsArray: any[] = [];
      for (const serviceDescription of serviceDescriptions) {
        serviceDescriptionDetailsArray.push({
          Name: serviceDescription.dataValues.name,
          "Created At": moment
            .tz(serviceDescription.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: serviceDescription.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const serviceDescriptionColumnNames = serviceDescriptionDetailsArray
        ? Object.keys(serviceDescriptionDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          serviceDescriptionDetailsArray,
          serviceDescriptionColumnNames,
          format,
          "Service Description"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          serviceDescriptionDetailsArray,
          serviceDescriptionColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Service description data export successfully`,
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
    let payload;
    if (importData) {
      payload = importData;
    } else {
      payload = req.body;
    }

    const v = {
      name: "required|string",
      status: "numeric",
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

    let data: any = {
      name: payload.name,
      deletedAt: null,
      deletedById: null,
    };

    if (payload.status == 0) {
      data.deletedAt = new Date();
      data.deletedById = payload.authUserId;
    }

    let message = null;
    if (payload.serviceDescriptionId) {
      const serviceDescriptionExists: any = await ServiceDescription.findOne({
        where: { id: payload.serviceDescriptionId },
        paranoid: false,
      });
      if (!serviceDescriptionExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `Service Description Id - (${payload.serviceDescriptionId}) not found`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `Service Description Id - (${payload.serviceDescriptionId}) not found`,
          });
        }
      }

      // validate check
      const validateServiceDescription: any = await ServiceDescription.findOne({
        where: {
          id: {
            [Op.ne]: payload.serviceDescriptionId, // Exclude the current record being updated
          },
          name: payload.name,
        },
        paranoid: false,
      });
      if (validateServiceDescription) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `The name ${payload.name} already exists`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `The name ${payload.name} already exists`,
          });
        }
      }

      data.updatedById = payload.authUserId;
      await ServiceDescription.update(data, {
        where: { id: payload.serviceDescriptionId },
        transaction: transaction,
        paranoid: false,
      });
      message = "Service description updated successfully";
    } else {
      const serviceDescriptionExists: any = await ServiceDescription.findOne({
        where: { name: payload.name },
        paranoid: false,
      });
      if (serviceDescriptionExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `Service Description already exists in this name`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `Service Description already exists in this name`,
          });
        }
      }

      data.createdById = payload.authUserId;
      await ServiceDescription.create(data, { transaction: transaction });
      message = "Service description created successfully";
    }
    await transaction.commit();
    if (importData) {
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

    if (importData) {
      return {
        success: false,
        error: error?.message,
        data: importData,
      };
    } else {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export default new ServiceDescriptionController();
