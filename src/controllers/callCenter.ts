import { Op, Sequelize } from "sequelize";
import {
  CallCenterLocation,
  CallCenter,
  CallCenterManager,
} from "../database/models/index";
import { Request, Response } from "express";
import sequelize from "../database/connection";
import { Validator } from "node-input-validator";
import moment, { MomentInput } from "moment-timezone";
import Utils from "../lib/utils";
import axios from "axios";
import config from "../config/config.json";
import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class CallCenterController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, apiType, status } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let callCenters: any;

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        callCenters = await CallCenter.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (callCenters.length === 0) {
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
            { address: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { phoneNumber: { [Op.like]: `%${search}%` } },
            { whatsappNumber: { [Op.like]: `%${search}%` } },
            Sequelize.literal(
              `( IF (deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = CallCenterController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = CallCenterController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        callCenters = await CallCenter.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "address",
            "email",
            "phoneNumber",
            "tollFreeNumber",
            "whatsappNumber",
            [
              Sequelize.literal(
                "(SELECT IF(isCommandCenter = 1, 'Yes', 'No'))"
              ),
              "isCommandCenter",
            ],
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

        if (callCenters.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: callCenters,
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
      const { callCenterId } = req.query;
      let callCenterData = null;

      if (callCenterId) {
        const callCenterExists: any = await CallCenter.findOne({
          where: {
            id: callCenterId,
          },
          include: [
            {
              model: CallCenterManager,
              as: "callCenterManagers",
              attributes: ["id", "managerId"],
              required: false,
            },
          ],
          paranoid: false,
        });

        if (!callCenterExists) {
          return res.status(200).json({
            success: false,
            error: "Call center not found",
          });
        }

        callCenterData = {
          id: callCenterExists.dataValues.id,
          name: callCenterExists.dataValues.name,
          address: callCenterExists.dataValues.address,
          callCentreHeadId: callCenterExists.dataValues.callCentreHeadId,
          isCommandCenter: callCenterExists.dataValues.isCommandCenter ? 1 : 0,
          managers: callCenterExists.dataValues.callCenterManagers,
          email: callCenterExists.dataValues.email,
          phoneNumber: callCenterExists.dataValues.phoneNumber,
          tollFreeNumber: callCenterExists.dataValues.tollFreeNumber,
          whatsappNumber: callCenterExists.dataValues.whatsappNumber,
          spocEmailIds: callCenterExists.dataValues.spocEmailIds,
          status: callCenterExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      //GET ALL CALL CENTRE MANAGERS AND CALL CENTRE HEADS
      const getUsersResponse: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getUsersByRoles}`,
        {
          roleIds: [16, 25],
        }
      );

      let callCentreHeads = [];
      let callCentreManagers = [];
      if (getUsersResponse.data.success) {
        callCentreHeads = getUsersResponse.data.data
          .filter((user: any) => user.roleId === 25)
          .map((roleUser: any) => ({ id: roleUser.id, name: roleUser.name }));

        callCentreManagers = getUsersResponse.data.data
          .filter((user: any) => user.roleId === 16)
          .map((roleUser: any) => ({ id: roleUser.id, name: roleUser.name }));
      }

      const data = {
        callCenter: callCenterData,
        extras: {
          callCentreHeads: callCentreHeads,
          callCentreManagers: callCentreManagers,
        },
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
        callCenterIds: "required|array",
        "callCenterIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { callCenterIds } = payload;
      if (callCenterIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one call center",
        });
      }

      for (const callCenterId of callCenterIds) {
        const callCenterExists = await CallCenter.findOne({
          where: {
            id: callCenterId,
          },
          paranoid: false,
        });
        if (!callCenterExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Call center (${callCenterId}) not found`,
          });
        }

        await CallCenter.destroy({
          where: {
            id: callCenterId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Call center deleted successfully",
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
        callCenterIds: "required|array",
        "callCenterIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { callCenterIds, status, updatedById, deletedById } = payload;
      if (callCenterIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one call center",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const callCenterId of callCenterIds) {
        const callCenterExists = await CallCenter.findOne({
          where: {
            id: callCenterId,
          },
          paranoid: false,
        });
        if (!callCenterExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Call center (${callCenterId}) not found`,
          });
        }

        await CallCenter.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: callCenterId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Call center status updated successfully",
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

  //Call Center Export
  public async callCenterDataExport(req: Request, res: Response) {
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

      const callCenterData = await CallCenter.findAll({
        where,
        attributes: [
          "name",
          "address",
          "callCentreHeadId",
          "isCommandCenter",
          "email",
          "phoneNumber",
          "tollFreeNumber",
          "whatsappNumber",
          "spocEmailIds",
          "createdAt",
          "deletedAt",
        ],
        paranoid: false,
        include: [
          {
            model: CallCenterManager,
            attributes: ["managerId"],
            as: "callCenterManagers",
            required: false,
          },
        ],
      });

      if (!callCenterData || callCenterData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Vehicle make
      const callCenterFinalData: any = await getCallCenterFinalData(
        callCenterData
      );

      // Column Filter
      const renamedCallCenterColumnNames = Object.keys(callCenterFinalData[0]);

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          callCenterFinalData,
          renamedCallCenterColumnNames,
          format,
          "CallCenters"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          callCenterFinalData,
          renamedCallCenterColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `call center data export successfully`,
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

  //Call Center Import;
  public async callCenterDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = [
      //   "Name",
      //   "Address",
      //   "Call Centre Head User Name",
      //   "Call Centre Manager User Names",
      //   "Status",
      // ];

      const importColumnsResponse = await Utils.getExcelImportColumns(1099);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1099,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      //GET CALL CENTRE MANAGER AND CALL CENTRE HEAD USER DETAILS
      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          roleIds: [16, 25],
        }
      );
      let managerDetails = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        managerDetails = getUserDetails.data.data.roleUserDetails;
      }

      for (const data1 of inData) {
        let data2 = data1["data"];
        for (const data3 of data2) {
          importColumns.forEach((importColumn: any) => {
            if (!data3.hasOwnProperty(importColumn)) {
              data3[importColumn] = "";
            }
          });

          let reArrangedCallCenters: any = {
            Name: String(data3["Name"]),
            Address: String(data3["Address"]),
            "Call Centre Head User Name": data3["Call Centre Head User Name"]
              ? String(data3["Call Centre Head User Name"])
              : null,
            "Call Centre Manager User Names": data3[
              "Call Centre Manager User Names"
            ]
              ? String(data3["Call Centre Manager User Names"])
              : null,
            "Is Command Center": data3["Is Command Center"]
              ? String(data3["Is Command Center"])
              : null,
            Email: data3["Email"] ? String(data3["Email"]) : null,
            "Phone Number": data3["Phone Number"]
              ? String(data3["Phone Number"])
              : null,
            "Toll Free Number": data3["Toll Free Number"]
              ? String(data3["Toll Free Number"])
              : null,
            "Whatsapp Number": data3["Whatsapp Number"]
              ? String(data3["Whatsapp Number"])
              : null,
            "Spoc Email Ids": data3["Spoc Email Ids"]
              ? String(data3["Spoc Email Ids"])
              : null,
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedCallCenters) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedCallCenters[key];
          }

          const validationErrors = [];
          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          if (
            record.isCommandCenter &&
            !["Yes", "No"].includes(record.isCommandCenter)
          ) {
            validationErrors.push(
              "Is command center value should be Yes or No."
            );
          }

          if (record.phoneNumber && !/^[0-9]{10}$/.test(record.phoneNumber)) {
            validationErrors.push("Invalid phone number.");
          }

          if (
            record.tollFreeNumber &&
            !/^1[89]00\d{6}$/.test(record.tollFreeNumber)
          ) {
            validationErrors.push("Invalid toll free number.");
          }

          if (
            record.whatsappNumber &&
            !/^[0-9]{10}$/.test(record.whatsappNumber)
          ) {
            validationErrors.push("Invalid whatsapp number.");
          }

          // Validate SPOC Email Ids (comma-separated emails)
          if (record.spocEmailIds) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const emails = record.spocEmailIds.split(",").map((email: string) => email.trim()).filter((email: string) => email.length > 0);
            const invalidEmails = emails.filter((email: string) => !emailRegex.test(email));
            if (invalidEmails.length > 0) {
              validationErrors.push(`Invalid email(s) in SPOC Email Ids: ${invalidEmails.join(", ")}`);
            }
          }

          if (validationErrors.length > 0) {
            errorOutData.push({
              ...reArrangedCallCenters,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //CALL CENTRE
          let callCenterId = null;
          if (record.name) {
            const trimmedCallCenterName = record.name.trim();
            const nameAlreadyExists = await CallCenter.findOne({
              where: {
                name: trimmedCallCenterName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              callCenterId = nameAlreadyExists.dataValues.id;
            }
          }

          //CALL CENTRE HEAD
          let callCentreHeadId = null;
          if (record.callCentreHeadUserName) {
            const trimmedCallCentreHeadUserName =
              record.callCentreHeadUserName.trim();
            const callCentreHeadDetail = managerDetails.find(
              (managerDetail: any) =>
                managerDetail.userName == trimmedCallCentreHeadUserName &&
                managerDetail.roleId == 25
            );
            if (callCentreHeadDetail) {
              callCentreHeadId = callCentreHeadDetail.id;
            }
          }

          //CALL CENTRE MANAGERS
          let callCentreManagerIds = [];
          let callCentreManagerDetails = [];
          if (record.callCentreManagerUserNames) {
            for (const callCenterManagerUserName of record.callCentreManagerUserNames.split(
              ","
            )) {
              const trimmedCallCentreManagerUserName =
                callCenterManagerUserName.trim();
              const callCentreManagerDetail = managerDetails.find(
                (managerDetail: any) =>
                  managerDetail.userName == trimmedCallCentreManagerUserName &&
                  managerDetail.roleId == 16
              );
              if (callCentreManagerDetail) {
                callCentreManagerIds.push(callCentreManagerDetail.id);
              }

              callCentreManagerDetails.push({
                userName: trimmedCallCentreManagerUserName,
                id: callCentreManagerDetail ? callCentreManagerDetail.id : null,
              });
            }
          }

          //SAVE REQUEST
          record.callCenterId = callCenterId;
          record.callCentreHeadId = callCentreHeadId;
          record.callCentreManagerUserNames = callCentreManagerDetails;
          record.managerIds = callCentreManagerIds;
          record.authUserId = req.body.authUserId;
          record.createdById = req.body.authUserId;
          record.updatedById = req.body.authUserId;
          record.isCommandCenter =
            record.isCommandCenter &&
              record.isCommandCenter.trim().toLowerCase() === "yes"
              ? 1
              : 0;
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
              ...reArrangedCallCenters,
              Error: errorContent,
            });
          } else {
            if (output.message === "Call center created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New call center created (${newRecordsCreated} records) and existing call center updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New call center created (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing call center updated (${existingRecordsUpdated} records)`
              : "No call center updated or created";

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
        "Call Center"
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

  getCallCenterByName = async (req: Request, res: Response) => {
    try {
      const payload = req.body;

      const v = {
        name: "required|string",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const trimedName = payload.name.trim();
      const callCenterExist: any = await CallCenter.findOne({
        where: { name: trimedName },
        attributes: ["id", "name"],
        paranoid: false,
      });
      if (!callCenterExist) {
        return res.status(200).json({
          success: false,
          error: "Call center not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Call center found",
        data: callCenterExist,
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
async function getCallCenterFinalData(callCenterData: any) {
  //GET CALL CENTRE MANAGER AND CALL CENTRE HEAD USER DETAIL
  const userIds = new Set();
  for (const callCentre of callCenterData) {
    if (callCentre.callCentreHeadId) {
      userIds.add(callCentre.callCentreHeadId);
    }

    for (const callCentreManager of callCentre.callCenterManagers) {
      userIds.add(callCentreManager.managerId);
    }
  }
  const uniqueUserIdsArray = [...userIds];

  let userDetails: any = [];
  if (uniqueUserIdsArray && uniqueUserIdsArray.length > 0) {
    const getUserDetails: any = await axios.post(
      `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
      {
        userIds: uniqueUserIdsArray,
      }
    );

    if (getUserDetails.data && getUserDetails.data.success) {
      userDetails = getUserDetails.data.data.userDetails;
    }
  }

  const transformedData = await Promise.all(
    callCenterData.map(async (callCenterData: any) => {
      let callCenterHeadDetail = null;
      if (callCenterData.dataValues.callCentreHeadId) {
        callCenterHeadDetail = userDetails.find(
          (userDetail: any) =>
            userDetail.id == callCenterData.dataValues.callCentreHeadId
        );
      }

      let callCenterManagerNames = [];
      for (const callCentreManager of callCenterData.callCenterManagers) {
        const callCentreManagerDetail = userDetails.find(
          (userDetail: any) => userDetail.id == callCentreManager.managerId
        );

        if (callCentreManagerDetail) {
          callCenterManagerNames.push(callCentreManagerDetail.name);
        }
      }

      return {
        Name: callCenterData.dataValues.name,
        Address: callCenterData.dataValues.address,
        "Call Center Head": callCenterHeadDetail
          ? callCenterHeadDetail.name
          : null,
        "Call Center Managers": callCenterManagerNames.join(", "),
        "Is Command Center": callCenterData.dataValues.isCommandCenter
          ? "Yes"
          : "No",
        Email: callCenterData.dataValues.email,
        "Phone Number": callCenterData.dataValues.phoneNumber,
        "Toll Free Number": callCenterData.dataValues.tollFreeNumber,
        "Whatsapp Number": callCenterData.dataValues.whatsappNumber,
        "SPOC Email IDs": callCenterData.dataValues.spocEmailIds,
        "Created At": moment
          .tz(callCenterData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: callCenterData.dataValues.deletedAt ? "Inactive" : "Active",
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
      callCenterId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      address: "required|string",
      // managerIds: "required|array",
      // "managerIds.*": "required",
      isCommandCenter: "required|numeric",
      email: "email",
      phoneNumber: "string|minLength:10|maxLength:10",
      tollFreeNumber: "required|string|maxLength:20",
      whatsappNumber: "required|string|minLength:10|maxLength:10",
      spocEmailIds: "string",
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

    // Custom validation for tollFreeNumber pattern
    if (payload.tollFreeNumber && !/^1[89]00\d{6}$/.test(payload.tollFreeNumber)) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Invalid toll free number.",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Invalid toll free number.",
        });
      }
    }

    if (!payload.managerIds || payload.managerIds.length == 0) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Call center manager not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Call center manager not found",
        });
      }
    }

    const { callCenterId, name, address, ...inputData } = payload;
    const callCenterName = name.trim();
    const callCenterAddress = address.trim();

    // Trim spocEmailIds if provided
    if (inputData.spocEmailIds) {
      inputData.spocEmailIds = inputData.spocEmailIds.trim();
    }

    if (importData) {
      if (payload.callCentreHeadUserName && !payload.callCentreHeadId) {
        await transaction.rollback();
        return {
          success: false,
          error: "Call centre head not found",
          data: payload,
        };
      }

      if (payload.callCentreManagerUserNames) {
        for (const callCentreManagerDetail of payload.callCentreManagerUserNames) {
          const trimmedCallCentreManagerUserName =
            callCentreManagerDetail.userName.trim();

          if (trimmedCallCentreManagerUserName && !callCentreManagerDetail.id) {
            await transaction.rollback();
            return {
              success: false,
              error: `Call centre manager ${trimmedCallCentreManagerUserName} not found`,
              data: payload,
            };
          }
        }
      }
    }

    //CUSTOM VALIDATIONS
    if (callCenterId) {
      const callCenter = await CallCenter.findOne({
        attributes: ["id"],
        where: {
          id: callCenterId,
        },
        paranoid: false,
        transaction: transaction,
      });
      if (!callCenter) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Call center not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Call center not found",
          });
        }
      }

      const callCenterAlreadyExists = await CallCenter.findOne({
        where: {
          name: callCenterName,
          id: {
            [Op.ne]: callCenterId,
          },
        },
        attributes: ["id"],
        paranoid: false,
        transaction: transaction,
      });
      if (callCenterAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Call center is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Call center is already taken",
          });
        }
      }
    } else {
      const callCenterAlreadyExists = await CallCenter.findOne({
        where: {
          name: callCenterName,
        },
        attributes: ["id"],
        paranoid: false,
        transaction: transaction,
      });
      if (callCenterAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Call center is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Call center is already taken",
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
      name: callCenterName,
      address: callCenterAddress,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    let savedCallCenterId: number;
    if (callCenterId) {
      await CallCenter.update(data, {
        where: {
          id: callCenterId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Call center updated successfully";
      savedCallCenterId = callCenterId;
    } else {
      const newCallCenter = await CallCenter.create(data, {
        transaction: transaction,
      });
      message = "Call center created successfully";
      savedCallCenterId = newCallCenter.dataValues.id;
    }

    //PROCESS CALL CENTER MANAGERS
    if (payload.managerIds.length > 0) {
      await CallCenterManager.destroy({
        where: {
          callCenterId: savedCallCenterId,
        },
        force: true,
        transaction: transaction,
      });

      const callCenterManagerData = payload.managerIds.map(
        (managerId: number) => ({
          callCenterId: savedCallCenterId,
          managerId: managerId,
        })
      );
      await CallCenterManager.bulkCreate(callCenterManagerData, {
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

export default new CallCenterController();
