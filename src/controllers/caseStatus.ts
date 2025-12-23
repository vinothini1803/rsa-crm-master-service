import { Op, Sequelize } from "sequelize";
import { CaseStatus } from "../database/models/index";
import sequelize from "../database/connection";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import moment, { MomentInput } from "moment-timezone";

import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import caseStatus from "../routes/caseStatus";

class CaseStatusController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, apiType, status } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      let caseStatuses: any;

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        caseStatuses = await CaseStatus.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (caseStatuses.length === 0) {
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
        let limitValue: number = CaseStatusController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = CaseStatusController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        caseStatuses = await CaseStatus.findAndCountAll({
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

        if (caseStatuses.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: caseStatuses,
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
      const { caseStatusId } = req.query;
      let caseStatusData = null;

      if (caseStatusId) {
        const caseStatusExists: any = await CaseStatus.findOne({
          where: {
            id: caseStatusId,
          },
          paranoid: false,
        });

        if (!caseStatusExists) {
          return res.status(200).json({
            success: false,
            error: "Case status not found",
          });
        }

        caseStatusData = {
          id: caseStatusExists.dataValues.id,
          name: caseStatusExists.dataValues.name,
          status: caseStatusExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        caseStatus: caseStatusData,
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

  delete = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = new Validator(payload, {
        caseStatusIds: "required|array",
        "caseStatusIds.*": "required",
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

      const { caseStatusIds } = payload;
      if (caseStatusIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one case status",
        });
      }

      for (const caseStatusId of caseStatusIds) {
        const caseStatusExists = await CaseStatus.findOne({
          where: {
            id: caseStatusId,
          },
          paranoid: false,
        });
        if (!caseStatusExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Case status (${caseStatusId}) not found`,
          });
        }

        await CaseStatus.destroy({
          where: {
            id: caseStatusId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Case status deleted successfully",
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

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = new Validator(payload, {
        status: "required|numeric",
        caseStatusIds: "required|array",
        "caseStatusIds.*": "required",
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

      const { caseStatusIds, status, updatedById, deletedById } = payload;
      if (caseStatusIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one case status",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const caseStatusId of caseStatusIds) {
        const caseStatusExists = await CaseStatus.findOne({
          where: {
            id: caseStatusId,
          },
          paranoid: false,
        });
        if (!caseStatusExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Case status (${caseStatusId}) not found`,
          });
        }

        await CaseStatus.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: caseStatusId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Case status updated successfully",
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
    try {
      return await save(req, res);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public async caseStatusDataExport(req: Request, res: Response) {
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

      const caseStatusData = await CaseStatus.findAll({
        where,
        attributes: ["name", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!caseStatusData || caseStatusData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Case status not found",
        });
      }

      //Get Final Data of Case Status
      const caseStatusFinalData: any = await getCaseStatusFinalData(
        caseStatusData
      );

      // Column Filter
      const renamedUserColumnNames = Object.keys(caseStatusFinalData[0]);

      let buffer;

      if (format === "xlsx" || format === "xls") {
        buffer = generateXLSXAndXLSExport(
          caseStatusFinalData,
          renamedUserColumnNames,
          format,
          "Case Status"
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
        buffer = generateCSVExport(caseStatusFinalData, renamedUserColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `Case status data export successfully`,
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

  //Case Status Import;
  public async caseStatusDataImport(req: Request, res: Response) {
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
          let reArrangedUsers: any = {
            Name: String(data3["Name"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };
          const record: any = {};
          for (const key in reArrangedUsers) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedUsers[key];
          }
          let caseStatusId = null;
          if (record.name) {
            const trimedCaseStatusName = record.name.trim();
            const nameAlreadyExists = await CaseStatus.findOne({
              where: {
                name: trimedCaseStatusName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              caseStatusId = nameAlreadyExists.dataValues.id;
            }
          }
          //REQUESTS FOR CASE STATUS SAVE
          record.caseStatusId = caseStatusId;
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
              ...reArrangedUsers,
              Error: errorContent,
            });
          } else {
            if (output.message === "Case status created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New case status created successfully (${newRecordsCreated} records) and existing case status updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New case status created successfully (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing case status updated (${existingRecordsUpdated} records)`
          : "No case status updated or created";

      //If No Record Have Error Send Respond
      if (errorData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Case Status
      const caseStatusFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(caseStatusFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        caseStatusFinalData,
        renamedUserColumnNames,
        "xlsx",
        "Case Status"
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

  public async getcaseStatusName(req: any, res: any) {
    try {
      const { caseStatusId }: any = req.query;
      const caseStatusName: any = await CaseStatus.findOne({
        where: {
          id: caseStatusId,
        },
        attributes: ["name"],
      });
      if (caseStatusName?.dataValues?.name != "") {
        return res.status(200).json({
          success: true,
          caseStatusName: caseStatusName.dataValues.name,
        }); //caseStatusName.dataValues.name;
      } else {
        return res.status(200).json({ success: true, caseStatusName: "" });
      }
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
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
    const v = new Validator(payload, {
      caseStatusId: "numeric",
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

    const { caseStatusId, name, ...inputData } = payload;
    const caseStatusName = name.trim();

    //CUSTOM VALIDATIONS
    if (caseStatusId) {
      const caseStatus = await CaseStatus.findOne({
        attributes: ["id"],
        where: {
          id: caseStatusId,
        },
        paranoid: false,
      });
      if (!caseStatus) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Case status not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Case status not found",
          });
        }
      }

      const caseStatusAlreadyExists = await CaseStatus.findOne({
        where: {
          name: caseStatusName,
          id: {
            [Op.ne]: caseStatusId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (caseStatusAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Case status is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Case status is already taken",
          });
        }
      }
    } else {
      const caseStatusAlreadyExists = await CaseStatus.findOne({
        where: {
          name: caseStatusName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (caseStatusAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Case status is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Case status is already taken",
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
      name: caseStatusName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (caseStatusId) {
      await CaseStatus.update(data, {
        where: {
          id: caseStatusId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Case status updated successfully";
    } else {
      await CaseStatus.create(data, {
        transaction: transaction,
      });
      message = "Case status created successfully";
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

//Case Status Export Sub Functions;
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
async function getCaseStatusFinalData(caseStatusData: any) {
  const transformedData = await Promise.all(
    caseStatusData.map(async (caseStatusData: any) => {
      return {
        Name: caseStatusData.dataValues.name,
        "Created At": moment
          .tz(caseStatusData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: caseStatusData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );

  return transformedData;
}

export default new CaseStatusController();
