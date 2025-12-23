import {
  FinancialYears,
  SerialNumberCategories,
  SerialNumberGroupSerialNumberSegments,
  SerialNumberGroups,
  Client,
  VehicleType,
  VehicleMake,
  VehicleModel,
  ActivityStatus,
  SubService,
  DebugMails,
  DistanceMatrixApiDetail,
  ImportConfiguration,
  Config,
  City,
  State,
  CallCenter,
  ClientCallCenter,
  CallCenterManager,
  CaseStatus,
  CaseSubject,
  Service,
  AspActivityStatus,
} from "../database/models/index";
import distance from "google-distance-matrix";
import { Validator } from "node-input-validator";
import moment, { MomentInput } from "moment-timezone";
import { Op, Sequelize } from "sequelize";
import axios from "axios";
const config = require("../config/config.json");
import dotenv from "dotenv";
dotenv.config();

export namespace Utils {
  //API with endpoint (User Service);
  const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
  const userServiceEndpoint = config.userService.endpoint;

  //API with endpoint (Case Service);
  const caseServiceUrl = `${config.caseService.host}:${config.caseService.port}/${config.caseService.version}/${config.caseService.serviceAccess.case}`;
  const caseServiceEndpoint = config.caseService.endpoint;

  export async function generateClientSerialNumber(
    serialNumberCategoryId: number,
    categoryName: string,
    shortName: string,
    financialYearId: number,
    financialYearCode: string,
    userId: number,
    transaction: any
  ) {
    //SERIAL NUMBER CATEGORY SAVE
    let serialNumberCategory: any;
    if (!serialNumberCategoryId) {
      serialNumberCategory = await SerialNumberCategories.create(
        {
          name: categoryName,
          shortName: shortName,
          createdById: userId,
        },
        {
          transaction: transaction,
        }
      );
    } else {
      serialNumberCategory = await SerialNumberCategories.findByPk(
        serialNumberCategoryId,
        {
          paranoid: false,
        }
      );
      if (!serialNumberCategory) {
        return {
          success: false,
          error: "Serial number category not found",
        };
      }
      serialNumberCategory.updatedById = userId;
      serialNumberCategory.name = categoryName;
      serialNumberCategory.shortName = shortName;
      await serialNumberCategory.save({ transaction: transaction });
    }

    //SERIAL NUMBER GROUP SAVE
    const serialNumberGroupExistCount = await SerialNumberGroups.count({
      where: {
        categoryId: serialNumberCategory.dataValues.id,
        financialYearId: financialYearId,
      },
      paranoid: false,
    });

    let serialNumberGroup: any;
    if (serialNumberGroupExistCount === 0) {
      serialNumberGroup = await SerialNumberGroups.create(
        {
          categoryId: serialNumberCategory.dataValues.id,
          financialYearId: financialYearId,
          length: 7,
          nextNumber: 1,
          createdById: userId,
        },
        {
          transaction: transaction,
        }
      );
    } else {
      serialNumberGroup = await SerialNumberGroups.findOne({
        where: {
          categoryId: serialNumberCategory.dataValues.id,
          financialYearId: financialYearId,
        },
        paranoid: false,
      });
    }

    await SerialNumberGroupSerialNumberSegments.destroy({
      where: {
        serialNumberGroupId: serialNumberGroup.dataValues.id,
      },
      force: true,
      transaction: transaction,
    });

    const segmentDetails: any = [
      {
        serialNumberGroupId: serialNumberGroup.dataValues.id,
        segmentId: 1,
        value: shortName,
        displayOrder: 1,
      },
      {
        serialNumberGroupId: serialNumberGroup.dataValues.id,
        segmentId: 2,
        value: financialYearCode,
        displayOrder: 2,
      },
    ];
    await SerialNumberGroupSerialNumberSegments.bulkCreate(segmentDetails, {
      transaction: transaction,
    });

    return {
      success: true,
      serialNumberCategoryId: serialNumberCategory.dataValues.id,
    };
  }

  export function getCurrentFinancialYear() {
    const today = new Date();
    let financialYear: any;
    if (today.getMonth() + 1 <= 3) {
      financialYear = today.getFullYear();
    } else {
      financialYear = today.getFullYear() + 1;
    }
    return financialYear;
  }

