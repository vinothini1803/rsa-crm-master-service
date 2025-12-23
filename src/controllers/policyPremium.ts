import { Op, Sequelize } from "sequelize";
import { PolicyPremium } from "../database/models/index";
import sequelize from "../database/connection";
import Utils from "../lib/utils";

import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class PolicyPremiumController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;

  constructor() {}

  public async getList(req: any, res: any) {
    try {
      let { limit, offset, apiType, search, status } = req.query;
      let query: any = {
        where: {
          // deletedAt: {
          //   [Op.is]: null,
          // },
        },
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
        result = await PolicyPremium.findAll(query);
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
          limit = PolicyPremiumController.defaultLimit;
        }

        if (!offset) {
          offset = PolicyPremiumController.defaultOffset;
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
              "( SELECT DATE_FORMAT(policyPremium.createdAt,'%d/%m/%Y %h:%i %p') )"
            ),
            "formattedCreatedAt",
          ],
          [
            Sequelize.literal(
              "( SELECT IF (policyPremium.deletedAt IS NULL, 'Active', 'Inactive') )"
            ),
            "status",
          ],
        ];

        result = await PolicyPremium.findAndCountAll(query);
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
        policyPremiumIds: "required|array",
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
      const { policyPremiumIds, status, updatedById, deletedById } = payload;

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const policyPremiumId of policyPremiumIds) {
        const policyPremiumExists = await PolicyPremium.findOne({
          where: {
            id: policyPremiumId,
          },
          paranoid: false,
        });
        if (!policyPremiumExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Policy Premium  Id - (${policyPremiumId}) not found`,
          });
        }
        await PolicyPremium.update(
          { updatedById, deletedById, deletedAt },
          {
            where: { id: policyPremiumId },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Policy Premium status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  // public save = async (req: any, res: any) => {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     let payload = req.body;
  //     const v = {
  //       name: "required|string",
  //     };

  //     const errors = await Utils.validateParams(payload, v);

  //     if (errors) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         errors: errors,
  //       });
  //     }

  //     let data: any = { name: payload.name, createdById: payload.createdById };

  //     if (payload.policyPremiumId) {
  //       const policyPremiumExists: any = await PolicyPremium.findOne({
  //         where: { id: payload.policyPremiumId },
  //         paranoid: false,
  //       });
  //       if (!policyPremiumExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `Policy Premium  Id - (${payload.policyPremiumId}) not found`,
  //         });
  //       }

  //       // validate check
  //       const validatepolicyPremium: any = await PolicyPremium.findOne({
  //         where: {
  //           id: {
  //             [Op.ne]: payload.policyPremiumId, // Exclude the current record being updated
  //           },
  //           name: payload.name,
  //         },
  //         paranoid: false,
  //       });
  //       if (validatepolicyPremium) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `The name ${payload.name} already exists`,
  //         });
  //       }

  //       await PolicyPremium.update(data, {
  //         where: { id: payload.policyPremiumId },
  //         transaction: transaction,
  //       });
  //     } else {
  //       const policyPremiumExists: any = await PolicyPremium.findOne({
  //         where: { name: payload.name },
  //         paranoid: false,
  //       });
  //       if (policyPremiumExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `Policy Premium already exists in this name`,
  //         });
  //       }
  //       await PolicyPremium.create(data, { transaction: transaction });
  //     }
  //     await transaction.commit();
  //     return res
  //       .status(200)
  //       .json({ success: true, message: "Policy Premium  saved successfully" });
  //   } catch (error: any) {
  //     await transaction.rollback();
  //     return res.status(500).json({ success: false, error: error.message });
  //   }
  // };

  public getFormData = async (req: any, res: any) => {
    try {
      const { policyPremiumId } = req.query;
      let payload = req.query;
      const v = {
        policyPremiumId: "required|numeric",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let policyPremium: any = {};

      if (policyPremiumId) {
        const policyPremiumExists: any = await PolicyPremium.findOne({
          where: { id: policyPremiumId },
          paranoid: false,
        });

        if (!policyPremiumExists) {
          return res.status(200).json({
            success: false,
            error: "Policy Premium not found",
          });
        }

        policyPremium = {
          id: policyPremiumExists.dataValues.id,
          name: policyPremiumExists.dataValues.name,
          status: policyPremiumExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      return res.status(200).json({
        success: true,
        data: { policyPremium: policyPremium },
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
      const validateData = { policyPremiumIds: "required|array" };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { policyPremiumIds } = payload;

      for (const policyPremiumId of policyPremiumIds) {
        const policyPremiumExists = await PolicyPremium.findOne({
          where: {
            id: policyPremiumId,
          },
          paranoid: false,
        });
        if (!policyPremiumExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Policy Premium Id - (${policyPremiumId}) not found`,
          });
        }

        await PolicyPremium.destroy({
          where: {
            id: policyPremiumId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Policy Premium deleted successfully",
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

      // let importColumns = ["Name", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1121);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1121,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const policyPremiumSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const policyPremiumSheet of policyPremiumSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!policyPremiumSheet.hasOwnProperty(importColumn)) {
            policyPremiumSheet[importColumn] = "";
          }
        });

        let reArrangedPolicyPremiums: any = {
          Name: policyPremiumSheet["Name"]
            ? String(policyPremiumSheet["Name"])
            : null,
          Status: policyPremiumSheet["Status"]
            ? String(policyPremiumSheet["Status"])
            : null,
        };

        if (policyPremiumSheet["Name"]) {
          const record: any = {};
          for (const key in reArrangedPolicyPremiums) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available

            record[transformedKey] = reArrangedPolicyPremiums[key];
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
              ...reArrangedPolicyPremiums,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //POLICY PREMIUM
          let policyPremiumId = null;
          if (record.name) {
            const trimmedName = record.name.trim();
            const policyPremiumAlreadyExists = await PolicyPremium.findOne({
              where: {
                name: trimmedName,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (policyPremiumAlreadyExists) {
              policyPremiumId = policyPremiumAlreadyExists.dataValues.id;
            }
          }

          record.policyPremiumId = policyPremiumId;
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
              ...reArrangedPolicyPremiums,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "Policy premium created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedPolicyPremiums,
            Error: "Policy premium name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New policy premium created (${newRecordsCreated} records) and existing policy premium updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New policy premium created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing policy premium updated (${existingRecordsUpdated} records)`
          : "No policy premium created or updated";

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
        "PolicyPremium"
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

      const policyPremiums = await PolicyPremium.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!policyPremiums || policyPremiums.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let policyPremiumDetailsArray: any[] = [];
      for (const policyPremium of policyPremiums) {
        policyPremiumDetailsArray.push({
          Name: policyPremium.dataValues.name,
          "Created At": moment
            .tz(policyPremium.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: policyPremium.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const policyPremiumColumnNames = policyPremiumDetailsArray
        ? Object.keys(policyPremiumDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          policyPremiumDetailsArray,
          policyPremiumColumnNames,
          format,
          "Policy Premium"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          policyPremiumDetailsArray,
          policyPremiumColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Policy premium data export successfully`,
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
      // createdById: payload.createdById,
      deletedAt: null,
      deletedById: null,
    };

    if (payload.status == 0) {
      data.deletedAt = new Date();
      data.deletedById = payload.authUserId;
    }

    let message = null;
    if (payload.policyPremiumId) {
      const policyPremiumExists: any = await PolicyPremium.findOne({
        where: { id: payload.policyPremiumId },
        paranoid: false,
      });
      if (!policyPremiumExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `Policy Premium  Id - (${payload.policyPremiumId}) not found`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `Policy Premium  Id - (${payload.policyPremiumId}) not found`,
          });
        }
      }

      // validate check
      const validatePolicyPremium: any = await PolicyPremium.findOne({
        where: {
          id: {
            [Op.ne]: payload.policyPremiumId, // Exclude the current record being updated
          },
          name: payload.name,
        },
        paranoid: false,
      });
      if (validatePolicyPremium) {
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
      await PolicyPremium.update(data, {
        where: { id: payload.policyPremiumId },
        transaction: transaction,
        paranoid: false,
      });
      message = "Policy premium updated successfully";
    } else {
      const policyPremiumExists: any = await PolicyPremium.findOne({
        where: { name: payload.name },
        paranoid: false,
      });
      if (policyPremiumExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `Policy Premium already exists in this name`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `Policy Premium already exists in this name`,
          });
        }
      }

      data.createdById = payload.authUserId;
      await PolicyPremium.create(data, { transaction: transaction });
      message = "Policy premium created successfully";
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

export default new PolicyPremiumController();
