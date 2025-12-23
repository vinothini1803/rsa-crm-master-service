import { Op, Sequelize } from "sequelize";
import { SlaViolateReason } from "../database/models/index";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import config from "../config/config.json";
import axios from "axios";
import moment from "moment-timezone";

import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class SlaViolateReasonController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, roleId, id, apiType, search, status } = req.query;
      const where: any = {};
      if (id) {
        where.id = id;
      }

      if (roleId) {
        where.roleId = {
          [Op.regexp]: `(^|,)${roleId}(,|$)`,
        };
      }

      let slaViolateReasons: any = null;
      if (apiType === "dropdown") {
        if (search) {
          where.name = { [Op.like]: `%${search}%` };
        }

        slaViolateReasons = await SlaViolateReason.findAll({
          where,
          attributes: ["id", "name", "roleId"],
          order: [["id", "asc"]],
        });
        if (slaViolateReasons.length === 0) {
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
              `( IF (deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
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

        let limitValue: number = SlaViolateReasonController.defaultLimit;
        if (limit) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        let offsetValue: number = SlaViolateReasonController.defaultOffset;
        if (offset) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        const slaViolateReasonDetails = await SlaViolateReason.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "roleId",
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
        if (slaViolateReasonDetails.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }

        const roleIds = slaViolateReasonDetails.rows
          .map((item: any) => item.roleId.split(","))
          .flat()
          .map(Number);

        if (roleIds.length > 0) {
          const uniqueRoleIds = [...new Set(roleIds)];
          const getRolesDetail: any = await axios.post(
            `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getByIds}`,
            { roleIds: uniqueRoleIds }
          );
          if (getRolesDetail.data.success) {
            const roleLookup = getRolesDetail.data.data.reduce(
              (acc: any, role: any) => {
                acc[role.id] = role.name;
                return acc;
              },
              {}
            );

            const roleUpdatedSlaViolateReasons =
              slaViolateReasonDetails.rows.map((item: any) => {
                const roleIds = item.roleId.split(",").map(Number);
                const roleNames = roleIds.map((id: number) => roleLookup[id]);
                return {
                  ...item.toJSON(),
                  roleNames,
                };
              });

            slaViolateReasons = {
              count: slaViolateReasonDetails.count,
              rows: roleUpdatedSlaViolateReasons,
            };
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: slaViolateReasons,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  updateStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = {
        status: "required|numeric",
        slaViolateReasonIds: "required|array",
        "slaViolateReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { slaViolateReasonIds, status, updatedById, deletedById } = payload;
      if (slaViolateReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one SLA violate reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const slaViolateReasonId of slaViolateReasonIds) {
        const slaViolateReasonExists = await SlaViolateReason.findOne({
          attributes: ["id"],
          where: {
            id: slaViolateReasonId,
          },
          paranoid: false,
        });
        if (!slaViolateReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `SLA violate reason (${slaViolateReasonId}) not found`,
          });
        }

        await SlaViolateReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: slaViolateReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "SLA violate reason status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  // save = async (req: any, res: any) => {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     let payload = req.body;
  //     const v = {
  //       slaViolateReasonId: "numeric",
  //       roleId: "required|string",
  //       name: "required|string|minLength:3|maxLength:255",
  //       status: "required|numeric",
  //     };
  //     const errors = await Utils.validateParams(payload, v);
  //     if (errors) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         errors: errors,
  //       });
  //     }

  //     const { slaViolateReasonId, name, ...inputData } = payload;
  //     const slaViolateReasonName = name.trim();

  //     if (slaViolateReasonId) {
  //       const slaViolateReason = await SlaViolateReason.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: slaViolateReasonId,
  //         },
  //         paranoid: false,
  //       });
  //       if (!slaViolateReason) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "SLA violate reason not found",
  //         });
  //       }

  //       const slaViolateReasonAlreadyExists = await SlaViolateReason.findOne({
  //         where: {
  //           name: slaViolateReasonName,
  //           id: {
  //             [Op.ne]: slaViolateReasonId,
  //           },
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (slaViolateReasonAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "SLA violate reason name is already taken",
  //         });
  //       }
  //     } else {
  //       const slaViolateReasonAlreadyExists = await SlaViolateReason.findOne({
  //         where: {
  //           name: slaViolateReasonName,
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (slaViolateReasonAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "SLA violate reason name is already taken",
  //         });
  //       }
  //     }

  //     //DATA PROCESS
  //     let deletedAt = null;
  //     let deletedById = null;
  //     //INACTIVE
  //     if (inputData.status == 0) {
  //       deletedAt = new Date();
  //       deletedById = inputData.authUserId;
  //     }

  //     const data: any = {
  //       ...inputData,
  //       name: slaViolateReasonName,
  //       deletedById: deletedById,
  //       deletedAt: deletedAt,
  //     };

  //     let message = null;
  //     if (slaViolateReasonId) {
  //       await SlaViolateReason.update(data, {
  //         where: {
  //           id: slaViolateReasonId,
  //         },
  //         paranoid: false,
  //         transaction: transaction,
  //       });
  //       message = "SLA violate reason updated successfully";
  //     } else {
  //       await SlaViolateReason.create(data, {
  //         transaction: transaction,
  //       });
  //       message = "SLA violate reason created successfully";
  //     }

  //     await transaction.commit();
  //     return res.status(200).json({
  //       success: true,
  //       message: message,
  //     });
  //   } catch (error: any) {
  //     await transaction.rollback();
  //     return res.status(500).json({
  //       success: false,
  //       error: error?.message,
  //     });
  //   }
  // };

  delete = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = {
        slaViolateReasonIds: "required|array",
        "slaViolateReasonIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { slaViolateReasonIds } = payload;
      if (slaViolateReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one SLA violate reason",
        });
      }

      for (const slaViolateReasonId of slaViolateReasonIds) {
        const slaViolateReasonExists = await SlaViolateReason.findOne({
          attributes: ["id"],
          where: {
            id: slaViolateReasonId,
          },
          paranoid: false,
        });
        if (!slaViolateReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `SLA violate reason (${slaViolateReasonId}) not found`,
          });
        }

        await SlaViolateReason.destroy({
          where: {
            id: slaViolateReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "SLA violate reason deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getFormData = async (req: any, res: any) => {
    try {
      const { slaViolateReasonId } = req.query;
      let slaViolateReasonData = null;
      if (slaViolateReasonId) {
        const slaViolateReasonExists: any = await SlaViolateReason.findOne({
          attributes: ["id", "roleId", "name", "deletedAt"],
          where: {
            id: slaViolateReasonId,
          },
          paranoid: false,
        });

        if (!slaViolateReasonExists) {
          return res.status(200).json({
            success: false,
            error: "SLA violate reason not found",
          });
        }

        slaViolateReasonData = {
          id: slaViolateReasonExists.dataValues.id,
          roleId: slaViolateReasonExists.dataValues.roleId,
          name: slaViolateReasonExists.dataValues.name,
          status: slaViolateReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        slaViolateReason: slaViolateReasonData,
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

  getById = async (req: any, res: any) => {
    try {
      const { slaViolateReasonId } = req.query;
      const slaViolateReason: any = await SlaViolateReason.findOne({
        attributes: ["id", "name"],
        where: {
          id: slaViolateReasonId,
        },
        paranoid: false,
      });

      if (!slaViolateReason) {
        return res.status(200).json({
          success: false,
          error: "SLA violate reason not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          slaViolateReason: slaViolateReason,
        },
      });
    } catch (error: any) {
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
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Role Names", "Name", "Status"];

      const importColumnsResponse = await Utils.getExcelImportColumns(1107);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1107,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      //GET ALL ROLE DETAILS
      const getRoleDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          getAllRoles: true,
        }
      );
      let roleDetails = [];
      if (getRoleDetails.data && getRoleDetails.data.success) {
        roleDetails = getRoleDetails.data.data.allRoles;
      }

      for (const data1 of inData) {
        let data2 = data1["data"];
        for (const data3 of data2) {
          importColumns.forEach((importColumn: any) => {
            if (!data3.hasOwnProperty(importColumn)) {
              data3[importColumn] = "";
            }
          });

          let reArrangedSlaViolateReasons: any = {
            "Role Names": data3["Role Names"]
              ? String(data3["Role Names"])
              : null,
            Name: data3["Name"] ? String(data3["Name"]) : null,
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedSlaViolateReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedSlaViolateReasons[key];
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
              ...reArrangedSlaViolateReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //SLA VIOLATE REASON
          let slaViolateReasonId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const slaViolateReasonExists = await SlaViolateReason.findOne({
              attributes: ["id"],
              where: {
                name: trimmedName,
              },
              paranoid: false,
            });

            if (slaViolateReasonExists) {
              slaViolateReasonId = slaViolateReasonExists.dataValues.id;
            }
          }

          //ROLES
          let roleIds = [];
          let roleNameAndIds = [];
          if (record.roleNames) {
            const trimmedRoleNames = record.roleNames.trim();
            const roleNamesArray = trimmedRoleNames.split(",");

            for (const roleNameArray of roleNamesArray) {
              const roleExists = roleDetails.find(
                (roleDetail: any) => roleDetail.name == roleNameArray
              );
              if (roleExists) {
                roleIds.push(roleExists.id);
              }

              roleNameAndIds.push({
                name: roleNameArray,
                id: roleExists ? roleExists.id : null,
              });
            }
          }

          //REQUESTS
          record.slaViolateReasonId = slaViolateReasonId;
          record.roleId = roleIds.join(",");
          record.roleNameAndIds = roleNameAndIds;
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
              ...reArrangedSlaViolateReasons,
              Error: errorContent,
            });
          } else {
            if (output.message === "SLA violate reason created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New SLA violate reason created (${newRecordsCreated} records) and existing SLA violate reason updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New SLA violate reason created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing SLA violate reason updated (${existingRecordsUpdated} records)`
          : "No SLA violate reason updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Vehicle Type
      const slaViolateReasonData: any = errorOutData;

      // Column Filter
      const renamedSlaViolateReasonColumnNames = Object.keys(
        slaViolateReasonData[0]
      );

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        slaViolateReasonData,
        renamedSlaViolateReasonColumnNames,
        "xlsx",
        "SLA Violate Reason"
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

      const slaViolateReasons: any = await SlaViolateReason.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!slaViolateReasons || slaViolateReasons.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      const rolePrimaryIds: any = [];
      for (const slaViolateReasonData of slaViolateReasons) {
        const roleIdsArray = slaViolateReasonData.roleId.split(",");
        rolePrimaryIds.push(...roleIdsArray);
      }
      const uniqueRoleIds = [...new Set(rolePrimaryIds)];

      let roleDetails: any = [];
      if (uniqueRoleIds && uniqueRoleIds.length > 0) {
        const getRoleDetails: any = await axios.post(
          `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
          {
            rolePrimaryIds: uniqueRoleIds,
          }
        );

        if (getRoleDetails.data && getRoleDetails.data.success) {
          roleDetails = getRoleDetails.data.data.roleDetails;
        }
      }

      let slaViolateReasonDetailsArray: any[] = [];
      for (const slaViolateReason of slaViolateReasons) {
        const roleNames = [];
        const roleIdsArray = slaViolateReason.roleId.split(",");
        for (const roleId of roleIdsArray) {
          const role = roleDetails.find(
            (role: any) => role.id === parseInt(roleId)
          );
          if (role) {
            roleNames.push(role.name);
          }
        }

        slaViolateReasonDetailsArray.push({
          Name: slaViolateReason.dataValues.name,
          Roles: roleNames.join(","),
          "Created At": moment
            .tz(slaViolateReason.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: slaViolateReason.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const slaViolateReasonColumnNames = slaViolateReasonDetailsArray
        ? Object.keys(slaViolateReasonDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          slaViolateReasonDetailsArray,
          slaViolateReasonColumnNames,
          format,
          "SLA Violate Reason"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          slaViolateReasonDetailsArray,
          slaViolateReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `SLA violate reason data export successfully`,
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

    //VALIDATIONS
    const v = {
      slaViolateReasonId: "numeric",
      // roleId: "required|string",
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

    //ROLE VALIDATION
    if (!payload.roleId) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Role not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Role not found",
        });
      }
    }

    //ROLE VALIDATION FOR IMPORT
    if (importData) {
      for (const roleNameAndId of payload.roleNameAndIds) {
        if (roleNameAndId.name && !roleNameAndId.id) {
          await transaction.rollback();
          return {
            success: false,
            error: `Role ${roleNameAndId.name} not found`,
            data: payload,
          };
        }
      }
    }

    const { slaViolateReasonId, name, ...inputData } = payload;
    const slaViolateReasonName = name.trim();

    if (slaViolateReasonId) {
      const slaViolateReason = await SlaViolateReason.findOne({
        attributes: ["id"],
        where: {
          id: slaViolateReasonId,
        },
        paranoid: false,
      });
      if (!slaViolateReason) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "SLA violate reason not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "SLA violate reason not found",
          });
        }
      }

      const slaViolateReasonAlreadyExists = await SlaViolateReason.findOne({
        where: {
          name: slaViolateReasonName,
          id: {
            [Op.ne]: slaViolateReasonId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (slaViolateReasonAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "SLA violate reason name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "SLA violate reason name is already taken",
          });
        }
      }
    } else {
      const slaViolateReasonAlreadyExists = await SlaViolateReason.findOne({
        where: {
          name: slaViolateReasonName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (slaViolateReasonAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "SLA violate reason name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "SLA violate reason name is already taken",
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
      name: slaViolateReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (slaViolateReasonId) {
      await SlaViolateReason.update(data, {
        where: {
          id: slaViolateReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "SLA violate reason updated successfully";
    } else {
      await SlaViolateReason.create(data, {
        transaction: transaction,
      });
      message = "SLA violate reason created successfully";
    }

    await transaction.commit();

    if (importData) {
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
    if (importData) {
      return {
        success: false,
        error: error.message,
        data: importData,
      };
    } else {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
export default new SlaViolateReasonController();
