import { Op, Sequelize } from "sequelize";
import {
  CaseSubject,
  Client,
  Service,
  SubjectService,
} from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import moment, { MomentInput } from "moment-timezone";

import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import caseSubject from "../database/models/caseSubject";
import { getSubServices } from "./subService";
import { getEntitlements } from "./entitlement";

class ServiceController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, apiType, status } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let services: any;

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        services = await Service.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (services.length === 0) {
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
              `( IF (service.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = ServiceController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = ServiceController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        services = await Service.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(service.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (service.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (services.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: services,
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getFormData = async (req: Request, res: Response) => {
    try {
      const { serviceId } = req.query;
      let serviceData = null;
      console.log(serviceId);
      if (serviceId) {
        const serviceExists: any = await Service.findOne({
          where: {
            id: serviceId,
          },
          paranoid: false,
        });

        if (!serviceExists) {
          return res.status(200).json({
            success: false,
            error: "Service not found",
          });
        }

        serviceData = {
          id: serviceExists.dataValues.id,
          name: serviceExists.dataValues.name,
          status: serviceExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        service: serviceData,
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      console.log(error);
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
      const v = new Validator(payload, {
        status: "required|numeric",
        serviceIds: "required|array",
        "serviceIds.*": "required",
      });

      const matched = await v.check();
      if (!matched) {
        const errors: any = [];
        Object.keys(payload).forEach((key) => {
          if (v.errors[key]) {
            errors.push(v.errors[key].message);
          }
        });
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { serviceIds, status, updatedById, deletedById } = payload;
      if (serviceIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one service",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const serviceId of serviceIds) {
        const serviceExists = await Service.findOne({
          where: {
            id: serviceId,
          },
          paranoid: false,
        });
        if (!serviceExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Service (${serviceId}) not found`,
          });
        }

        await Service.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: serviceId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Service status updated successfully",
      });
    } catch (error: any) {
      console.log(error);
      await transaction.rollback();
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
      const v = new Validator(payload, {
        serviceIds: "required|array",
        "serviceIds.*": "required",
      });

      const matched = await v.check();
      if (!matched) {
        const errors: any = [];
        Object.keys(payload).forEach((key) => {
          if (v.errors[key]) {
            errors.push(v.errors[key].message);
          }
        });
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { serviceIds } = payload;
      if (serviceIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one service",
        });
      }

      for (const serviceId of serviceIds) {
        const serviceExists = await Service.findOne({
          where: {
            id: serviceId,
          },
          paranoid: false,
        });
        if (!serviceExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Service (${serviceId}) not found`,
          });
        }

        await Service.destroy({
          where: {
            id: serviceId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Service deleted successfully",
      });
    } catch (error: any) {
      console.log(error);
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

  public async serviceDataExport(req: Request, res: Response) {
    try {
      const { format, startDate, endDate }: any = req.query;

      if (!format || !["xlsx", "csv", "xls"].includes(format)) {
        return res.status(200).json({
          success: false,
          error: "Invalid or missing export format",
        });
      }

      let where: any = {};
      if (startDate && endDate) {
        const dateFilter = getDateFilter(startDate, endDate);
        where.createdAt = dateFilter;
      }

      const serviceData = await Service.findAll({
        where,
        attributes: ["name", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!serviceData || serviceData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Service not found",
        });
      }

      //Get Final Data of Service
      const serviceFinalData: any = await getServiceFinalData(serviceData);

      // Column Filter
      const renamedUserColumnNames = Object.keys(serviceFinalData[0]);

      let buffer;

      if (format === "xlsx" || format === "xls") {
        buffer = generateXLSXAndXLSExport(
          serviceFinalData,
          renamedUserColumnNames,
          format,
          "Service"
        );
        if (format === "xlsx") {
          res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          );
        } else if (format === "xls") {
          res.setHeader("Content-Type", "application/vnd.ms-excel");
        }
      } else if (format === "csv") {
        buffer = generateCSVExport(serviceFinalData, renamedUserColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `Service data export successfully`,
        data: buffer,
        format: format,
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //Service Import;
  public async serviceDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      const importColumns = ["Name", "Status"];
      for (const data1 of inData) {
        let data2 = data1["data"];
        for (const data3 of data2) {
          importColumns.forEach((importColumn) => {
            if (!data3.hasOwnProperty(importColumn)) {
              data3[importColumn] = "";
            }
          });

          let reArrangedServices: any = {
            Name: String(data3["Name"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedServices) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedServices[key];
          }

          let serviceId = null;
          if (record.name) {
            const trimedServiceName = record.name.trim();
            const nameAlreadyExists = await Service.findOne({
              where: {
                name: trimedServiceName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              serviceId = nameAlreadyExists.dataValues.id;
            }
          }

          //REQUESTS FOR SUBJECT SAVE`
          record.serviceId = serviceId;
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
              ...reArrangedServices,
              Error: errorContent,
            });
          } else {
            if (output.message === "Service created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New service created successfully (${newRecordsCreated} records) and existing service updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New service created successfully (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing service updated (${existingRecordsUpdated} records)`
          : "No service updated or created";

      //If No Record Have Error Send Respond
      if (errorData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Service
      const serviceFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(serviceFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        serviceFinalData,
        renamedUserColumnNames,
        "xlsx",
        "Service"
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
      console.log(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  getSubjectService = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const v = new Validator(payload, {
        subjectId: "required|numeric",
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

      const { subjectId } = payload;
      const subjectServiceResponse = await getSubjectServiceDetails(subjectId);
      if (!subjectServiceResponse.success) {
        return res.status(200).json(subjectServiceResponse);
      }

      return res.status(200).json({
        success: true,
        data: subjectServiceResponse.data,
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getServiceWithEntitlementDetails = async (req: Request, res: Response) => {
    try {
      const data = req.body;
      let subServiceIds = [];
      let entitlementIds = [];

      const service = await Service.findOne({
        where: { id: data.serviceId },
        paranoid: false,
        attributes: ["id", "name"],
      });

      // let service;
      if (
        data &&
        data.customerServiceEntitlements &&
        data.customerServiceEntitlements.length > 0
      ) {
        for (let d of data.customerServiceEntitlements) {
          subServiceIds.push(d.subServiceId);
          entitlementIds.push(d.entitlementId);
        }
      }

      let subServices = await getSubServices(subServiceIds);
      let entitlements = await getEntitlements(entitlementIds);
      return res.status(200).json({
        success: true,
        data: {
          service: service,
          subServices: subServices.success ? subServices.data : null,
          entitlements: entitlements.success ? entitlements.data : null,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
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
    const v = new Validator(payload, {
      serviceId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      status: "required|numeric",
    });

    const matched = await v.check();
    if (!matched) {
      const errors: any = [];
      Object.keys(payload).forEach((key) => {
        if (v.errors[key]) {
          errors.push(v.errors[key].message);
        }
      });
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

    const { serviceId, name, ...inputData } = payload;
    const serviceName = name.trim();

    //CUSTOM VALIDATIONS
    if (serviceId) {
      const service = await Service.findOne({
        attributes: ["id"],
        where: {
          id: serviceId,
        },
        paranoid: false,
      });
      if (!service) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Service not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Service not found",
          });
        }
      }

      const serviceAlreadyExists = await Service.findOne({
        where: {
          name: serviceName,
          id: {
            [Op.ne]: serviceId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (serviceAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Service is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Service is already taken",
          });
        }
      }
    } else {
      const serviceAlreadyExists = await Service.findOne({
        where: {
          name: serviceName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (serviceAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Service is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Service is already taken",
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
      name: serviceName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (serviceId) {
      await Service.update(data, {
        where: {
          id: serviceId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Service updated successfully";
    } else {
      await Service.create(data, {
        transaction: transaction,
      });
      message = "Service created successfully";
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
    console.log(error);
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

//Service Export Sub Functions;
//Date Filter
function getDateFilter(
  startDate: string | undefined,
  endDate: string | undefined
): any {
  if (startDate !== undefined && endDate !== undefined) {
    const startOfDay = moment
      .tz(startDate as MomentInput, "Asia/Kolkata")
      .startOf("day")
      .format("YYYY-MM-DD HH:mm:ss");
    const endOfDay = moment
      .tz(endDate as MomentInput, "Asia/Kolkata")
      .endOf("day")
      .format("YYYY-MM-DD HH:mm:ss");
    return { [Op.between]: [startOfDay, endOfDay] };
  }
  return undefined;
}

//Data Column and Data key, value rearrange (Final Data)
async function getServiceFinalData(serviceData: any) {
  const transformedData = await Promise.all(
    serviceData.map(async (serviceData: any) => {
      return {
        Name: serviceData.dataValues.name,
        "Created At": moment
          .tz(serviceData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: serviceData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );

  return transformedData;
}

export const getSubjectServiceDetails = async (subjectId: number) => {
  try {
    const subjectExists = await CaseSubject.findOne({
      where: {
        id: subjectId,
      },
      include: [
        {
          model: SubjectService,
          as: "subjectServices",
          attributes: ["id", "serviceId"],
          required: false,
        },
      ],
      paranoid: false,
    });
    if (!subjectExists) {
      return {
        success: false,
        error: `Case subject detail not found`,
      };
    }

    let serviceIds: any = [];
    if (subjectExists.dataValues.subjectServices.length > 0) {
      serviceIds = subjectExists.dataValues.subjectServices.map(
        (subjectService: any) => subjectService.dataValues.serviceId
      );
    }

    let services = await Service.findAll({
      where: {
        id: {
          [Op.in]: serviceIds,
        },
      },
      attributes: ["id", "name"],
    });
    if (services.length == 0) {
      return {
        success: false,
        error: `Service detail not found`,
      };
    }

    return {
      success: true,
      data: services,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

export default new ServiceController();
