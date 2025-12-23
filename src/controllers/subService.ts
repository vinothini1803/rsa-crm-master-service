import { Op, Sequelize } from "sequelize";
import {
  Service,
  SubService,
  CaseSubject,
  Client,
  SubjectService,
  SubServiceEntitlement,
  Entitlement,
} from "../database/models/index";
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

class SubServiceController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, serviceId, search, apiType, status, caseType } =
        req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let subServices: any;
      if (serviceId) {
        where.serviceId = serviceId;
      }

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }
        //RSA
        if (caseType == 31) {
          where.id = {
            [Op.notIn]: [1], //VEHICLE TRANSFER
          };
        } else if (caseType == 32) {
          //VDM
          where.id = {
            [Op.in]: [1], //VEHICLE TRANSFER
          };
        }

        subServices = await SubService.findAll({
          where,
          attributes: [
            "id",
            "name",
            "hasLimit",
            "hasAspAssignment",
            "hasEntitlement",
          ],
          order: [["id", "asc"]],
        });
        if (subServices.length === 0) {
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
              `( IF (subService.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
            {
              "$service.name$": { [Op.like]: `%${search}%` },
            },
          ];
        }

        // Limitation value setup
        let limitValue: number = SubServiceController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = SubServiceController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        subServices = await SubService.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            [Sequelize.col("service.name"), "serviceName"],
            [
              Sequelize.literal(
                "(SELECT IF(hasAspAssignment = 1, 'Yes', 'No'))"
              ),
              "hasAspAssignment",
            ],
            [
              Sequelize.literal("(SELECT IF(hasLimit = 1, 'Yes', 'No'))"),
              "hasLimit",
            ],
            [
              Sequelize.literal("(SELECT IF(hasEntitlement = 1, 'Yes', 'No'))"),
              "hasEntitlement",
            ],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(subService.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (subService.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: Service,
              as: "service",
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

        if (subServices.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: subServices,
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
      const { subServiceId } = req.query;
      let subServiceData = null;

      if (subServiceId) {
        const subServiceExists: any = await SubService.findOne({
          where: {
            id: subServiceId,
          },
          include: [
            {
              model: Service,
              as: "service",
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
            {
              model: SubServiceEntitlement,
              as: "subServiceEntitlements",
              attributes: ["entitlementId"],
              required: false,
              paranoid: false,
            },
          ],
          paranoid: false,
        });

        if (!subServiceExists) {
          return res.status(200).json({
            success: false,
            error: "Sub service not found",
          });
        }

        subServiceData = {
          id: subServiceExists.dataValues.id,
          name: subServiceExists.dataValues.name,
          serviceId: subServiceExists.dataValues.serviceId,
          hasAspAssignment: subServiceExists.dataValues.hasAspAssignment
            ? 1
            : 0,
          hasLimit: subServiceExists.dataValues.hasLimit ? 1 : 0,
          hasEntitlement: subServiceExists.dataValues.hasEntitlement ? 1 : 0,
          entitlements: subServiceExists.dataValues.subServiceEntitlements,
          status: subServiceExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      //EXTRAS
      const services = await Service.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      const entitlements = await Entitlement.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      const extras = {
        services: services,
        entitlements: entitlements,
      };

      const data = {
        subService: subServiceData,
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

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;

      const v = {
        status: "required|numeric",
        subServiceIds: "required|array",
        "subServiceIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { subServiceIds, status, updatedById, deletedById } = payload;
      if (subServiceIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one sub service",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const subServiceId of subServiceIds) {
        const subServiceExists = await SubService.findOne({
          where: {
            id: subServiceId,
          },
          paranoid: false,
        });
        if (!subServiceExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Sub service (${subServiceId}) not found`,
          });
        }

        await SubService.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: subServiceId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Sub service status updated successfully",
      });
    } catch (error: any) {
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

      const v = {
        subServiceIds: "required|array",
        "subServiceIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { subServiceIds } = payload;
      if (subServiceIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one sub service",
        });
      }

      for (const subServiceId of subServiceIds) {
        const subServiceExists = await SubService.findOne({
          where: {
            id: subServiceId,
          },
          paranoid: false,
        });
        if (!subServiceExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Sub service (${subServiceId}) not found`,
          });
        }

        await SubService.destroy({
          where: {
            id: subServiceId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Sub service deleted successfully",
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

  public async subServiceDataExport(req: Request, res: Response) {
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

      const subServiceData = await SubService.findAll({
        where,
        attributes: [
          "name",
          "serviceId",
          "hasAspAssignment",
          "hasLimit",
          "hasEntitlement",
          "activityTime",
          "createdAt",
          "deletedAt",
        ],
        paranoid: false,
        include: [
          {
            model: SubServiceEntitlement,
            attributes: ["entitlementId"],
            as: "subServiceEntitlements",
            required: false,
            paranoid: false,
          },
        ],
      });

      if (!subServiceData || subServiceData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Sub Service
      const subServiceFinalData: any = await getSubServiceFinalData(
        subServiceData
      );

      // Column Filter
      const renamedSubServiceColumnNames = Object.keys(subServiceFinalData[0]);
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          subServiceFinalData,
          renamedSubServiceColumnNames,
          format,
          "SubServices"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          subServiceFinalData,
          renamedSubServiceColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Sub Service data export successfully`,
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

  //Sub Service Import;
  public async subServiceDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = [
      //   "Name",
      //   "Service Name",
      //   "Has Asp Assignment",
      //   "Has Limit",
      //   // 'Activity Time',
      //   "Has Entitlement",
      //   "Entitlement Names",
      //   "Status",
      // ];

      const importColumnsResponse = await Utils.getExcelImportColumns(1106);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1106,
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
          let reArrangedSubServices: any = {
            Name: data3["Name"] ? String(data3["Name"]) : null,
            "Service Name": data3["Service Name"]
              ? String(data3["Service Name"])
              : null,
            "Has Asp Assignment": data3["Has Asp Assignment"]
              ? String(data3["Has Asp Assignment"])
              : null,
            "Has Limit": data3["Has Limit"] ? String(data3["Has Limit"]) : null,
            // 'Activity Time': data3['Activity Time'] ? String(data3['Activity Time']) : null,
            "Has Entitlement": data3["Has Entitlement"]
              ? String(data3["Has Entitlement"])
              : null,
            "Entitlement Names": data3["Entitlement Names"]
              ? String(data3["Entitlement Names"])
              : null,
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };
          const record: any = {};
          const keyMapping: any = {
            serviceName: "serviceId",
            entitlementNames: "entitlementDetails",
          };

          for (const key in reArrangedSubServices) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedSubServices[key];
          }

          const validationErrors = [];
          if (
            record.hasAspAssignment &&
            !["Yes", "No"].includes(record.hasAspAssignment)
          ) {
            validationErrors.push(
              "Has asp assignment value should be Yes or No."
            );
          }

          if (record.hasLimit && !["Yes", "No"].includes(record.hasLimit)) {
            validationErrors.push("Has limit value should be Yes or No.");
          }

          if (
            record.hasEntitlement &&
            !["Yes", "No"].includes(record.hasEntitlement)
          ) {
            validationErrors.push("Has entitlement value should be Yes or No.");
          }

          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          if (validationErrors.length > 0) {
            errorOutData.push({
              ...reArrangedSubServices,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //SERVICE
          let serviceId = 0;
          if (record.serviceId) {
            const trimmedServiceName = record.serviceId.trim();
            const nameAlreadyExists = await Service.findOne({
              where: {
                name: trimmedServiceName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              serviceId = nameAlreadyExists.dataValues.id;
            }
          }

          let subServiceId = null;
          if (record.name && serviceId) {
            const trimmedSubServiceName = record.name.trim();
            const nameAlreadyExists = await SubService.findOne({
              where: {
                name: trimmedSubServiceName,
                serviceId: serviceId,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              subServiceId = nameAlreadyExists.dataValues.id;
            }
          }

          //SUB SERVICE ENTITLEMENTS
          let entitlementIds = [];
          let entitlementDetails = [];
          if (record.entitlementDetails) {
            for (const entitlementDetail of record.entitlementDetails.split(
              ","
            )) {
              const trimmedEntitlementName = entitlementDetail.trim();
              const entitlement: any = await Entitlement.findOne({
                where: {
                  name: trimmedEntitlementName,
                },
                attributes: ["id"],
                paranoid: false,
              });

              if (entitlement) {
                entitlementIds.push(entitlement.id);
              }

              entitlementDetails.push({
                name: trimmedEntitlementName,
                id: entitlement ? entitlement.id : null,
              });
            }
          }

          //REQUESTS FOR SUBJECT SAVE
          record.subServiceId = subServiceId;
          record.serviceId = serviceId;
          record.hasAspAssignment =
            record.hasAspAssignment &&
            record.hasAspAssignment.trim().toLowerCase() === "yes"
              ? 1
              : 0;
          record.hasLimit =
            record.hasLimit && record.hasLimit.trim().toLowerCase() === "yes"
              ? 1
              : 0;
          record.authUserId = req.body.authUserId;
          record.createdById = req.body.authUserId;
          record.updatedById = req.body.authUserId;
          record.hasEntitlement =
            record.hasEntitlement &&
            record.hasEntitlement.trim().toLowerCase() === "yes"
              ? 1
              : 0;
          record.entitlementDetails = entitlementDetails;
          record.entitlementIds = entitlementIds;
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
              ...reArrangedSubServices,
              Error: errorContent,
            });
          } else {
            if (output.message === "Sub service created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New sub service created (${newRecordsCreated} records) and existing sub service updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New sub service created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing sub service updated (${existingRecordsUpdated} records)`
          : "No sub service updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Sub Service
      const subServiceFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(subServiceFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        subServiceFinalData,
        renamedUserColumnNames,
        "xlsx",
        "Sub Service"
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

  getSubjectSubService = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const v = {
        subjectId: "required|numeric",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { subjectId } = payload;
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
            paranoid: false,
          },
        ],
        paranoid: false,
      });
      if (!subjectExists) {
        return res.status(200).json({
          success: false,
          error: `Case subject not found`,
        });
      }

      let serviceIds: any = [];
      if (subjectExists.dataValues.subjectServices.length > 0) {
        serviceIds = subjectExists.dataValues.subjectServices.map(
          (subjectService: any) => subjectService.dataValues.serviceId
        );
      }

      let subServices = await SubService.findAll({
        where: {
          serviceId: {
            [Op.in]: serviceIds,
          },
        },
        attributes: ["id", "name"],
      });
      if (subServices.length == 0) {
        return res.status(200).json({
          success: false,
          error: `Sub services not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: subServices,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getSubServices = async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (ids) {
        const subServices: any = await SubService.findAll({
          where: { id: { [Op.in]: ids } },
        });

        if (!subServices) {
          return res.status(200).json({
            success: false,
            error: "Sub Service not found",
          });
        }
        return res.status(200).json({
          success: true,
          data: subServices,
        });
      }
      return res.status(200).json({
        success: false,
        error: "Sub Service Id is required",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public async getServiceSubServices(req: any, res: any) {
    try {
      const payload = req.body;

      const v = {
        serviceId: "required|numeric",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const subServiceExists = await SubService.findAll({
        where: {
          serviceId: payload.serviceId,
        },
        attributes: ["id", "name"],
      });
      if (subServiceExists.length == 0) {
        return res.status(200).json({
          success: false,
          error: `Sub services not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: subServiceExists,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  getEntitlements = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const v = {
        subServiceId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const subService: any = await SubService.findOne({
        attributes: ["id", "name"],
        where: {
          id: payload.subServiceId,
        },
        include: [
          {
            model: SubServiceEntitlement,
            as: "subServiceEntitlements",
            attributes: ["entitlementId"],
            required: false,
          },
        ],
        paranoid: false,
      });

      if (!subService) {
        return res.status(200).json({
          success: false,
          error: `Sub service not found`,
        });
      }

      let entitlementIds: any = [];
      if (subService.subServiceEntitlements.length > 0) {
        entitlementIds = subService.subServiceEntitlements.map(
          (subServiceEntitlement: any) => subServiceEntitlement.entitlementId
        );
      }

      const entitlements = await Entitlement.findAll({
        attributes: ["id", "name"],
        where: {
          id: { [Op.in]: entitlementIds },
        },
      });
      if (entitlements.length == 0) {
        return res.status(200).json({
          success: false,
          error: `Entitlements not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: entitlements,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
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
    const v = {
      subServiceId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      serviceId: "required|numeric",
      hasAspAssignment: "required|numeric",
      hasLimit: "required|numeric",
      hasEntitlement: "required|numeric",
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

    const { subServiceId, name, ...inputData } = payload;
    const subServiceName = name.trim();
    //CUSTOM VALIDATIONS
    const service = await Service.findByPk(inputData.serviceId);
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

    //If has entitlement then entitlements is required.
    if (
      payload.hasEntitlement == 1 &&
      (!payload.entitlementIds || payload.entitlementIds.length == 0)
    ) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Entitlements not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Entitlements not found",
        });
      }
    }

    if (
      importData &&
      payload.hasEntitlement == 1 &&
      payload.entitlementDetails
    ) {
      for (const entitlementDetail of payload.entitlementDetails) {
        const trimmedSubServiceEntitlementName = entitlementDetail.name.trim();

        if (trimmedSubServiceEntitlementName && !entitlementDetail.id) {
          await transaction.rollback();
          return {
            success: false,
            error: `Sub Service entitlement ${trimmedSubServiceEntitlementName} not found`,
            data: payload,
          };
        }
      }
    }

    if (subServiceId) {
      const subService = await SubService.findOne({
        attributes: ["id"],
        where: {
          id: subServiceId,
        },
        paranoid: false,
      });
      if (!subService) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Sub service not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Sub service not found",
          });
        }
      }

      const subServiceAlreadyExists = await SubService.findOne({
        where: {
          name: subServiceName,
          serviceId: service.dataValues.id,
          id: {
            [Op.ne]: subServiceId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (subServiceAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Sub service is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Sub service is already taken",
          });
        }
      }
    } else {
      const subServiceAlreadyExists = await SubService.findOne({
        where: {
          name: subServiceName,
          serviceId: service.dataValues.id,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (subServiceAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Sub service is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Sub service is already taken",
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
      name: subServiceName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };
    let message = null;
    let savedSubServiceId: number;
    if (subServiceId) {
      await SubService.update(data, {
        where: {
          id: subServiceId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Sub service updated successfully";
      savedSubServiceId = subServiceId;
    } else {
      const newSubService = await SubService.create(data, {
        transaction: transaction,
      });
      message = "Sub service created successfully";
      savedSubServiceId = newSubService.dataValues.id;
    }

    //PROCESS SUB SERVICE ENTITLEMENTS
    await SubServiceEntitlement.destroy({
      where: {
        subServiceId: savedSubServiceId,
      },
      force: true,
      transaction: transaction,
    });
    if (payload.hasEntitlement == 1 && payload.entitlementIds.length > 0) {
      const subServiceEntitlementData = payload.entitlementIds.map(
        (entitlementId: number) => ({
          subServiceId: savedSubServiceId,
          entitlementId: entitlementId,
        })
      );
      await SubServiceEntitlement.bulkCreate(subServiceEntitlementData, {
        transaction,
      });
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
async function getSubServiceFinalData(subServiceData: any) {
  //GET CALL CENTRE MANAGER AND CALL CENTRE HEAD USER DETAIL
  const entitlementIds = new Set();
  for (const subService of subServiceData) {
    for (const subServiceEntitlementData of subService.subServiceEntitlements) {
      entitlementIds.add(subServiceEntitlementData.entitlementId);
    }
  }
  const uniqueEntitlementIdsArray = [...entitlementIds];

  let entitlementDetails: any = [];
  if (uniqueEntitlementIdsArray && uniqueEntitlementIdsArray.length > 0) {
    const entitlements = await Entitlement.findAll({
      attributes: ["id", "name"],
      where: {
        id: {
          [Op.in]: uniqueEntitlementIdsArray,
        },
      },
      paranoid: false,
    });

    if (entitlements.length > 0) {
      entitlementDetails = entitlements;
    }
  }

  const transformedData = await Promise.all(
    subServiceData.map(async (subServiceData: any) => {
      const serviceId: any = await Service.findOne({
        attributes: ["id", "name"],
        where: { id: subServiceData.dataValues.serviceId },
        paranoid: false,
      });

      let entitlementNames = [];
      for (const subServiceEntitlement of subServiceData.subServiceEntitlements) {
        const subServiceEntitlementDetail = entitlementDetails.find(
          (entitlementDetail: any) =>
            entitlementDetail.id == subServiceEntitlement.entitlementId
        );

        if (subServiceEntitlementDetail) {
          entitlementNames.push(subServiceEntitlementDetail.name);
        }
      }

      return {
        Name: subServiceData.dataValues.name,
        "Service Name": serviceId ? serviceId.dataValues.name : null,
        "Has Asp Assignment": subServiceData.dataValues.hasAspAssignment
          ? "Yes"
          : "No",
        "Has Limit": subServiceData.dataValues.hasLimit ? "Yes" : "No",
        // 'Activity Time': subServiceData.dataValues.activityTime,

        "Created At": moment
          .tz(subServiceData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        "Has Entitlement": subServiceData.dataValues.hasEntitlement
          ? "Yes"
          : "No",
        Entitlements: entitlementNames.join(", "),
        Status: subServiceData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );
  return transformedData;
}

export const getSubServices = async (ids: any) => {
  try {
    if (ids.length) {
      const subServices: any = await SubService.findAll({
        attributes: ["id", "name"],
        where: { id: { [Op.in]: ids } },
        paranoid: false,
      });
      if (subServices.length == 0) {
        return {
          success: false,
          error: "Sub Service not found",
        };
      }
      return {
        success: true,
        data: subServices,
      };
    }
    return {
      success: false,
      error: "Sub Service ID is required",
    };
  } catch (error: any) {
    throw error;
  }
};

export const getSubService = async (id: any) => {
  try {
    return await SubService.findOne({
      where: { id: id },
      attributes: ["id", "name"],
      include: [
        {
          model: Service,
          attributes: ["id", "name"],
        },
      ],
    });
  } catch (error: any) {
    throw error;
  }
};

export default new SubServiceController();
