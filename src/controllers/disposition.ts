import { Op, Sequelize } from "sequelize";
import { Disposition, Config } from "../database/models/index";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

class DispositionController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;

  constructor() {}

  public async getList(req: any, res: any) {
    try {
      let { limit, offset, typeId, apiType, search, status } = req.query;
      let dispositionFindQuery: any = {
        where: {},
      };
      let result: any;

      if (search) {
        dispositionFindQuery.where.name = {
          [Op.like]: `%${search}%`,
        };
      }

      // handle filter
      if (typeId) {
        dispositionFindQuery.where.typeId = typeId;
      }

      if (apiType && apiType == "dropdown") {
        dispositionFindQuery.attributes = ["id", "name"];
        dispositionFindQuery.order = [["id", "asc"]];
        result = await Disposition.findAll(dispositionFindQuery);
        if (result.length === 0) {
          return res
            .status(200)
            .json({ success: false, error: "No data found" });
        }
      } else {
        if (status) {
          //ACTIVE
          if (status.toLowerCase() == "active") {
            dispositionFindQuery.where.deletedAt = {
              [Op.is]: null,
            };
          } else if (status.toLowerCase() == "inactive") {
            //INACTIVE
            dispositionFindQuery.where.deletedAt = {
              [Op.not]: null,
            };
          }
        }

        if (!limit) {
          limit = DispositionController.defaultLimit;
        }

        if (!offset) {
          offset = DispositionController.defaultOffset;
        }

        dispositionFindQuery.limit = parseInt(limit);
        dispositionFindQuery.offset = parseInt(offset);
        dispositionFindQuery.include = [
          {
            model: Config,
            as: "type",
            attributes: ["id", "name"],
          },
        ];
        dispositionFindQuery.paranoid = false;

        dispositionFindQuery.attributes = [
          "id",
          "name",
          "typeId",
          "createdById",
          "updatedById",
          "deletedById",
          "createdAt",
          "updatedAt",
          "deletedAt",
          [Sequelize.col("type.name"), "typeName"],
          [
            Sequelize.literal(
              "( SELECT DATE_FORMAT(disposition.createdAt,'%d/%m/%Y %h:%i %p') )"
            ),
            "formattedCreatedAt",
          ],
          [
            Sequelize.literal(
              "( SELECT IF (disposition.deletedAt IS NULL, 'Active', 'Inactive') )"
            ),
            "status",
          ],
        ];
        dispositionFindQuery.order = [["id", "desc"]];

        result = await Disposition.findAndCountAll(dispositionFindQuery);
        if (result.count === 0) {
          return res
            .status(200)
            .json({ success: false, error: "No data found" });
        }
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
        dispositionIds: "required|array",
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
      const { dispositionIds, status, updatedById, deletedById } = payload;

      if (dispositionIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one disposition to update status",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const dispositionId of dispositionIds) {
        const dispositionExists = await Disposition.findOne({
          where: {
            id: dispositionId,
          },
          paranoid: false,
        });
        if (!dispositionExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Disposition Id - (${dispositionId}) not found`,
          });
        }
        await Disposition.update(
          { updatedById, deletedById, deletedAt },
          {
            where: { id: dispositionId },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Disposition status updated successfully",
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
  //       typeId: "required|numeric",
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

  //     let data: any = {
  //       name: payload.name,
  //       typeId: payload.typeId,
  //       createdById: payload.createdById,
  //     };

  //     if (payload.dispositionId) {
  //       const dispositionExists: any = await Disposition.findOne({
  //         where: { id: payload.dispositionId },
  //         paranoid: false,
  //       });
  //       if (!dispositionExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `Disposition Id - (${payload.dispositionId}) not found`,
  //         });
  //       }

  //       // validate check
  //       const validateDisposition: any = await Disposition.findOne({
  //         where: {
  //           id: {
  //             [Op.ne]: payload.dispositionId, // Exclude the current record being updated
  //           },
  //           name: payload.name,
  //           typeId: payload.typeId,
  //         },
  //         paranoid: false,
  //       });
  //       if (validateDisposition) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `The name ${payload.name} already exists for the type id ${payload.typeId}`,
  //         });
  //       }

  //       await Disposition.update(data, {
  //         where: { id: payload.dispositionId },
  //         transaction: transaction,
  //       });
  //     } else {
  //       const dispositionExists: any = await Disposition.findOne({
  //         where: { name: payload.name, typeId: payload.typeId },
  //         paranoid: false,
  //       });
  //       if (dispositionExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `Disposition already exists in this name of the type ${payload.typeId}`,
  //         });
  //       }
  //       await Disposition.create(data, { transaction: transaction });
  //     }
  //     await transaction.commit();
  //     return res
  //       .status(200)
  //       .json({ success: true, message: "Disposition saved successfully" });
  //   } catch (error: any) {
  //     await transaction.rollback();
  //     return res.status(500).json({ success: false, error: error.message });
  //   }
  // };

  saveAndUpdate = async (req: any, res: any) => {
    return save(req, res);
  };

  public getFormData = async (req: any, res: any) => {
    try {
      const { dispositionId } = req.query;
      let payload = req.query;
      const v = {
        dispositionId: "numeric",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let disposition: any = {};

      if (dispositionId) {
        const dispositionExists: any = await Disposition.findOne({
          where: { id: dispositionId },
          paranoid: false,
        });

        if (!dispositionExists) {
          return res.status(200).json({
            success: false,
            error: "Disposition not found",
          });
        }

        disposition = {
          id: dispositionExists.dataValues.id,
          name: dispositionExists.dataValues.name,
          typeId: dispositionExists.dataValues.typeId,
          status: dispositionExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const types = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 36, //CASE SUBJECT TYPES
        },
        order: [["id", "asc"]],
      });

      return res.status(200).json({
        success: true,
        data: {
          disposition: disposition,
          extras: {
            types,
          },
        },
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
      const validateData = { dispositionIds: "required|array" };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { dispositionIds } = payload;

      if (dispositionIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one disposition to delete",
        });
      }

      for (const dispositionId of dispositionIds) {
        const dispositionExists = await Disposition.findOne({
          where: {
            id: dispositionId,
          },
          paranoid: false,
        });
        if (!dispositionExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Disposition Id - (${dispositionId}) not found`,
          });
        }

        await Disposition.destroy({
          where: {
            id: dispositionId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Disposition deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public async import(req: any, res: any) {
    try {
      const inData: any[] = req.body.jsonDataArray;
      const errorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      // let importColumns = ["Name", "Type Name", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1122);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1122,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const dispositionSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const dispositionSheet of dispositionSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!dispositionSheet.hasOwnProperty(importColumn)) {
            dispositionSheet[importColumn] = "";
          }
        });

        let reArrangedDispositions: any = {
          Name: dispositionSheet["Name"]
            ? String(dispositionSheet["Name"])
            : null,
          "Type Name": dispositionSheet["Type Name"]
            ? String(dispositionSheet["Type Name"])
            : null,
          Status: dispositionSheet["Status"]
            ? String(dispositionSheet["Status"])
            : null,
        };

        if (dispositionSheet["Name"]) {
          const record: any = {};
          const keyMapping: any = {
            typeName: "typeId",
          };

          for (const key in reArrangedDispositions) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedDispositions[key];
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
              ...reArrangedDispositions,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //TYPE
          let typeId = 0;
          if (record.typeId) {
            const trimmedTypeName = record.typeId.trim().replace(/[–—]/g, "-");

            const type = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedTypeName,
                typeId: 36, //Case Subject Types
              },
              paranoid: false,
            });

            if (type) {
              typeId = type.dataValues.id;
            }
          }

          //DISPOSITION
          let dispositionId = null;
          if (record.name && typeId) {
            const trimmedName = record.name.trim();
            const dispositionAlreadyExists = await Disposition.findOne({
              where: {
                name: trimmedName,
                typeId: typeId,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (dispositionAlreadyExists) {
              dispositionId = dispositionAlreadyExists.dataValues.id;
            }
          }

          record.dispositionId = dispositionId;
          record.typeId = typeId;
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
              ...reArrangedDispositions,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "Disposition created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          errorData.push({
            ...reArrangedDispositions,
            Error: "Disposition name is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New disposition created successfully (${newRecordsCreated} records) and existing disposition updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New disposition created successfully (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing disposition updated (${existingRecordsUpdated} records)`
          : "No disposition created or updated";

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
        "DispositionDetails"
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

      const dispositions = await Disposition.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!dispositions || dispositions.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let dispositionDetailsArray: any[] = [];
      for (const disposition of dispositions) {
        const type = await Config.findOne({
          attributes: ["id", "name"],
          where: { id: disposition.dataValues.typeId },
          paranoid: false,
        });

        dispositionDetailsArray.push({
          Name: disposition.dataValues.name,
          Type: type?.dataValues.name || null,
          "Created At": moment
            .tz(disposition.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: disposition.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const dispositionColumnNames = dispositionDetailsArray
        ? Object.keys(dispositionDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          dispositionDetailsArray,
          dispositionColumnNames,
          format,
          "Disposition Details"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          dispositionDetailsArray,
          dispositionColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Disposition data export successfully`,
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

export const getDispositionById = async (id: any) => {
  try {
    return await Disposition.findOne({
      attributes: ["id", "name"],
      where: { id: id },
    });
  } catch (error: any) {
    throw error;
  }
};

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
      typeId: "required|numeric",
      name: "required|string|maxLength:255",
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

    const typeExists = await Config.findOne({
      attributes: ["id"],
      where: { id: payload.typeId, typeId: 36 },
    });
    if (!typeExists) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          error: `Type not found`,
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: `Type not found`,
        });
      }
    }

    let data: any = {
      name: payload.name,
      typeId: payload.typeId,
      // createdById: payload.createdById,
      deletedAt: null,
      deletedById: null,
    };

    //INACTIVE
    if (payload.status == 0) {
      data.deletedAt = new Date();
      data.deletedById = payload.authUserId;
    }

    let message = null;
    if (payload.dispositionId) {
      const dispositionExists: any = await Disposition.findOne({
        where: { id: payload.dispositionId },
        paranoid: false,
      });
      if (!dispositionExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `Disposition Id - (${payload.dispositionId}) not found`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `Disposition Id - (${payload.dispositionId}) not found`,
          });
        }
      }

      // validate check
      const validateDisposition: any = await Disposition.findOne({
        where: {
          id: {
            [Op.ne]: payload.dispositionId, // Exclude the current record being updated
          },
          name: payload.name,
          typeId: payload.typeId,
        },
        paranoid: false,
      });
      if (validateDisposition) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `The name ${payload.name} already exists for the type id ${payload.typeId}`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `The name ${payload.name} already exists for the type id ${payload.typeId}`,
          });
        }
      }

      data.updatedById = payload.authUserId;
      await Disposition.update(data, {
        where: { id: payload.dispositionId },
        paranoid: false,
        transaction: transaction,
      });

      message = "Disposition updated successfully";
    } else {
      const dispositionExists: any = await Disposition.findOne({
        where: { name: payload.name, typeId: payload.typeId },
        paranoid: false,
      });
      if (dispositionExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `Disposition already exists in this name of the type ${payload.typeId}`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `Disposition already exists in this name of the type ${payload.typeId}`,
          });
        }
      }

      data.createdById = payload.authUserId;
      await Disposition.create(data, { transaction: transaction });
      message = "Disposition created successfully";
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

export default new DispositionController();