  export async function validateParams(payload: any, validateData: any) {
    try {
      const v = new Validator(payload, validateData);
      const matched = await v.check();
      if (!matched) {
        let errors: any = [];
        for (const key of Object.keys(validateData)) {
          if (v.errors[key]) {
            errors.push(v.errors[key].message);
          }
        }
        return errors;
      }
      return "";
    } catch (error: any) {
      throw error;
    }
  }

  export function secondsToTime(seconds: any) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const hoursString = hours > 0 ? `${hours} hr` : "";
    const minutesString = minutes > 0 ? `${minutes} min` : "";
    const secondsString = remainingSeconds > 0 ? `${remainingSeconds} sec` : "";

    const timeString =
      `${hoursString} ${minutesString} ${secondsString}`.trim();
    return timeString || "0 min";
  }

  export function hasDuplicates(array: []) {
    return new Set(array).size !== array.length;
  }

  export async function findByModelId(
    model: any,
    id: number,
    attributes: any,
    include: any = null
  ) {
    try {
      const data = await model.findOne({
        attributes,
        where: { id },
        paranoid: false,
        ...(include && { include }),
      });
      return data;
    } catch (error) {
      throw error;
    }
  }

  export async function generateSerialNumber(
    serialNumberCategoryId: number,
    financialYearVal: string
  ) {
    try {
      const [serialNumberCategory, financialYear]: any = await Promise.all([
        SerialNumberCategories.findOne({
          where: { id: serialNumberCategoryId },
          attributes: ["id"],
        }),
        FinancialYears.findOne({
          where: { from: financialYearVal },
          attributes: ["id", "code"],
        }),
      ]);

      if (!serialNumberCategory) {
        return {
          success: false,
          error: "Serial number category not found",
        };
      }

      if (!financialYear) {
        return {
          success: false,
          error: "Financial year not found",
        };
      }

      const serialNumberGroup: any = await SerialNumberGroups.findOne({
        where: {
          categoryId: serialNumberCategory.dataValues.id,
          financialYearId: financialYear.dataValues.id,
        },
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
        include: {
          model: SerialNumberGroupSerialNumberSegments,
          as: "segments",
          required: true,
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
        },
        order: [["segments", "displayOrder", "asc"]],
      });
      if (!serialNumberGroup) {
        return {
          success: false,
          error: "Serial number group not found",
        };
      }
      if (serialNumberGroup.segments.length == 0) {
        return {
          success: false,
          error: "Serial number group segments not found",
        };
      }

      //GENERATE PREFIX
      const prefix = serialNumberGroup.segments
        .map((segment: any) => segment.value)
        .join("");

      //CONCATENATE PREFIX WITH NEXT NUMBER
      const serialNumber = `${prefix}${String(
        serialNumberGroup.dataValues.nextNumber
      ).padStart(serialNumberGroup.dataValues.length, "0")}`;

      //UPDATE SERIAL NUMBER GROUP NEXT NUMBER
      await SerialNumberGroups.update(
        { nextNumber: +serialNumberGroup.dataValues.nextNumber + 1 },
        {
          where: { id: serialNumberGroup.dataValues.id },
        }
      );
      return {
        success: true,
        serialNumber: serialNumber,
      };
    } catch (error) {
      throw error;
    }
  }

  export async function generateSerialNumberGroup(
    serialNumberCategoryShortName: string,
    year: string,
    length: number
  ) {
    const [financialYearExist, serialNumberCategoryExist]: any =
      await Promise.all([
        FinancialYears.findOne({
          where: { from: year },
          attributes: ["id", "code"],
        }),
        SerialNumberCategories.findOne({
          where: {
            shortName: serialNumberCategoryShortName,
          },
          attributes: ["id", "shortName"],
        }),
      ]);

    if (financialYearExist && serialNumberCategoryExist) {
      //SERIAL NUMBER GROUP SAVE
      const serialNumberGroupExist = await SerialNumberGroups.findOne({
        where: {
          categoryId: serialNumberCategoryExist.dataValues.id,
          financialYearId: financialYearExist.dataValues.id,
        },
      });
      let serialNumberGroupId = null;
      if (!serialNumberGroupExist) {
        const newSerialNumberGroup: any = await SerialNumberGroups.create({
          categoryId: serialNumberCategoryExist.dataValues.id,
          financialYearId: financialYearExist.dataValues.id,
          length: length,
          nextNumber: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        serialNumberGroupId = newSerialNumberGroup.dataValues.id;
      } else {
        serialNumberGroupId = serialNumberGroupExist.dataValues.id;
      }

      await Promise.all([
        //SERIAL NUMBER GROUP AND SEGMENT SAVE
        SerialNumberGroupSerialNumberSegments.findOrCreate({
          where: {
            serialNumberGroupId: serialNumberGroupId,
            segmentId: 1, //STATIC TEXT
          },
          defaults: {
            serialNumberGroupId: serialNumberGroupId,
            segmentId: 1, //STATIC TEXT
            value: serialNumberCategoryExist.dataValues.shortName,
            displayOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
        SerialNumberGroupSerialNumberSegments.findOrCreate({
          where: {
            serialNumberGroupId: serialNumberGroupId,
            segmentId: 2, //FINANCIAL YEAR
          },
          defaults: {
            serialNumberGroupId: serialNumberGroupId,
            segmentId: 2, //FINANCIAL YEAR
            value: financialYearExist.dataValues.code,
            displayOrder: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
      ]);
    }
  }

  export async function searchMasterData(search: any) {
    try {
      const [clients, vehicleTypes, vehicleMakes, vehicleModels, subServices] =
        await Promise.all([
          Client.findAll({
            where: { name: { [Op.like]: `%${search}%` } },
            attributes: ["id"],
            paranoid: false,
          }),
          VehicleType.findAll({
            where: { name: { [Op.like]: `%${search}%` } },
            attributes: ["id"],
            paranoid: false,
          }),
          VehicleMake.findAll({
            where: { name: { [Op.like]: `%${search}%` } },
            attributes: ["id"],
            paranoid: false,
          }),
          VehicleModel.findAll({
            where: { name: { [Op.like]: `%${search}%` } },
            attributes: ["id"],
            paranoid: false,
          }),
          SubService.findAll({
            where: { name: { [Op.like]: `%${search}%` } },
            attributes: ["id"],
            paranoid: false,
          }),
        ]);

      return {
        clientIds:
          clients.length > 0 ? clients.map((client: any) => client.id) : [],
        vehicleTypeIds:
          vehicleTypes.length > 0
            ? vehicleTypes.map((vehicleType: any) => vehicleType.id)
            : [],
        vehicleMakeIds:
          vehicleMakes.length > 0
            ? vehicleMakes.map((vehicleMake: any) => vehicleMake.id)
            : [],
        vehicleModelIds:
          vehicleModels.length > 0
            ? vehicleModels.map((vehicleModel: any) => vehicleModel.id)
            : [],
        subServiceIds:
          subServices.length > 0
            ? subServices.map((subService: any) => subService.id)
            : [],
      };
    } catch (error: any) {
      throw error;
    }
  }

  //MASTER IMPORT COMMON FUNCTIONS
  export function isValidExportFormat(format: string | undefined): boolean {
    return format !== undefined && ["xlsx", "xls", "csv"].includes(format);
  }

  //Date Filter Using StartDate and EndDate;
  export function getDateFilter(
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

  export function isExcelFormat(format: string | undefined): boolean {
    return format === "xlsx" || format === "xls";
  }

  //Excel File Header Setting;
  export function setExcelHeaders(res: any, format: string): void {
    if (format === "xlsx") {
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } else if (format === "xls") {
      res.setHeader("Content-Type", "application/vnd.ms-excel");
    }
  }

  export async function mailDebug() {
    try {
      let debugDetails = null;
      if (process.env.SMTP_DEBUG == "true") {
        debugDetails = await DebugMails.findOne({
          attributes: ["id", "to", "cc", "bcc"],
        });
      }

      return {
        success: true,
        debugDetails: debugDetails,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  //OLD CODE
  // export async function getGoogleDistanceDuration(origin: any, destinations: any) {
  //   await distance.key(process.env.GOOGLE_MAP_API_KEY);
  //   await distance.mode("driving");
  //   return new Promise((resolve, reject) => {
  //     distance.matrix(origin, destinations, function (err: any, distances: any) {
  //       if (err) {
  //         reject(err);
  //       }
  //       if (!distances) {
  //         reject("No distances available");
  //       }

  //       resolve(distances.rows);
  //     });
  //   });
  // }

  export async function getGoogleDistanceDuration(
    origin: any,
    destinations: any,
    type: number
  ) {
    const loopingLocations = [];
    if (type == 1) {
      //IF ORIGIN HAVE MULTIPLE VALUES AND DESTINATION HAVE SINGLE VALUE
      loopingLocations.push(...origin);
    } else if (type == 2) {
      //IF ORIGIN HAVE SINGLE VALUE AND DESTINATION HAVE SINGLE VALUE
      loopingLocations.push(...origin);
    } else if (type == 3) {
      //IF ORIGIN HAVE SINGLE VALUE AND DESTINATION HAVE MULTIPLE VALUES
      loopingLocations.push(...destinations);
    }

    const results = [];
    for (const loopingLocation of loopingLocations) {
      let fromLocation = null;
      let toLocation = null;
      if (type == 1) {
        //IF ORIGIN HAVE MULTIPLE VALUES AND DESTINATION HAVE SINGLE VALUE
        fromLocation = loopingLocation;
        toLocation = destinations[0];
      } else if (type == 2) {
        //IF ORIGIN HAVE SINGLE VALUE AND DESTINATION HAVE SINGLE VALUE
        fromLocation = loopingLocation;
        toLocation = destinations[0];
      } else if (type == 3) {
        //IF ORIGIN HAVE SINGLE VALUE AND DESTINATION HAVE MULTIPLE VALUES
        fromLocation = origin[0];
        toLocation = loopingLocation;
      }

      const distanceMatrixApiDetail: any =
        await DistanceMatrixApiDetail.findOne({
          attributes: ["id", "response"],
          where: {
            fromLocation: fromLocation,
            toLocation: toLocation,
          },
        });
      if (distanceMatrixApiDetail && distanceMatrixApiDetail.response) {
        results.push({
          elements: [JSON.parse(distanceMatrixApiDetail.response)],
        });
      } else {
        const apiOrigin = [fromLocation];
        const apiDestinations = [toLocation];

        await distance.key(process.env.GOOGLE_MAP_API_KEY);
        await distance.mode("driving");
        const apiResults = await new Promise<any>((resolve, reject) => {
          distance.matrix(
            apiOrigin,
            apiDestinations,
            function (err: any, distances: any) {
              if (err) {
                reject(err);
              }
              if (!distances) {
                reject("No distances available");
              }
              resolve(distances.rows);
            }
          );
        });

        if (apiResults && apiResults.length > 0) {
          for (const apiResult of apiResults) {
            results.push({
              elements: [apiResult.elements[0]],
            });

            await DistanceMatrixApiDetail.create({
              fromLocation: fromLocation,
              toLocation: toLocation,
              response: JSON.stringify(apiResult.elements[0]),
            });
          }
        } else {
          results.push({
            elements: [],
          });
        }
      }
    }
    return results;
  }

  export async function validateExcelImport(payload: any) {
    try {
      if (payload.sheetDetails && payload.sheetDetails["data"].length == 0) {
        return {
          success: false,
          error: "File data not found",
        };
      }

      const importConfigurations = await ImportConfiguration.findAll({
        where: {
          importTypeId: payload.importTypeId,
        },
        order: [["id", "asc"]],
      });
      if (importConfigurations.length == 0) {
        return {
          success: false,
          error: "Import configuration is not found for this import type",
        };
      }

      const requiredImportConfigurations: any =
        await ImportConfiguration.findAll({
          attributes: ["id", "excelColumnName"],
          where: {
            importTypeId: payload.importTypeId,
            isRequired: 1,
          },
        });

      const mandatoryFields = requiredImportConfigurations.map(
        (config: any) => config.excelColumnName
      );

      const headers = payload.sheetDetails["headers"];
      const missingFields: any = [];
      mandatoryFields.forEach((mandatoryField: any) => {
        if (!headers.includes(mandatoryField)) {
          missingFields.push(mandatoryField);
        }
      });

      if (missingFields.length > 0) {
        return {
          success: false,
          error: `Invalid file mandatory fields are missing - ${missingFields.join(
            ", "
          )}`,
        };
      }

      return {
        success: true,
        message: "Valid file",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  export async function getExcelImportColumns(importTypeId: number) {
    try {
      const importConfigurations = await ImportConfiguration.findAll({
        attributes: ["excelColumnName"],
        where: {
          importTypeId: importTypeId,
        },
        order: [["id", "asc"]],
      });
      if (importConfigurations.length == 0) {
        return {
          success: false,
          error: "Import configuration is not found for this import type",
        };
      }

      const columns = importConfigurations.map((importConfiguration: any) => {
        return importConfiguration.excelColumnName;
      });

      return {
        success: true,
        data: columns,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }

  // GET ASP RELATED SLA STATUS
  export async function getAspSlaStatus(
    caseDetail: any,
    activity: any,
    caseSlas: any,
    crmSlas: any,
    advancePaidActivityTransactions: any = []
  ) {
    try {
      let slaStatus = null;
      // STATUS IS OPEN || INPROGRESS || CLOSED
      if ([1, 2, 4].includes(caseDetail?.statusId)) {
        // DELIVERY REQUEST
        if (caseDetail?.typeId == 32 && caseSlas?.data?.success) {
          const negativeActivityStatusIds = [4, 5, 8]; // 4) Cancelled, 5) Failure, 8) Rejected
          let slaTypeId: any = null;
          // ACTIVITY STATUS IS OPEN OR ASP ACCEPTED THE SERVICE AND ADVANCE PAYMENT NOT DONE AND IN POSITIVE FLOW
          if (
            caseDetail?.agentAssignedAt &&
            (activity?.activityStatusId == 1 ||
              (activity?.aspServiceAcceptedAt &&
                advancePaidActivityTransactions?.length == 0 &&
                !negativeActivityStatusIds.includes(
                  activity?.activityStatusId
                )))
          ) {
            slaTypeId = 361; // ASP Assignment & Acceptance
          } else if (
            caseDetail?.agentAssignedAt &&
            activity?.aspServiceAcceptedAt &&
            advancePaidActivityTransactions?.[0]?.paidAt &&
            !negativeActivityStatusIds.includes(activity?.activityStatusId)
          ) {
            // ASP ACCEPTED AND PAYMENT IS DONE AND IN POSITIVE FLOW
            slaTypeId = 365; // ASP Reached Pickup
          }

          if (slaTypeId) {
            const caseSla = caseSlas.data.data.find(
              (caseSlaVal: any) => caseSlaVal.slaConfigId == slaTypeId
            );
            if (caseSla) {
              const slaName = await Config.findOne({
                where: { id: caseSla.slaConfigId },
                attributes: ["name"],
              });
              if (slaName) {
                caseSla.slaName = slaName.dataValues.name;
                delete caseSla.slaConfigId;
              }
              slaStatus = caseSla;
            }
          }
        } else if (caseDetail?.typeId == 31 && crmSlas?.length > 0) {
          const negativeActivityStatusIds = [4, 5, 8]; // 4) Cancelled, 5) Failure, 8) Rejected
          let slaTypeIds: any = [];
          let slaName = null;
          // ACTIVITY STATUS IS OPEN OR ASP ACCEPTED THE SERVICE AND ADVANCE PAYMENT NOT DONE (ONLINE PAYMENT) AND IN POSITIVE FLOW
          if (
            caseDetail?.agentAssignedAt &&
            (activity?.activityStatusId == 1 ||
              (activity?.aspServiceAcceptedAt &&
                activity?.customerNeedToPay &&
                activity?.advancePaymentMethodId == 1070 &&
                advancePaidActivityTransactions?.length == 0 &&
                !negativeActivityStatusIds.includes(
                  activity?.activityStatusId
                )))
          ) {
            slaTypeIds = [368, 866];
            slaName = "ASP Assignment & Acceptance";
          } else if (
            caseDetail?.agentAssignedAt &&
            activity?.aspServiceAcceptedAt &&
            (!activity?.customerNeedToPay ||
              (activity?.customerNeedToPay &&
                activity?.advancePaymentMethodId == 1069) ||
              (activity?.customerNeedToPay &&
                activity?.advancePaymentMethodId == 1070 &&
                advancePaidActivityTransactions?.[0]?.paidAt)) &&
            !negativeActivityStatusIds.includes(activity?.activityStatusId)
          ) {
            // ASP ACCEPTED AND PAYMENT IS DONE(FREE SERVICE OR CASH PAYMENT OR ONLINE PAYMENT) AND IN POSITIVE FLOW
            slaTypeIds = [870];
            slaName = "ASP Reached Breakdown";
          }

          if (slaTypeIds.length > 0) {
            const crmSla = crmSlas.find((crmSlaVal: any) =>
              slaTypeIds.includes(crmSlaVal.slaConfigId)
            );
            if (crmSla) {
              crmSla.slaName = slaName;
              delete crmSla.slaConfigId;
              slaStatus = crmSla;
            }
          }
        }
      }
      return slaStatus;
    } catch (error: any) {
      throw error;
    }
  }

  export function hasPermission(userPermissions: any, permissionName: string) {
    return userPermissions.some(
      (userPermission: any) => userPermission.name == permissionName
    );
  }

  export async function getCaseFilterData(userPermissions: any, userId: any) {
    try {
      //Common
      const [
        caseStatuses,
        caseSubjects,
        services,
        activityStatuses,
        aspActivityStatuses,
      ]: any = await Promise.all([
        CaseStatus.findAll({
          attributes: ["id", "name"],
          order: [["id", "ASC"]],
        }),
        CaseSubject.findAll({
          attributes: [[Sequelize.col("name"), "id"], "name"],
          group: ["name"],
          order: [["id", "ASC"]],
        }),
        Service.findAll({
          attributes: ["id", "name"],
          order: [["id", "ASC"]],
        }),
        ActivityStatus.findAll({
          attributes: ["id", "name"],
          order: [["id", "ASC"]],
        }),
        AspActivityStatus.findAll({
          attributes: ["id", "name"],
          order: [["id", "ASC"]],
          where: {
            id: {
              [Op.in]: [1, 2, 14, 15, 5, 6, 7, 8, 9, 10, 11],
            },
          },
        }),
      ]);

      let states: any = [];
      let locationCategories: any = [];
      let clients: any = [];
      if (
        userId &&
        (Utils.hasPermission(
          userPermissions,
          "sub-service-list-bo-head-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-service-head-own-web"
          ) ||
          Utils.hasPermission(userPermissions, "case-list-bo-head-own-web") ||
          Utils.hasPermission(
            userPermissions,
            "case-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-service-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-bo-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-service-head-own-web"
          ))
      ) {
        //If bo head (or) network head (or) customer experience head (or) command centre head (or) service head role then get user mapped city cases
        const apiParams: any = {};
        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-bo-head-own-web"
          ) ||
          Utils.hasPermission(userPermissions, "case-list-bo-head-own-web") ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-bo-head-own-web"
          )
        ) {
          //BO head
          apiParams.where = {
            boHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-network-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-network-head-own-web"
          )
        ) {
          //Network head
          apiParams.where = {
            networkHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-customer-experience-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-customer-experience-head-own-web"
          )
        ) {
          //Customer Experience Head
          apiParams.where = {
            customerExperienceHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-command-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-command-centre-head-own-web"
          )
        ) {
          //Command Centre Head
          apiParams.where = {
            commandCentreHeadId: userId,
          };
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-service-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-service-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-service-head-own-web"
          )
        ) {
          //Service Head
          apiParams.where = {
            serviceHeadId: userId,
          };
        }

        const cities = await City.findAll({
          attributes: ["id", "name", "stateId", "locationCategoryId"],
          where: apiParams.where,
          paranoid: false,
        });

        const uniqueStateIds = [
          ...new Set(cities.map((city: any) => city.stateId)),
        ];

        const uniqueLocationCategoryIds = [
          ...new Set(cities.map((city: any) => city.locationCategoryId)),
        ];

        const [stateRecords, locationCategoryRecords, clientRecords]: any =
          await Promise.all([
            State.findAll({
              attributes: ["id", "name"],
              where: {
                id: {
                  [Op.in]: uniqueStateIds,
                },
              },
              order: [["id", "ASC"]],
            }),
            Config.findAll({
              attributes: ["id", "name"],
              where: {
                id: {
                  [Op.in]: uniqueLocationCategoryIds,
                },
              },
              order: [["id", "ASC"]],
            }),
            Client.findAll({
              attributes: ["id", "name"],
              order: [["id", "ASC"]],
            }),
          ]);

        states = stateRecords;
        locationCategories = locationCategoryRecords;
        clients = clientRecords;
      } else if (
        userId &&
        (Utils.hasPermission(
          userPermissions,
          "sub-service-list-tvs-spoc-own-web"
        ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-manager-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-team-leader-agents-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-sme-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-agent-view-own-web"
          ) ||
          Utils.hasPermission(userPermissions, "case-list-tvs-spoc-own-web") ||
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-manager-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-team-leader-agents-own-web"
          ) ||
          Utils.hasPermission(userPermissions, "case-list-sme-own-web") ||
          Utils.hasPermission(
            userPermissions,
            "case-list-agent-view-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-tvs-spoc-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-call-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-call-centre-manager-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-team-leader-agents-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-sme-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-agent-view-own-web"
          ))
      ) {
        let clientDetails: any = [];
        if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-tvs-spoc-own-web"
          ) ||
          Utils.hasPermission(userPermissions, "case-list-tvs-spoc-own-web") ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-tvs-spoc-own-web"
          )
        ) {
          clientDetails = await Client.findAll({
            attributes: ["id"],
            where: {
              spocUserId: userId,
            },
            paranoid: false,
          });
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-head-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-call-centre-head-own-web"
          )
        ) {
          const callCenters = await CallCenter.findAll({
            attributes: ["id"],
            where: {
              callCentreHeadId: userId,
            },
            paranoid: false,
          });

          const callCenterIds = callCenters.map(
            (callCenter: any) => callCenter.id
          );

          clientDetails = await Client.findAll({
            attributes: ["id"],
            paranoid: false,
            include: [
              {
                model: ClientCallCenter,
                as: "callCenters",
                attributes: ["id"],
                required: true,
                where: {
                  callCenterId: {
                    [Op.in]: callCenterIds,
                  },
                },
              },
            ],
            group: ["id"],
          });
        } else if (
          Utils.hasPermission(
            userPermissions,
            "sub-service-list-call-centre-manager-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "case-list-call-centre-manager-own-web"
          ) ||
          Utils.hasPermission(
            userPermissions,
            "reimbursement-list-call-centre-manager-own-web"
          )
        ) {
          const callCenterManagers = await CallCenterManager.findAll({
            attributes: ["id", "callCenterId"],
            where: {
              managerId: userId,
            },
          });

          const callCenterIds = callCenterManagers.map(
            (callCenterManager: any) => callCenterManager.callCenterId
          );
          clientDetails = await Client.findAll({
            attributes: ["id"],
            paranoid: false,
            include: [
              {
                model: ClientCallCenter,
                as: "callCenters",
                attributes: ["id"],
                required: true,
                where: {
                  callCenterId: {
                    [Op.in]: callCenterIds,
                  },
                },
              },
            ],
            group: ["id"],
          });
        } else {
          const apiParams: any = {};
          apiParams.roleId = 3; //Agent
          if (
            Utils.hasPermission(
              userPermissions,
              "sub-service-list-team-leader-agents-own-web"
            ) ||
            Utils.hasPermission(
              userPermissions,
              "case-list-team-leader-agents-own-web"
            ) ||
            Utils.hasPermission(
              userPermissions,
              "reimbursement-list-team-leader-agents-own-web"
            )
          ) {
            //Team leader
            apiParams.where = {
              tlId: userId,
            };
          } else if (
            Utils.hasPermission(
              userPermissions,
              "sub-service-list-sme-own-web"
            ) ||
            Utils.hasPermission(userPermissions, "case-list-sme-own-web") ||
            Utils.hasPermission(
              userPermissions,
              "reimbursement-list-sme-own-web"
            )
          ) {
            //SME
            apiParams.where = {
              smeUserId: userId,
            };
          } else if (
            Utils.hasPermission(
              userPermissions,
              "sub-service-list-agent-view-own-web"
            ) ||
            Utils.hasPermission(
              userPermissions,
              "case-list-agent-view-own-web"
            ) ||
            Utils.hasPermission(
              userPermissions,
              "reimbursement-list-agent-view-own-web"
            )
          ) {
            //SME
            apiParams.where = {
              id: userId,
            };
          }

          const agentDetails = await axios.post(
            `${userServiceUrl}/${userServiceEndpoint.getAgentsByRole}`,
            apiParams
          );

          let agentIds = [];
          if (agentDetails.data.success) {
            agentIds = agentDetails.data.data.map(
              (agentDetail: any) => agentDetail.id
            );
          }

          if (agentIds.length > 0) {
            const getUserClients = await axios.post(
              `${userServiceUrl}/${userServiceEndpoint.getClientsByUser}`,
              { userIds: agentIds }
            );

            if (getUserClients.data.success) {
              getUserClients.data.userClients.map((userClient: any) => {
                clientDetails.push({
                  id: userClient.clientId,
                });
              });
            }
          }
        }

        const clientIds = clientDetails.map(
          (clientDetail: any) => clientDetail.id
        );

        const [stateRecords, locationCategoryRecords, clientRecords]: any =
          await Promise.all([
            State.findAll({
              attributes: ["id", "name"],
              order: [["id", "ASC"]],
            }),
            Config.findAll({
              attributes: ["id", "name"],
              where: {
                typeId: 55, //City Location Categories
              },
              order: [["id", "ASC"]],
            }),
            Client.findAll({
              attributes: ["id", "name"],
              ...(clientIds.length > 0 && {
                where: {
                  id: {
                    [Op.in]: clientIds,
                  },
                },
              }),
              order: [["id", "ASC"]],
            }),
          ]);

        states = stateRecords;
        locationCategories = locationCategoryRecords;
        clients = clientRecords;
      } else {
        const [stateRecords, locationCategoryRecords, clientRecords]: any =
          await Promise.all([
            State.findAll({
              attributes: ["id", "name"],
              order: [["id", "ASC"]],
            }),
            Config.findAll({
              attributes: ["id", "name"],
              where: {
                typeId: 55, //City Location Categories
              },
              order: [["id", "ASC"]],
            }),
            Client.findAll({
              attributes: ["id", "name"],
              order: [["id", "ASC"]],
            }),
          ]);

        states = stateRecords;
        locationCategories = locationCategoryRecords;
        clients = clientRecords;
      }

      return {
        caseStatuses,
        caseSubjects,
        services,
        activityStatuses,
        aspActivityStatuses,
        states,
        locationCategories,
        clients,
      };
    } catch (error: any) {
      throw error;
    }
  }

  export function convertToIndianCurrencyFormat(amount: any) {
    const formattedAmount = amount.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    return formattedAmount;
  }

  export async function aspMechanicInProgressActivities(aspMechanicIds: number[], serviceScheduledDate?: string) {
    try {
      if (aspMechanicIds.length === 0) {
        return {
          success: false,
          error: "ASP Mechanic IDs are required",
        };
      }

      const response = await axios.post(
        `${caseServiceUrl}/${caseServiceEndpoint.case.getAspMechanicInProgressActivities}`,
        {
          aspMechanicIds: aspMechanicIds,
          serviceScheduledDate: serviceScheduledDate || null,
        }
      );
      if (!response.data.success) {
        return {
          success: false,
          error: response.data.error,
        };
      }

      return {
        success: true,
        data: response.data.aspMechanicInProgressActivities,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message,
      };
    }
  }
}

export default Utils;
