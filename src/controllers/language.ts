import { Op, Sequelize } from "sequelize";
import { Language } from "../database/models/index";
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

class LanguageController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      let languages = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        languages = await Language.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });

        if (languages.length === 0) {
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

        // Limitation value setup
        let limitValue: number = LanguageController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = LanguageController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }
        languages = await Language.findAndCountAll({
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

        if (languages.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: languages,
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
      const { languageId } = req.query;
      let languageData = null;

      if (languageId) {
        const languageExists: any = await Language.findOne({
          where: {
            id: languageId,
          },
          paranoid: false,
        });

        if (!languageExists) {
          return res.status(200).json({
            success: false,
            error: "Language not found",
          });
        }

        languageData = {
          id: languageExists.dataValues.id,
          name: languageExists.dataValues.name,
          status: languageExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const data = {
        language: languageData,
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

  // save = async (req: Request, res: Response) => {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     const payload = req.body;
  //     //VALIDATIONS
  //     const v = new Validator(payload, {
  //       languageId: "numeric",
  //       name: "required|string|minLength:3|maxLength:255",
  //       status: "required|numeric",
  //     });

  //     const matched = await v.check();
  //     if (!matched) {
  //       const errors: any = [];
  //       Object.keys(payload).forEach((key) => {
  //         if (v.errors[key]) {
  //           errors.push(v.errors[key].message);
  //         }
  //       });
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         errors: errors,
  //       });
  //     }

  //     const { languageId, name, ...inputData } = payload;
  //     const languageName = name.trim();

  //     if (languageId) {
  //       const language = await Language.findOne({
  //         where: {
  //           id: languageId,
  //         },
  //         paranoid: false,
  //       });
  //       if (!language) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "Language not found",
  //         });
  //       }

  //       const languageAlreadyExists = await Language.findOne({
  //         where: {
  //           name: languageName,
  //           id: {
  //             [Op.ne]: languageId,
  //           },
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (languageAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "Language name is already taken",
  //         });
  //       }
  //     } else {
  //       const languageAlreadyExists = await Language.findOne({
  //         where: {
  //           name: languageName,
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (languageAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "Language name is already taken",
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
  //       name: languageName,
  //       deletedById: deletedById,
  //       deletedAt: deletedAt,
  //     };

  //     let message = null;
  //     if (languageId) {
  //       await Language.update(data, {
  //         where: {
  //           id: languageId,
  //         },
  //         paranoid: false,
  //         transaction: transaction,
  //       });
  //       message = "Language updated successfully";
  //     } else {
  //       await Language.create(data, {
  //         transaction: transaction,
  //       });
  //       message = "Language created successfully";
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
  //       error: error.message,
  //     });
  //   }
  // };

  delete = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        languageIds: "required|array",
        "languageIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { languageIds } = payload;
      if (languageIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one language",
        });
      }

      for (const languageId of languageIds) {
        const languageExists = await Language.findOne({
          where: {
            id: languageId,
          },
          paranoid: false,
        });
        if (!languageExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Language (${languageId}) not found`,
          });
        }

        await Language.destroy({
          where: {
            id: languageId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Language deleted successfully",
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
        languageIds: "required|array",
        "languageIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();

        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { languageIds, status, updatedById, deletedById } = payload;
      if (languageIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one language",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const languageId of languageIds) {
        const languageExists = await Language.findOne({
          where: {
            id: languageId,
          },
          paranoid: false,
        });
        if (!languageExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Language (${languageId}) not found`,
          });
        }

        await Language.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: languageId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Language status updated successfully",
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

  //Language Export
  public async languageDataExport(req: Request, res: Response) {
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

      const languageData = await Language.findAll({
        where,
        attributes: ["name", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!languageData || languageData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Vehicle make
      const languageFinalData: any = await getLanguageFinalData(languageData);

      // Column Filter
      const renamedLanguageColumnNames = Object.keys(languageFinalData[0]);

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          languageFinalData,
          renamedLanguageColumnNames,
          format,
          "Languages"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          languageFinalData,
          renamedLanguageColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `Language data export successfully`,
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

  //Language Import;
  public async languageDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Status"];

      const importColumnsResponse = await Utils.getExcelImportColumns(1110);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1110,
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

          let reArrangedLanguages: any = {
            Name: String(data3["Name"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          for (const key in reArrangedLanguages) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            record[transformedKey] = reArrangedLanguages[key];
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
              ...reArrangedLanguages,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let languageId = null;
          if (record.name) {
            const trimedlanguageName = record.name.trim();
            const nameAlreadyExists = await Language.findOne({
              where: {
                name: trimedlanguageName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              languageId = nameAlreadyExists.dataValues.id;
            }
          }

          //REQUESTS FOR LANGUAGE SAVE
          record.languageId = languageId;
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
              ...reArrangedLanguages,
              Error: errorContent,
            });
          } else {
            if (output.message === "Language created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New language created successfully (${newRecordsCreated} records) and existing language updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New language created successfully (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing language updated (${existingRecordsUpdated} records)`
          : "No language updated or created";

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
        "Language"
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
}

//Data Column and Data key, value rearrange (Final Data)
async function getLanguageFinalData(languageData: any) {
  const transformedData = await Promise.all(
    languageData.map(async (languageData: any) => {
      return {
        Name: languageData.dataValues.name,
        "Created At": moment
          .tz(languageData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: languageData.dataValues.deletedAt ? "Inactive" : "Active",
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
      languageId: "numeric",
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

    const { languageId, name, ...inputData } = payload;
    const languageName = name.trim();

    if (languageId) {
      const language = await Language.findOne({
        where: {
          id: languageId,
        },
        paranoid: false,
      });
      if (!language) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Language not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Language not found",
          });
        }
      }

      const languageAlreadyExists = await Language.findOne({
        where: {
          name: languageName,
          id: {
            [Op.ne]: languageId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (languageAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Language name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Language name is already taken",
          });
        }
      }
    } else {
      const languageAlreadyExists = await Language.findOne({
        where: {
          name: languageName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (languageAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Language name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Language name is already taken",
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
      name: languageName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (languageId) {
      await Language.update(data, {
        where: {
          id: languageId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Language updated successfully";
    } else {
      await Language.create(data, {
        transaction: transaction,
      });
      message = "Language created successfully";
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

export default new LanguageController();
