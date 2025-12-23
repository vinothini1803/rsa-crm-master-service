import { Op, Sequelize } from "sequelize";
import { ProposedDelayReason } from "../database/models/index";
import sequelize from "../database/connection";
import { Request, Response } from "express";
import Utils from "../lib/utils";
import moment from "moment-timezone";

import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class ProposedDelayReasonController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() { }

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, apiType, search, status } = req.query;
      const where: any = {};

      let proposedDelayReasons: any = null;
      if (apiType === "dropdown") {
        if (search) {
          where.name = { [Op.like]: `%${search}%` };
        }

        proposedDelayReasons = await ProposedDelayReason.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (proposedDelayReasons.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
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

        let limitValue: number = ProposedDelayReasonController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        let offsetValue: number = ProposedDelayReasonController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        const proposedDelayReasonDetails = await ProposedDelayReason.findAndCountAll({
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

        if (proposedDelayReasonDetails.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }

        return res.status(200).json({
          success: true,
          message: "Data fetched successfully",
          data: proposedDelayReasonDetails,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: proposedDelayReasons,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getFormData = async (req: Request, res: Response) => {
    try {
      const { proposedDelayReasonId } = req.query;
      let proposedDelayReasonData = null;

      if (proposedDelayReasonId) {
        const proposedDelayReasonExists: any =
          await ProposedDelayReason.findOne({
            where: {
              id: proposedDelayReasonId,
            },
            paranoid: false,
          });

        if (!proposedDelayReasonExists) {
          return res.status(200).json({
            success: false,
            error: "Proposed delay reason not found",
          });
        }

        proposedDelayReasonData = {
          id: proposedDelayReasonExists.dataValues.id,
          name: proposedDelayReasonExists.dataValues.name,
          status: proposedDelayReasonExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        proposedDelayReason: proposedDelayReasonData,
      };
      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  delete = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        proposedDelayReasonIds: "required|array",
        "proposedDelayReasonIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { proposedDelayReasonIds } = payload;
      if (proposedDelayReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one proposed delay reason",
        });
      }

      for (const proposedDelayReasonId of proposedDelayReasonIds) {
        const proposedDelayReasonExists =
          await ProposedDelayReason.findOne({
            where: {
              id: proposedDelayReasonId,
            },
            paranoid: false,
          });
        if (!proposedDelayReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Proposed delay reason (${proposedDelayReasonId}) not found`,
          });
        }

        await ProposedDelayReason.destroy({
          where: {
            id: proposedDelayReasonId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Proposed delay reason deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        status: "required|numeric",
        proposedDelayReasonIds: "required|array",
        "proposedDelayReasonIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { proposedDelayReasonIds, status, updatedById, deletedById } =
        payload;
      if (proposedDelayReasonIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one proposed delay reason",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const proposedDelayReasonId of proposedDelayReasonIds) {
        const proposedDelayReasonExists =
          await ProposedDelayReason.findOne({
            where: {
              id: proposedDelayReasonId,
            },
            paranoid: false,
          });
        if (!proposedDelayReasonExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Proposed delay reason (${proposedDelayReasonId}) not found`,
          });
        }

        await ProposedDelayReason.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: proposedDelayReasonId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Proposed delay reason status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  saveAndUpdate = async (req: any, res: any) => {
    return await save(req, res);
  };

  export = async (req: Request, res: Response) => {
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

      const getProposedDelayReasonData = await ProposedDelayReason.findAll({
        where,
        attributes: ["name", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!getProposedDelayReasonData || getProposedDelayReasonData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      const proposedDelayReasonFinalData: any = await getProposedDelayReasonFinalData(
        getProposedDelayReasonData
      );

      // Column Filter
      const renamedProposedDelayReasonColumnNames = Object.keys(
        proposedDelayReasonFinalData[0]
      );

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          proposedDelayReasonFinalData,
          renamedProposedDelayReasonColumnNames,
          format,
          "ProposedDelayReasons"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          proposedDelayReasonFinalData,
          renamedProposedDelayReasonColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `Proposed delay reason data export successfully`,
        data: buffer,
        format: format,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  import = async (req: Request, res: Response) => {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      const importColumnsResponse = await Utils.getExcelImportColumns(1127);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1127,
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
          let reArrangedProposedDelayReasons: any = {
            Name: String(data3["Name"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedProposedDelayReasons) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedProposedDelayReasons[key];
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
              ...reArrangedProposedDelayReasons,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let proposedDelayReasonId = null;
          if (record.name) {
            const trimmedProposedDelayReasonName = record.name.trim();
            const nameAlreadyExists = await ProposedDelayReason.findOne({
              where: {
                name: trimmedProposedDelayReasonName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              proposedDelayReasonId = nameAlreadyExists.dataValues.id;
            }
          }

          record.proposedDelayReasonId = proposedDelayReasonId;
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
              ...reArrangedProposedDelayReasons,
              Error: errorContent,
            });
          } else {
            if (
              output.message ===
              "Proposed delay reason created successfully"
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
          ? `New proposed delay reason created (${newRecordsCreated} records) and existing proposed delay reason updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New proposed delay reason created (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing proposed delay reason updated (${existingRecordsUpdated} records)`
              : "No proposed delay reason updated or created";

      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      const proposedDelayReasonFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(proposedDelayReasonFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        proposedDelayReasonFinalData,
        renamedUserColumnNames,
        "xlsx",
        "Proposed Delay Reason"
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
      proposedDelayReasonId: "numeric",
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

    const { proposedDelayReasonId, name, ...inputData } = payload;
    const proposedDelayReasonName = name.trim();

    //CUSTOM VALIDATIONS
    if (proposedDelayReasonId) {
      const proposedDelayReason = await ProposedDelayReason.findOne({
        attributes: ["id"],
        where: {
          id: proposedDelayReasonId,
        },
        paranoid: false,
      });
      if (!proposedDelayReason) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Proposed delay reason not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Proposed delay reason not found",
          });
        }
      }

      const proposedDelayReasonAlreadyExists =
        await ProposedDelayReason.findOne({
          where: {
            name: proposedDelayReasonName,
            id: {
              [Op.ne]: proposedDelayReasonId,
            },
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (proposedDelayReasonAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Proposed delay reason is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Proposed delay reason is already taken",
          });
        }
      }
    } else {
      const proposedDelayReasonAlreadyExists =
        await ProposedDelayReason.findOne({
          where: {
            name: proposedDelayReasonName,
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (proposedDelayReasonAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Proposed delay reason is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Proposed delay reason is already taken",
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
      name: proposedDelayReasonName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (proposedDelayReasonId) {
      await ProposedDelayReason.update(data, {
        where: {
          id: proposedDelayReasonId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Proposed delay reason updated successfully";
    } else {
      await ProposedDelayReason.create(data, {
        transaction: transaction,
      });
      message = "Proposed delay reason created successfully";
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
async function getProposedDelayReasonFinalData(proposedDelayReasonData: any) {
  const transformedData = await Promise.all(
    proposedDelayReasonData.map(async (proposedDelayReasonData: any) => {
      return {
        Name: proposedDelayReasonData.dataValues.name,
        "Created At": moment
          .tz(proposedDelayReasonData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: proposedDelayReasonData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );

  return transformedData;
}

export default new ProposedDelayReasonController();
