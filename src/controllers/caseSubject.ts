import { Op, Sequelize } from "sequelize";
import {
  CaseSubject,
  Client,
  SubjectService,
  Service,
  CaseSubjectQuestionnaire,
  AnswerType,
  Config,
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
import caseStatus from "../database/models/caseStatus";
import { caseSubject } from "../routes/masterRouter";

class CaseSubjectController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() { }

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, clientId, search, status, apiType, caseTypeId } = req.query;

      // if (apiType == "dropdown" && !clientId) {
      //   return res.status(200).json({
      //     success: false,
      //     error: "Client is required",
      //   });
      // }

      let where: any = {};
      if (clientId) {
        where.clientId = clientId;
      }
      if (caseTypeId) {
        where.caseTypeId = caseTypeId;
      }

      let caseSubjects = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }
        caseSubjects = await CaseSubject.findAll({
          where,
          attributes: ["id", "name", "caseTypeId"],
          order: [["id", "asc"]],
        });

        if (caseSubjects.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        if (search) {
          where[Op.or] = [
            Sequelize.literal(
              `IF (caseSubject.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%"`
            ),
            { name: { [Op.like]: `%${search}%` } },
            {
              "$client.name$": { [Op.like]: `%${search}%` },
            },
            {
              "$caseType.name$": { [Op.like]: `%${search}%` },
            },
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
        let limitValue: number = CaseSubjectController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = CaseSubjectController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        caseSubjects = await CaseSubject.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "caseTypeId",
            [Sequelize.col("client.name"), "clientName"],
            [Sequelize.col("caseType.name"), "caseTypeName"],
            [
              Sequelize.literal(
                "(SELECT count(subjectServices.id) FROM subjectServices WHERE subjectServices.subjectId = `caseSubject`.`Id`)"
              ),
              "subjectServiceCount",
            ],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(caseSubject.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (caseSubject.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: Client,
              as: "client",
              attributes: [],
              required: false,
              paranoid: false,
            },
            {
              model: Config,
              as: "caseType",
              attributes: [],
              required: false,
              where: {
                typeId: 38, // Case Creation Types
              },
              paranoid: false,
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (caseSubjects.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: caseSubjects,
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
      const { caseSubjectId } = req.query;
      let caseSubjectData = null;

      if (caseSubjectId) {
        const caseSubjectExists: any = await CaseSubject.findOne({
          where: {
            id: caseSubjectId,
          },
          paranoid: false,
        });

        if (!caseSubjectExists) {
          return res.status(200).json({
            success: false,
            error: "Case subject not found",
          });
        }

        //SUBJECT SERVICES
        const subjectServices: any = await SubjectService.findAll({
          where: {
            subjectId: caseSubjectExists.dataValues.id,
          },
          attributes: ["id", "serviceId"],
          paranoid: false,
        });
        let serviceIds: any = [];
        if (subjectServices && subjectServices.length > 0) {
          serviceIds = subjectServices.map(
            (service: any) => service.dataValues.serviceId
          );
        }

        //QUESTIONNAIRES
        const questionnaires: any = await CaseSubjectQuestionnaire.findAll({
          where: {
            caseSubjectId: caseSubjectExists.dataValues.id,
          },
          attributes: ["id", "question", "answerTypeId", "sequence"],
          include: {
            model: AnswerType,
            as: "answerType",
            attributes: ["id", "name", "fieldType", "options"],
            required: false,
            paranoid: false,
          },
          order: [["sequence", "asc"]],
          paranoid: false,
        });

        caseSubjectData = {
          id: caseSubjectExists.dataValues.id,
          name: caseSubjectExists.dataValues.name,
          clientId: caseSubjectExists.dataValues.clientId,
          caseTypeId: caseSubjectExists.dataValues.caseTypeId,
          serviceIds: serviceIds,
          questionnaires: questionnaires || [],
          status: caseSubjectExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const [clients, services, answerTypes, caseCreationTypes] = await Promise.all([
        Client.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Service.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        AnswerType.findAll({
          attributes: ["id", "name", "fieldType"],
          order: [["id", "asc"]],
          paranoid: false,
        }),
        Config.findAll({
          where: {
            typeId: 38, // Case Creation Types
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      ]);

      const extras = {
        clients: clients,
        services: services,
        answerTypes: answerTypes,
        caseCreationTypes: caseCreationTypes,
      };
      const data = {
        extras: extras,
        caseSubject: caseSubjectData,
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
        caseSubjectIds: "required|array",
        "caseSubjectIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { caseSubjectIds } = payload;

      if (caseSubjectIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one case subject",
        });
      }

      for (const caseSubjectId of caseSubjectIds) {
        const caseSubjectExists = await CaseSubject.findOne({
          where: {
            id: caseSubjectId,
          },
          paranoid: false,
        });
        if (!caseSubjectExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Case subject (${caseSubjectId}) not found`,
          });
        }

        await CaseSubject.destroy({
          where: {
            id: caseSubjectId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Case subject deleted successfully",
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
        caseSubjectIds: "required|array",
        "caseSubjectIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { caseSubjectIds, status, updatedById, deletedById } = payload;
      if (caseSubjectIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one case subject",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const caseSubjectId of caseSubjectIds) {
        const caseSubjectExists = await CaseSubject.findOne({
          where: {
            id: caseSubjectId,
          },
          paranoid: false,
        });
        if (!caseSubjectExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `CaseSubject (${caseSubjectId}) not found`,
          });
        }

        await CaseSubject.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: caseSubjectId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Case subject status updated successfully",
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

  public async caseSubjectDataExport(req: Request, res: Response) {
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

      const caseSubjectData = await CaseSubject.findAll({
        where,
        attributes: ["id", "name", "clientId", "caseTypeId", "createdAt", "deletedAt"],
        paranoid: false,
      });

      if (!caseSubjectData || caseSubjectData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Case subject
      const caseSubjectFinalData: any = await getCaseSubjectFinalData(
        caseSubjectData
      );

      // Column Filter
      const renamedCaseSubjectColumnNames = Object.keys(
        caseSubjectFinalData[0]
      );

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          caseSubjectFinalData,
          renamedCaseSubjectColumnNames,
          format,
          "CaseSubjects"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          caseSubjectFinalData,
          renamedCaseSubjectColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `Case subject data export successfully`,
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

  //Case Subject Import;
  public async caseSubjectDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = ["Name", "Client Name", "Services", "Status"];
      const importColumnsResponse = await Utils.getExcelImportColumns(1105);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1105,
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

          let reArrangedCaseSubjects: any = {
            Name: String(data3["Name"]),
            "Client Name": data3["Client Name"]
              ? String(data3["Client Name"])
              : null,
            "Case Type": data3["Case Type"] ? String(data3["Case Type"]) : null,
            Services: String(data3["Services"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };
          const record: any = {};
          for (const key in reArrangedCaseSubjects) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );
            record[transformedKey] = reArrangedCaseSubjects[key];
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
              ...reArrangedCaseSubjects,
              Error: validationErrors.join(","),
            });
            continue;
          }

          let clientId = 0;
          if (record.clientName) {
            const trimmedCLientName = record.clientName.trim();
            const clientName: any = await Client.findOne({
              attributes: ["id", "name"],
              where: { name: trimmedCLientName },
              paranoid: false,
            });
            if (clientName) {
              clientId = clientName.id;
            }
          }

          let caseSubjectId = null;
          if (record.name && clientId) {
            const trimmedSubjectName = record.name.trim();
            const nameAlreadyExists = await CaseSubject.findOne({
              where: {
                name: trimmedSubjectName,
                clientId: clientId,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nameAlreadyExists) {
              caseSubjectId = nameAlreadyExists.dataValues.id;
            }
          }

          let serviceIds: any = [];
          let serviceNames = null;
          if (record.services) {
            record.services = record.services.trim().split(",").map((s: string) => s.trim());
            const serviceDetails: any = await Service.findAll({
              where: {
                name: {
                  [Op.in]: record.services,
                },
              },
              attributes: ["id", "name"],
              paranoid: false,
            });
            if (serviceDetails && serviceDetails.length > 0) {
              serviceIds = serviceDetails.map(
                (serviceDetail: any) => serviceDetail.dataValues.id
              );
              serviceNames = serviceDetails.map(
                (serviceRecord: any) => serviceRecord.dataValues.name
              );
            }
          }

          // Handle Type field - map by name to caseTypeId
          // Normalize dash characters (en dash, em dash) to regular hyphen and normalize spaces
          let caseTypeId = null;
          if (record.caseType) {
            const trimmedCaseTypeName = String(record.caseType)
              .trim()
              .replace(/[–—]/g, "-") // Replace en dash (U+2013) and em dash (U+2014) with regular hyphen
              .replace(/\s+/g, " "); // Normalize multiple spaces to single space

            // Try exact match first
            let caseType: any = await Config.findOne({
              where: {
                name: trimmedCaseTypeName,
                typeId: 38, // Case Creation Types
              },
              attributes: ["id"],
            });

            // If not found, try case-insensitive search
            if (!caseType) {
              const allCaseTypes: any = await Config.findAll({
                where: {
                  typeId: 38, // Case Creation Types
                },
                attributes: ["id", "name"],
              });
              caseType = allCaseTypes.find((ct: any) =>
                ct.name.trim().replace(/[–—]/g, "-").replace(/\s+/g, " ").toLowerCase() ===
                trimmedCaseTypeName.toLowerCase()
              );
            }

            if (caseType) {
              caseTypeId = caseType.dataValues.id;
            }
          }

          //REQUESTS FOR SUBJECT SAVE`
          record.caseSubjectId = caseSubjectId;
          record.clientId = clientId;
          record.caseTypeId = caseTypeId;
          record.serviceIds = serviceIds;
          record.serviceNames = serviceNames;
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
              ...reArrangedCaseSubjects,
              Error: errorContent,
            });
          } else {
            if (output.message === "Case subject created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New case subject created (${newRecordsCreated} records) and existing case subject updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New case subject created (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing case subject updated (${existingRecordsUpdated} records)`
              : "No case subject updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Case subject
      const caseSubjectFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(caseSubjectFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        caseSubjectFinalData,
        renamedUserColumnNames,
        "xlsx",
        "Case Subject"
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
  public async getcaseSubject(req: any, res: any) {
    try {
      const { caseSubjectId }: any = req.query;
      const caseSubjectName: any = await CaseSubject.findOne({
        where: {
          id: caseSubjectId,
        },
        attributes: ["name"],
      });
      if (caseSubjectName?.dataValues?.name) {
        return res.status(200).json({
          success: true,
          caseSubjectName: caseSubjectName.dataValues.name,
        }); //caseSubjectName.dataValues.name;
      } else {
        return res.status(200).json({ success: true, caseSubjectName: "" });
      }
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  public async getQuestionnairesByCaseSubjectId(req: any, res: any) {
    try {
      const { caseSubjectId }: any = req.query;

      if (!caseSubjectId) {
        return res.status(200).json({
          success: false,
          error: "Case subject ID is required",
        });
      }

      const questionnaires: any = await CaseSubjectQuestionnaire.findAll({
        where: {
          caseSubjectId: caseSubjectId,
        },
        attributes: ["id", "question", "answerTypeId", "sequence"],
        include: {
          model: AnswerType,
          as: "answerType",
          attributes: ["id", "name", "fieldType", "options", "conditionalOptions"],
          required: false,
          paranoid: false,
        },
        order: [["sequence", "asc"]],
        paranoid: false,
      });

      return res.status(200).json({
        success: true,
        message: "Questionnaires fetched successfully",
        data: questionnaires,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //Case Subject Questionnaire Import
  public async caseSubjectQuestionnaireImport(req: Request, res: Response) {
    try {
      const inData: any = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      // Get import columns from seeder
      const importColumnsResponse = await Utils.getExcelImportColumns(1126);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1126,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const sheets = Object.values(inData)[0]
        ? (Object.values(inData)[0] as any)["data"]
        : [];

      for (const sheet of sheets) {
        importColumns.forEach((importColumn: any) => {
          if (!sheet.hasOwnProperty(importColumn)) {
            sheet[importColumn] = "";
          }
        });

        let reArrangedQuestionnaires: any = {
          "Case Subject Name": sheet["Case Subject Name"]
            ? String(sheet["Case Subject Name"])
            : null,
          "Client Name": sheet["Client Name"]
            ? String(sheet["Client Name"])
            : null,
          "Question": sheet["Question"]
            ? String(sheet["Question"])
            : null,
          "Answer Type Name": sheet["Answer Type Name"]
            ? String(sheet["Answer Type Name"])
            : null,
          "Sequence": sheet["Sequence"]
            ? String(sheet["Sequence"])
            : null,
        };

        const record: any = {};
        for (const key in reArrangedQuestionnaires) {
          let transformedKey = key
            .replace(/\s+/g, "")
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
              index === 0 ? word.toLowerCase() : word.toUpperCase()
            );
          record[transformedKey] = reArrangedQuestionnaires[key];
        }

        let errors = [];

        //CLIENT
        let clientId = 0;
        if (record.clientName) {
          const trimmedClientName = record.clientName.trim();
          const clientExists: any = await Client.findOne({
            where: {
              name: trimmedClientName,
            },
            attributes: ["id"],
            paranoid: false,
          });
          if (clientExists) {
            clientId = clientExists.id;
          } else {
            errors.push("Client not found");
          }
        } else {
          errors.push("Client Name is required");
        }

        //CASE SUBJECT
        let caseSubjectId = null;
        if (record.caseSubjectName && clientId) {
          const trimmedCaseSubjectName = record.caseSubjectName.trim();
          const caseSubjectExists: any = await CaseSubject.findOne({
            where: {
              name: trimmedCaseSubjectName,
              clientId: clientId,
            },
            attributes: ["id"],
            paranoid: false,
          });
          if (caseSubjectExists) {
            caseSubjectId = caseSubjectExists.id;
          } else {
            errors.push("Case Subject not found");
          }
        } else {
          if (!record.caseSubjectName) {
            errors.push("Case Subject Name is required");
          }
        }

        //ANSWER TYPE
        let answerTypeId = null;
        if (record.answerTypeName) {
          const trimmedAnswerTypeName = record.answerTypeName.trim();
          const answerTypeExists: any = await AnswerType.findOne({
            where: {
              name: trimmedAnswerTypeName,
            },
            attributes: ["id"],
            paranoid: false,
          });
          if (answerTypeExists) {
            answerTypeId = answerTypeExists.id;
          } else {
            errors.push("Answer Type not found");
          }
        } else {
          errors.push("Answer Type Name is required");
        }

        //QUESTION
        if (!record.question || record.question.trim() === "") {
          errors.push("Question is required");
        }

        //SEQUENCE
        let sequence = 0;
        if (record.sequence) {
          const parsedSequence = parseInt(record.sequence);
          if (!isNaN(parsedSequence) && parsedSequence >= 0) {
            sequence = parsedSequence;
          }
        }

        if (errors.length > 0) {
          errorData.push({
            ...reArrangedQuestionnaires,
            Error: errors.join(", "),
          });
          errorOutData.push({
            ...reArrangedQuestionnaires,
            Error: errors.join(", "),
          });
          continue;
        }

        // Check if questionnaire already exists
        const existingQuestionnaire: any = await CaseSubjectQuestionnaire.findOne({
          where: {
            caseSubjectId: caseSubjectId,
            question: record.question.trim(),
          },
          attributes: ["id"],
          paranoid: false,
        });

        const transaction = await sequelize.transaction();
        try {
          const questionnaireData: any = {
            caseSubjectId: caseSubjectId,
            question: record.question.trim(),
            answerTypeId: answerTypeId,
            sequence: sequence,
            updatedById: req.body.authUserId,
          };

          if (existingQuestionnaire) {
            // Update existing questionnaire
            await CaseSubjectQuestionnaire.update(questionnaireData, {
              where: {
                id: existingQuestionnaire.id,
              },
              paranoid: false,
              transaction: transaction,
            });
            existingRecordsUpdated += 1;
          } else {
            // Create new questionnaire
            questionnaireData.createdById = req.body.authUserId;
            await CaseSubjectQuestionnaire.create(questionnaireData, {
              transaction: transaction,
            });
            newRecordsCreated += 1;
          }

          await transaction.commit();
        } catch (error: any) {
          await transaction.rollback();
          errorData.push({
            ...reArrangedQuestionnaires,
            Error: error.message,
          });
          errorOutData.push({
            ...reArrangedQuestionnaires,
            Error: error.message,
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New case subject questionnaire created (${newRecordsCreated} records) and existing case subject questionnaire updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New case subject questionnaire created (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing case subject questionnaire updated (${existingRecordsUpdated} records)`
              : "No case subject questionnaire created or updated";

      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Error Buffer Generation;
      importColumns.push("Error");

      const buffer = generateXLSXAndXLSExport(
        errorOutData,
        importColumns,
        "xlsx",
        "CaseSubjectQuestionnaires"
      );
      Utils.setExcelHeaders(res, "xlsx");

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

  //Case Subject Questionnaire Export
  public async caseSubjectQuestionnaireExport(req: Request, res: Response) {
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

      const questionnaires: any = await CaseSubjectQuestionnaire.findAll({
        where,
        attributes: ["id", "question", "answerTypeId", "sequence", "createdAt"],
        include: [
          {
            model: CaseSubject,
            as: "caseSubject",
            attributes: ["id", "name", "clientId"],
            required: false,
            paranoid: false,
            include: [
              {
                model: Client,
                as: "client",
                attributes: ["id", "name"],
                required: false,
                paranoid: false,
              },
            ],
          },
          {
            model: AnswerType,
            as: "answerType",
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
        ],
        order: [["createdAt", "desc"]],
        paranoid: false,
      });

      if (!questionnaires || questionnaires.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let questionnaireArray: any[] = [];
      for (const questionnaire of questionnaires) {
        questionnaireArray.push({
          "Case Subject Name": questionnaire.caseSubject
            ? questionnaire.caseSubject.name
            : "",
          "Client Name": questionnaire.caseSubject?.client
            ? questionnaire.caseSubject.client.name
            : "",
          "Question": questionnaire.question,
          "Answer Type Name": questionnaire.answerType
            ? questionnaire.answerType.name
            : "",
          "Sequence": questionnaire.sequence,
          "Created At": moment
            .tz(questionnaire.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
        });
      }

      // Column Filter;
      const questionnaireColumnNames = questionnaireArray
        ? Object.keys(questionnaireArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          questionnaireArray,
          questionnaireColumnNames,
          format,
          "CaseSubjectQuestionnaires"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          questionnaireArray,
          questionnaireColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Case subject questionnaire export successfully`,
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
}

async function save(req: any, res: any, importData?: any) {
  const transaction = await sequelize.transaction();
  try {
    let payload = req.body;
    if (importData !== undefined) {
      payload = importData;

      //SERVICE DETAILS REQUIRED VALIDATION
      if (!payload.serviceNames) {
        await transaction.rollback();
        return {
          success: false,
          error: "Service details not found",
          data: payload,
        };
      }

      //CHECK ALL SERVICE DETAILS ARE AVAILABLE IN SERVICE MASTER
      if (payload.services && payload.services.length > 0) {
        for (const serviceName of payload.services) {
          const trimmedServiceName = serviceName.trim();
          const checkServiceNameExist = await Service.findOne({
            where: {
              name: trimmedServiceName,
            },
            paranoid: false,
          });
          if (!checkServiceNameExist) {
            await transaction.rollback();
            return {
              success: false,
              error: `Service (${trimmedServiceName}) not found`,
              data: payload,
            };
          }
        }
      }
    } else {
      payload = req.body;
    }

    //VALIDATIONS

    const v = {
      caseSubjectId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      clientId: "required|numeric",
      caseTypeId: "required|numeric",
      serviceIds: "required|array",
      "serviceIds.*": "required",
      status: "required|numeric",
      questionnaires: "array",
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

    const { caseSubjectId, name, ...inputData } = payload;
    const caseSubjectName = name.trim();

    // Validate caseTypeId if provided
    if (inputData.caseTypeId) {
      const caseType = await Config.findOne({
        where: {
          id: inputData.caseTypeId,
          typeId: 38, // Case Creation Types
        },
        attributes: ["id"],
      });
      if (!caseType) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Invalid case type",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Invalid case type",
          });
        }
      }
    }

    const client = await Client.findByPk(inputData.clientId);
    if (!client) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Client not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }
    }

    if (caseSubjectId) {
      const caseSubject = await CaseSubject.findOne({
        where: {
          id: caseSubjectId,
        },
        paranoid: false,
      });
      if (!caseSubject) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Case subject not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Case subject not found",
          });
        }
      }

      const caseSubjectAlreadyExists = await CaseSubject.findOne({
        where: {
          name: caseSubjectName,
          clientId: inputData.clientId,
          id: {
            [Op.ne]: caseSubjectId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (caseSubjectAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Case subject is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Case subject is already taken",
          });
        }
      }
    } else {
      const caseSubjectAlreadyExists = await CaseSubject.findOne({
        where: {
          name: caseSubjectName,
          clientId: inputData.clientId,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (caseSubjectAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Case subject is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Case subject is already taken",
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
      name: caseSubjectName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    let caseSubjectPrimaryId = null;
    if (caseSubjectId) {
      await CaseSubject.update(data, {
        where: {
          id: caseSubjectId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "Case subject updated successfully";
      caseSubjectPrimaryId = caseSubjectId;
    } else {
      const newCaseSubject = await CaseSubject.create(data, {
        transaction: transaction,
      });
      message = "Case subject created successfully";
      caseSubjectPrimaryId = newCaseSubject.dataValues.id;
    }

    //EXISTING SUBJECT SERVICES
    const existingSubjectServices = await SubjectService.findAll({
      where: { subjectId: caseSubjectPrimaryId },
      attributes: ["id", "serviceId"],
      paranoid: false,
    });

    //CHECK EXISTING(DATABASE) SUBJECT SERVICES EXIST IN THE GIVEN(FORM OR UPLOAD) SUBJECT SERVICES. IF NOT DELETE IT.
    if (existingSubjectServices.length > 0) {
      for (const existingSubjectService of existingSubjectServices) {
        let removeExistingSubjectService = false;
        if (inputData.serviceIds.length > 0) {
          const existingSubjectServiceExists = inputData.serviceIds.find(
            (givenSubjectService: any) =>
              givenSubjectService == existingSubjectService.dataValues.serviceId
          );

          //NOT EXIST THEN DELETE THE EXISTING SERVICE SUBJECT
          if (!existingSubjectServiceExists) {
            removeExistingSubjectService = true;
          }
        } else {
          removeExistingSubjectService = true;
        }

        if (removeExistingSubjectService) {
          await SubjectService.destroy({
            where: {
              id: existingSubjectService.dataValues.id,
            },
            force: true,
            transaction: transaction,
          });
        }
      }
    }

    //SAVE SUBJECTS SERVICE
    if (inputData.serviceIds.length > 0) {
      for (const serviceId of inputData.serviceIds) {
        const service = await Service.findOne({
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
              error: `Service (${serviceId}) not found`,
              data: payload,
            };
          } else {
            return res.status(200).json({
              success: false,
              error: `Service (${serviceId}) not found`,
            });
          }
        }

        const checkSubjectServiceAlreadyExists = await SubjectService.findOne({
          where: {
            subjectId: caseSubjectPrimaryId,
            serviceId: serviceId,
          },
          paranoid: false,
          transaction: transaction,
        });
        if (!checkSubjectServiceAlreadyExists) {
          await SubjectService.create(
            {
              subjectId: caseSubjectPrimaryId,
              serviceId: serviceId,
            },
            {
              transaction: transaction,
            }
          );
        }
      }
    }

    //HANDLE QUESTIONNAIRES
    if (inputData.questionnaires && Array.isArray(inputData.questionnaires)) {
      // Get existing questionnaires
      const existingQuestionnaires = await CaseSubjectQuestionnaire.findAll({
        where: { caseSubjectId: caseSubjectPrimaryId },
        attributes: ["id", "question", "answerTypeId", "sequence"],
        paranoid: false,
      });

      // Delete questionnaires that are not in the new list
      const newQuestionnaireIds = inputData.questionnaires
        .map((q: any) => q.id)
        .filter((id: any) => id);

      for (const existingQuestionnaire of existingQuestionnaires) {
        const existsInNew = newQuestionnaireIds.includes(
          existingQuestionnaire.dataValues.id
        );
        if (!existsInNew) {
          await CaseSubjectQuestionnaire.destroy({
            where: {
              id: existingQuestionnaire.dataValues.id,
            },
            force: true,
            transaction: transaction,
          });
        }
      }

      // Create or update questionnaires
      for (let index = 0; index < inputData.questionnaires.length; index++) {
        const questionnaire = inputData.questionnaires[index];

        // Validate questionnaire
        if (!questionnaire.question || !questionnaire.answerTypeId) {
          await transaction.rollback();
          if (importData !== undefined) {
            return {
              success: false,
              error: "Question and Answer Type are required for each questionnaire",
              data: payload,
            };
          } else {
            return res.status(200).json({
              success: false,
              error: "Question and Answer Type are required for each questionnaire",
            });
          }
        }

        // Verify answer type exists
        const answerType = await AnswerType.findOne({
          where: {
            id: questionnaire.answerTypeId,
          },
          paranoid: false,
        });
        if (!answerType) {
          await transaction.rollback();
          if (importData !== undefined) {
            return {
              success: false,
              error: `Answer type (${questionnaire.answerTypeId}) not found`,
              data: payload,
            };
          } else {
            return res.status(200).json({
              success: false,
              error: `Answer type (${questionnaire.answerTypeId}) not found`,
            });
          }
        }

        const questionnaireData: any = {
          caseSubjectId: caseSubjectPrimaryId,
          question: questionnaire.question.trim(),
          answerTypeId: questionnaire.answerTypeId,
          sequence: questionnaire.sequence !== undefined && questionnaire.sequence !== null ? questionnaire.sequence : index,
          updatedById: inputData.authUserId,
        };

        if (questionnaire.id) {
          // Update existing questionnaire
          await CaseSubjectQuestionnaire.update(questionnaireData, {
            where: {
              id: questionnaire.id,
            },
            paranoid: false,
            transaction: transaction,
          });
        } else {
          // Create new questionnaire
          questionnaireData.createdById = inputData.authUserId;
          await CaseSubjectQuestionnaire.create(questionnaireData, {
            transaction: transaction,
          });
        }
      }
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
async function getCaseSubjectFinalData(caseSubjectData: any) {
  const transformedData = await Promise.all(
    caseSubjectData.map(async (caseSubjectData: any) => {
      const clientId: any = await Client.findOne({
        attributes: ["id", "name"],
        where: { id: caseSubjectData.dataValues.clientId },
        paranoid: false,
      });
      const services: any = await SubjectService.findAll({
        where: {
          subjectId: caseSubjectData.dataValues.id,
        },
        attributes: [[Sequelize.col("service.name"), "serviceName"]],
        include: {
          model: Service,
          as: "service",
          attributes: [],
          required: false,
          paranoid: false,
        },
        paranoid: false,
      });
      let commaSeparatedServiceNames = null;
      if (services && services.length > 0) {
        const serviceNames = services.map(
          (service: any) => service.dataValues.serviceName
        );
        commaSeparatedServiceNames = serviceNames.join(", ");
      }

      let caseTypeName = null;
      if (caseSubjectData.dataValues.caseTypeId) {
        const caseType: any = await Config.findOne({
          where: {
            id: caseSubjectData.dataValues.caseTypeId,
            typeId: 38, // Case Creation Types
          },
          attributes: ["name"],
        });
        if (caseType) {
          caseTypeName = caseType.dataValues.name;
        }
      }

      return {
        Name: caseSubjectData.dataValues.name,
        "Client Name": clientId ? clientId.dataValues.name : null,
        "Case Type": caseTypeName,
        Services: commaSeparatedServiceNames,
        "Created At": moment
          .tz(caseSubjectData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: caseSubjectData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );

  return transformedData;
}

export default new CaseSubjectController();
