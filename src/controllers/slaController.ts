import {
  City,
  Config,
  Dealer,
  SlaSetting,
  SlaViolateReason,
} from "../database/models/index";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import moment, { MomentInput } from "moment-timezone";
import { Request, Response } from "express";
import axios from "axios";
import config from "../config/config.json";
import sendEmail from "../lib/mailer";
import { Op, Sequelize } from "sequelize";
import Utils from "../lib/utils";
import slaViolateReason from "../database/models/slaViolateReasons";

import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

//API with endpoint (Case Service);
const caseServiceUrl = `${config.caseService.host}:${config.caseService.port}/${config.caseService.version}/${config.caseService.serviceAccess.case}`;
const caseEndpoint = config.caseService.endpoint;

class SlaController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { typeId, limit, offset, apiType, search, status, caseTypeId } =
        req.query;

      // Filter Where Condition;
      const where: any = {};

      if (typeId) {
        where.typeId = typeId;
      }
      if (caseTypeId) {
        where.caseTypeId = caseTypeId;
      }

      //DROPDOWN API
      if (apiType == "dropdown") {
        const slaList: any = await SlaSetting.findAll({
          where,
          attributes: [
            "id",
            [Sequelize.literal("( SELECT caseType.name)"), "caseTypeName"],
            [Sequelize.literal("( SELECT type.name)"), "typeName"],
            "time",
          ],
          include: [
            {
              model: Config,
              as: "caseType",
              required: true,
              attributes: ["id", "name"],
            },
            {
              model: Config,
              as: "type",
              required: true,
              attributes: ["id", "name"],
            },
          ],
          order: [["id", "asc"]],
        });

        if (slaList.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }

        const transformedData = await Promise.all(
          slaList.map(async (sla: any) => {
            return {
              id: sla.dataValues.id,
              caseType: sla.dataValues.caseTypeName,
              type: sla.dataValues.typeName,
              congigId: sla.typeId,
              time: Utils.secondsToTime(sla.dataValues.time),
              seconds: sla.dataValues.time,
            };
          })
        );

        return res.status(200).json({
          success: true,
          message: "Data Fetched Successfully",
          data: transformedData,
        });
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
            Sequelize.literal(`caseType.name LIKE "%${search}%"`),
            Sequelize.literal(`type.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (slaSetting.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = SlaController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = SlaController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        const slaList: any = await SlaSetting.findAndCountAll({
          where,
          attributes: [
            "id",
            "typeId",
            [Sequelize.literal("( SELECT caseType.name)"), "caseTypeName"],
            [Sequelize.literal("( SELECT type.name)"), "typeName"],
            "time",
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(slaSetting.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (slaSetting.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: Config,
              as: "caseType",
              required: true,
              attributes: ["id", "name"],
            },
            {
              model: Config,
              as: "type",
              required: true,
              attributes: ["id", "name"],
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (slaList.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }

        const transformedData = await Promise.all(
          slaList.rows.map(async (sla: any) => {
            return {
              id: sla.dataValues.id,
              caseType: sla.dataValues.caseTypeName,
              type: sla.dataValues.typeName,
              congigId: sla.typeId,
              time: Utils.secondsToTime(sla.dataValues.time),
              seconds: sla.dataValues.time,
              createdAt: sla.dataValues.createdAt,
              status: sla.dataValues.status,
            };
          })
        );

        slaList.rows = transformedData;
        return res.status(200).json({
          success: true,
          message: "Data Fetched Successfully",
          data: slaList,
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getFormData = async (req: Request, res: Response) => {
    try {
      const { slaId } = req.query;

      let slaData = null;
      if (slaId) {
        const slaExists: any = await SlaSetting.findOne({
          where: {
            id: slaId,
          },
          paranoid: false,
        });

        if (!slaExists) {
          return res.status(200).json({
            success: false,
            error: "SLA not found",
          });
        }

        slaData = slaExists;
      }

      //EXTRAS
      const caseTypes = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 4, //CASE TYPES
        },
        order: [["id", "asc"]],
      });
      const types = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 33, //SLA TYPES
        },
        order: [["id", "asc"]],
      });

      const locationTypes = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 53, //City Location Types
        },
        order: [["id", "asc"]],
      });

      let sla = null;
      if (slaData) {
        const { deletedAt, ...restData } = slaData.dataValues;
        sla = {
          ...restData,
          status: deletedAt ? 0 : 1,
        };
      }

      const data = {
        extras: {
          caseTypes,
          types,
          locationTypes,
        },
        sla: sla,
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

  //Save And Update;
  // save = async (req: Request, res: any) => {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     const payload = req.body;
  //     const validatorRules = {
  //       caseTypeId: "numeric",
  //       typeId: "required|numeric",
  //       time: "required",
  //       status: "required|numeric",
  //     };
  //     const v = new Validator(payload, validatorRules);

  //     const matched = await v.check();
  //     if (!matched) {
  //       const errors: any = [];
  //       Object.keys(validatorRules).forEach((key) => {
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

  //     const { slaId, ...inputData } = payload;

  //     //CUSTOM VALIDATIONS
  //     const caseType = await Config.findOne({
  //       where: {
  //         id: inputData.caseTypeId,
  //         typeId: 4, //CASE TYPES
  //       },
  //       transaction,
  //     });
  //     if (!caseType) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "Case Type not found",
  //       });
  //     }

  //     const type = await Config.findOne({
  //       where: {
  //         id: inputData.typeId,
  //         typeId: 33, //SLA TYPES
  //       },
  //       transaction,
  //     });
  //     if (!type) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "Type not found",
  //       });
  //     }

  //     let uniqueWhereClause: any = {};
  //     if (slaId) {
  //       const slaSetting = await SlaSetting.findByPk(slaId, {
  //         paranoid: false,
  //         transaction: transaction,
  //       });
  //       if (!slaSetting) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "SLA Not Found",
  //         });
  //       }

  //       uniqueWhereClause = {
  //         caseTypeId: inputData.caseTypeId,
  //         typeId: inputData.typeId,
  //         id: {
  //           [Op.ne]: slaId,
  //         },
  //       };
  //     } else {
  //       uniqueWhereClause = {
  //         caseTypeId: inputData.caseTypeId,
  //         typeId: inputData.typeId,
  //       };
  //     }

  //     const slaSettingAlreadyExists = await SlaSetting.findOne({
  //       where: uniqueWhereClause,
  //       attributes: ["id"],
  //       paranoid: false,
  //       transaction,
  //     });
  //     if (slaSettingAlreadyExists) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "SLA is already taken",
  //       });
  //     }

  //     let deletedAt = null;
  //     let deletedById = null;
  //     //INACTIVE
  //     if (inputData.status == 0) {
  //       deletedAt = new Date();
  //       deletedById = inputData.authUserId;
  //     }

  //     const data: any = {
  //       ...inputData,
  //       deletedById: deletedById,
  //       deletedAt: deletedAt,
  //     };

  //     let message: any;
  //     if (slaId) {
  //       await SlaSetting.update(data, {
  //         where: {
  //           id: slaId,
  //         },
  //         paranoid: false,
  //         transaction: transaction,
  //       });
  //       message = "SLA updated successfully";
  //     } else {
  //       await SlaSetting.create(data, {
  //         transaction: transaction,
  //       });
  //       message = "SLA created successfully";
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

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        status: "required|numeric",
        slaIds: "required|array",
        "slaIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { slaIds, status, updatedById, deletedById } = payload;
      if (slaIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one SLA",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const slaId of slaIds) {
        const slaExists = await SlaSetting.findOne({
          where: {
            id: slaId,
          },
          paranoid: false,
        });
        if (!slaExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `SLA (${slaId}) not found`,
          });
        }

        await SlaSetting.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: slaId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "SLA status updated successfully",
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
        slaIds: "required|array",
        "slaIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { slaIds } = payload;
      if (slaIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one SLA",
        });
      }

      for (const slaId of slaIds) {
        const slaExists = await SlaSetting.findOne({
          where: {
            id: slaId,
          },
          paranoid: false,
        });
        if (!slaExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `SLA (${slaId}) not found`,
          });
        }

        await SlaSetting.destroy({
          where: {
            id: slaId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "SLA deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  //Get By Id;
  getFormDataById = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const { typeId } = req.query;
      if (!typeId) {
        return res.status(200).json({
          success: false,
          error: "Please Select The TypeId",
        });
      }

      const sla: any = await SlaSetting.findOne({
        where: {
          typeId: typeId,
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
        include: [
          {
            model: Config,
            attributes: ["typeId", "name"],
            as: "caseType",
          },
          {
            model: Config,
            attributes: ["typeId", "name"],
            as: "type",
          },
        ],
        paranoid: false,
      });

      if (!sla) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const transformedData = {
        id: sla.dataValues.id,
        time: sla.dataValues.time,
        type: {
          typeId: sla.dataValues.typeId,
          typeName: sla.dataValues.type.name,
        },
        caseType: {
          caseTypeId: sla.dataValues.caseType.typeId,
          caseTypeName: sla.dataValues.caseType.name,
        },
      };

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: transformedData,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  //Check SLA Status;
  checkSla = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      if (payload.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Case not found",
        });
      }

      const [
        agentAssignmentSla,
        aspAssignmentSla,
        dealerAdvanceInitialWarningSla,
        dealerAdvanceFinalWarningSla,
        dealerAdvanceEscalationSla,
      ] = await Promise.all([
        SlaSetting.findOne({
          attributes: ["time"],
          where: {
            typeId: 360,
            caseTypeId: 32,
          },
        }),
        SlaSetting.findOne({
          attributes: ["time"],
          where: {
            typeId: 361,
            caseTypeId: 32,
          },
        }),
        SlaSetting.findOne({
          attributes: ["time"],
          where: {
            typeId: 362,
            caseTypeId: 32,
          },
        }),
        SlaSetting.findOne({
          attributes: ["time"],
          where: {
            typeId: 363,
            caseTypeId: 32,
          },
        }),
        SlaSetting.findOne({
          attributes: ["time"],
          where: {
            typeId: 364,
            caseTypeId: 32,
          },
        }),
      ]);

      if (!agentAssignmentSla) {
        return res.status(200).json({
          success: false,
          error: "Agent Assignment SLA not found",
        });
      }
      if (!aspAssignmentSla) {
        return res.status(200).json({
          success: false,
          error: "ASP Assignment SLA not found",
        });
      }
      if (!dealerAdvanceInitialWarningSla) {
        return res.status(200).json({
          success: false,
          error: "Dealer Advance Payment - Initial Warning SLA not found",
        });
      }
      if (!dealerAdvanceFinalWarningSla) {
        return res.status(200).json({
          success: false,
          error: "Dealer Advance Payment - Final Warning SLA not found",
        });
      }
      if (!dealerAdvanceEscalationSla) {
        return res.status(200).json({
          success: false,
          error: "Dealer Advance Payment - Escalation SLA not found",
        });
      }

      for (const caseDetail of payload) {
        let slaDetails = Array();
        let activityId = null;
        let aspServiceAcceptedAt = null;
        let sentApprovalAt = null;
        let dealerAdvancePaidAt = null;
        let aspReachedToPickupAt = null;
        let dealerAdvanceInitialWarningSent = 0;
        let dealerAdvanceFinalWarningSent = 0;
        let dealerAdvanceEscalationSent = 0;

        //ACTIVITY
        if (caseDetail.activities.length > 0) {
          activityId = caseDetail.activities[0].id;
          aspServiceAcceptedAt = caseDetail.activities[0].aspServiceAcceptedAt;
          sentApprovalAt = caseDetail.activities[0].sentApprovalAt;
          aspReachedToPickupAt = caseDetail.activities[0].aspReachedToPickupAt;
          dealerAdvanceInitialWarningSent =
            caseDetail.activities[0].dealerAdvanceInitialWarningSent;
          dealerAdvanceFinalWarningSent =
            caseDetail.activities[0].dealerAdvanceFinalWarningSent;
          dealerAdvanceEscalationSent =
            caseDetail.activities[0].dealerAdvanceEscalationSent;

          //ACTIVITY TRANSACTION
          if (caseDetail.activities[0].activityTransactions.length > 0) {
            dealerAdvancePaidAt =
              caseDetail.activities[0].activityTransactions[0].paidAt;
          }
        }

        let agentAssignment = this.agentAssignment(
          caseDetail.agentId,
          caseDetail.createdAt,
          caseDetail.agentAssignedAt,
          agentAssignmentSla.dataValues.time
        );
        if (agentAssignment) {
          slaDetails.push(agentAssignment);
        }

        if (caseDetail.agentAssignedAt) {
          let aspAssignment = this.aspAssignment(
            activityId,
            caseDetail.agentAssignedAt,
            aspServiceAcceptedAt,
            aspAssignmentSla.dataValues.time
          );
          if (aspAssignment) {
            slaDetails.push(aspAssignment);
          }

          if (activityId && sentApprovalAt) {
            const getDealersForSla = await axios.get(
              `${caseServiceUrl}/${caseEndpoint.case.getDealersForDealerAdvancePaymentSla}?activityId=${activityId}`
            );
            if (!getDealersForSla.data.success) {
              return res.status(200).json({
                success: false,
                error: `Activity ID (${activityId}) : ${getDealersForSla.data.error}`,
              });
            }
            const notyDealerIds =
              getDealersForSla.data.data.eligibleDealerIdsToSendNoty;
            const previousActivityPaidByDealerId =
              getDealersForSla.data.data.previousActivityPaidByDealerId;

            let dealerAdvance: any = await this.dealerAdvance(
              dealerAdvancePaidAt,
              sentApprovalAt,
              caseDetail.deliveryRequestCreatedDealerId,
              previousActivityPaidByDealerId,
              notyDealerIds,
              caseDetail.id,
              activityId,
              dealerAdvanceInitialWarningSla.dataValues.time,
              dealerAdvanceFinalWarningSla.dataValues.time,
              dealerAdvanceEscalationSla.dataValues.time,
              caseDetail.agentId,
              dealerAdvanceInitialWarningSent,
              dealerAdvanceFinalWarningSent,
              dealerAdvanceEscalationSent,
              caseDetail.caseNumber
            );
            if (dealerAdvance.success) {
              slaDetails.push(dealerAdvance);
            } else if (!dealerAdvance.success && dealerAdvance.error != null) {
              return res.status(200).json({
                success: false,
                error: `Activity ID (${activityId}) : ${dealerAdvance.error}`,
              });
            }

            if (dealerAdvancePaidAt) {
              let aspCompleted = this.aspCompleted(
                aspReachedToPickupAt,
                caseDetail.deliveryRequestPickupDate,
                caseDetail.deliveryRequestPickupTime
              );
              if (aspCompleted) {
                slaDetails.push(aspCompleted);
              }
            }
          }
        }

        if (slaDetails.length > 0) {
          caseDetail.slaDetails = slaDetails;
          const createData = {
            caseDetailId: caseDetail.id,
            activityId: activityId,
            slaDetails: slaDetails,
          };
          // console.log(caseDetail, createData);
          const createSlaForCaseResponse: any = await axios.post(
            `${caseServiceUrl}/${caseEndpoint.case.createSlaForCase}`,
            createData
          );
          if (!createSlaForCaseResponse.data.success) {
            return res.status(200).json({
              success: false,
              error: `Case Detail ID (${caseDetail.id}) : ${createSlaForCaseResponse.data.error}`,
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "SLA updated successfully",
        data: payload,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // Agent Assignment
  private agentAssignment(
    agentId: any,
    caseCreatedAt: any,
    agentAssignedAt: any,
    time: any
  ) {
    const agentAssignmentSlaTime = time * 1;
    const slaMinimumTimeForTimeLeftInSeconds: any =
      process.env.SLA_MIN_TIME_FOR_TIME_LEFT_IN_SECONDS;

    //AGENT NOT ASSIGNED
    if (!agentId) {
      const timeDifference = Math.floor(
        (new Date().getTime() - new Date(caseCreatedAt).getTime()) / 1000
      );
      let status = "";
      let statusColor = "";
      if (timeDifference > agentAssignmentSlaTime) {
        status = "SLA Violated";
        statusColor = "red";
      } else {
        const seconds = agentAssignmentSlaTime - timeDifference;
        status = `${Utils.secondsToTime(seconds)} left`;
        if (seconds > slaMinimumTimeForTimeLeftInSeconds) {
          statusColor = "green";
        } else {
          statusColor = "orange";
        }
      }
      return {
        id: 360,
        name: "Agent Assignment",
        status: status,
        statusColor: statusColor,
      };
    } else if (agentAssignedAt && agentId) {
      //AGENT ASSIGNED
      const timeDifference = Math.floor(
        (new Date(agentAssignedAt).getTime() -
          new Date(caseCreatedAt).getTime()) /
          1000
      );
      let status = "";
      let statusColor = "";
      if (timeDifference > agentAssignmentSlaTime) {
        status = "SLA Violated";
        statusColor = "red";
      } else {
        status = "SLA Achieved";
        statusColor = "green";
      }
      return {
        id: 360,
        name: "Agent Assignment",
        status: status,
        statusColor: statusColor,
      };
    } else {
      // Handle other cases if needed
      return null;
    }
  }

  // ASP Assignment
  private aspAssignment(
    activityId: any,
    agentAssignedAt: any,
    aspServiceAcceptedAt: any,
    time: any
  ) {
    const aspAssignmentSlaTime = time * 1;
    const slaMinimumTimeForTimeLeftInSeconds: any =
      process.env.SLA_MIN_TIME_FOR_TIME_LEFT_IN_SECONDS;

    //ACTIVITY NOT CREATED || ACTIVITY CREATED AND ASP NOT ACCEPTED
    if (!activityId || (activityId && !aspServiceAcceptedAt)) {
      const timeDifference = Math.floor(
        (new Date().getTime() - new Date(agentAssignedAt).getTime()) / 1000
      );
      let status = "";
      let statusColor = "";
      if (timeDifference > aspAssignmentSlaTime) {
        status = "SLA Violated";
        statusColor = "red";
      } else {
        const seconds = aspAssignmentSlaTime - timeDifference;
        status = `${Utils.secondsToTime(seconds)} left`;
        if (seconds > slaMinimumTimeForTimeLeftInSeconds) {
          statusColor = "green";
        } else {
          statusColor = "orange";
        }
      }
      return {
        id: 361,
        name: "ASP Assignment",
        status: status,
        statusColor: statusColor,
      };
    } else if (activityId && aspServiceAcceptedAt) {
      //ACTIVITY CREATED AND ASP ACCEPTED
      const timeDifference = Math.floor(
        (new Date(aspServiceAcceptedAt).getTime() -
          new Date(agentAssignedAt).getTime()) /
          1000
      );
      let status = "";
      let statusColor = "";
      if (timeDifference > aspAssignmentSlaTime) {
        status = "SLA Violated";
        statusColor = "red";
      } else {
        status = "SLA Achieved";
        statusColor = "green";
      }
      return {
        id: 361,
        name: "ASP Assignment",
        status: status,
        statusColor: statusColor,
      };
    } else {
      // Handle other cases if needed
      return null;
    }
  }

  // Dealer Advance Payment
  private async dealerAdvance(
    dealerAdvancePaidAt: any,
    sentApprovalAt: any,
    createdDealerId: any,
    previousActivityPaidByDealerId: any,
    notyDealerIds: any,
    caseId: any,
    activityId: any,
    initialTime: any,
    finalTime: any,
    escalationTime: any,
    agentId: any,
    dealerAdvanceInitialWarningSent: any,
    dealerAdvanceFinalWarningSent: any,
    dealerAdvanceEscalationSent: any,
    caseNumber: any
  ) {
    const dealerAdvanceInitialWarningSlaTime = initialTime * 1;
    const dealerAdvanceFinalWarningSlaTime = finalTime * 1;
    const dealerAdvanceEscalationSlaTime = escalationTime * 1;
    const slaMinimumTimeForTimeLeftInSeconds: any =
      process.env.SLA_MIN_TIME_FOR_TIME_LEFT_IN_SECONDS;

    let dealerEmailAddress = [];
    const notyDealers: any = await Dealer.findAll({
      where: { id: notyDealerIds },
      attributes: ["id", "email"],
    });
    if (notyDealers.length > 0) {
      dealerEmailAddress = notyDealers
        .map((notyDealer: any) => notyDealer.dataValues.email)
        .filter((value: any) => value !== null);
    }

    //DEALER ADVANCE NOT PAID
    if (!dealerAdvancePaidAt) {
      const timeDifference = Math.floor(
        (new Date().getTime() - new Date(sentApprovalAt).getTime()) / 1000
      );
      const seconds = dealerAdvanceFinalWarningSlaTime - timeDifference;

      //TIME DIFFERENCE WITHIN INITIAL WARNING TIME
      if (timeDifference < dealerAdvanceInitialWarningSlaTime) {
        let status = `${Utils.secondsToTime(seconds)} left`;
        let statusColor = "";
        if (seconds > slaMinimumTimeForTimeLeftInSeconds) {
          statusColor = "green";
        } else {
          statusColor = "orange";
        }
        return {
          success: true,
          id: 363,
          name: "Dealer Advance Payment - Final Warning",
          status: status,
          statusColor: statusColor,
        };
      } else if (
        timeDifference >= dealerAdvanceInitialWarningSlaTime &&
        timeDifference < dealerAdvanceFinalWarningSlaTime
      ) {
        //TIME DIFFERENCE EXCEEDS INITIAL WARNING TIME AND WITHIN FINAL WARNING TIME
        let status = `${Utils.secondsToTime(seconds)} left`;
        let statusColor = "";

        if (seconds > slaMinimumTimeForTimeLeftInSeconds) {
          statusColor = "green";
        } else {
          statusColor = "orange";
        }

        //SEND INITIAL WARNING IF NOT SENT
        if (!dealerAdvanceInitialWarningSent) {
          console.log(" == dealerAdvanceInitialWarningSent ==");
          const sendMailResponse = await sendEmail(
            caseId,
            "Dealer Advance Payment Initial Warning",
            dealerEmailAddress,
            "sla-dealerAdvancePayment-template.html",
            `The advance payment for the Delivery Request ${caseNumber} remains outstanding. Kindly make the advance payment.`
          );
          if (!sendMailResponse.success) {
            console.log(sendMailResponse.error);
          }

          let updateDealerAdvanceSlaWarningStatusResponse: any =
            await axios.post(
              `${caseServiceUrl}/${caseEndpoint.case.updateDealerAdvanceSlaWarningStatus}`,
              {
                activityId: activityId,
                time: "initialWarning",
                previousActivityPaidByDealerId: previousActivityPaidByDealerId,
              }
            );
          if (!updateDealerAdvanceSlaWarningStatusResponse.data.success) {
            return {
              success: false,
              error: updateDealerAdvanceSlaWarningStatusResponse.data.error,
            };
          }
        }

        return {
          success: true,
          id: 363,
          name: "Dealer Advance Payment - Final Warning",
          status: status,
          statusColor: statusColor,
        };
      } else if (
        timeDifference >= dealerAdvanceFinalWarningSlaTime &&
        timeDifference < dealerAdvanceEscalationSlaTime
      ) {
        //TIME DIFFERENCE EXCEEDS FINAL WARNING TIME AND WITHIN ESCALATION TIME
        let status = "SLA Violated";
        let statusColor = "red";

        //SEND FINAL WARNING IF NOT SENT
        if (!dealerAdvanceFinalWarningSent) {
          console.log(" == dealerAdvanceFinalWarningSent ==");
          const sendMailResponse = await sendEmail(
            caseId,
            "Dealer Advance Payment Final Warning",
            dealerEmailAddress,
            "sla-dealerAdvancePayment-template.html",
            `The advance payment SLA for the Delivery Request ${caseNumber} is violated. Kindly contact the company's SPOC.`
          );
          if (!sendMailResponse.success) {
            console.log(sendMailResponse.error);
          }

          let updateDealerAdvanceSlaWarningStatusResponse: any =
            await axios.post(
              `${caseServiceUrl}/${caseEndpoint.case.updateDealerAdvanceSlaWarningStatus}`,
              {
                activityId: activityId,
                time: "finalWarning",
                previousActivityPaidByDealerId: previousActivityPaidByDealerId,
              }
            );
          if (!updateDealerAdvanceSlaWarningStatusResponse.data.success) {
            return {
              success: false,
              error: updateDealerAdvanceSlaWarningStatusResponse.data.error,
            };
          }

          // CANCEL CASE AND ACTIVITY IF AUTO CANCEL ENABLED FOR THE DEALER
          let autoCancelDealerId = previousActivityPaidByDealerId
            ? previousActivityPaidByDealerId
            : createdDealerId;
          let autoCancelDealer: any = await Dealer.findOne({
            where: { id: autoCancelDealerId },
            attributes: ["id", "autoCancelForDelivery", "email"],
          });

          if (
            autoCancelDealer &&
            autoCancelDealer.dataValues.autoCancelForDelivery
          ) {
            const caseAutoCancelResponse: any = await axios.post(
              `${caseServiceUrl}/${caseEndpoint.case.caseAutoCancel}`,
              {
                activityId: activityId,
                previousActivityPaidByDealerId: previousActivityPaidByDealerId,
              }
            );
            if (
              caseAutoCancelResponse.data.success &&
              autoCancelDealer.dataValues.email
            ) {
              const autoCancelSendMailResponse = await sendEmail(
                caseId,
                caseAutoCancelResponse.data.data.cancellationEmailSubject,
                [autoCancelDealer.dataValues.email],
                "sla-dealerAdvancePayment-template.html",
                caseAutoCancelResponse.data.data.cancellationEmailContent
              );
              if (!autoCancelSendMailResponse.success) {
                console.log(autoCancelSendMailResponse.error);
              }
            }
          }
        }

        return {
          success: true,
          id: 363,
          name: "Dealer Advance Payment - Final Warning",
          status: status,
          statusColor: statusColor,
        };
      } else if (timeDifference >= dealerAdvanceEscalationSlaTime) {
        //TIME DIFFERENCE EXCEEDS ESCALATION TIME
        let status = "SLA Violated";
        let statusColor = "red";

        //SEND ESCALATION IF NOT SENT
        if (!dealerAdvanceEscalationSent) {
          console.log(" == dealerAdvanceEscalationSent ==");
          const getAgentDetailResponse = await axios.post(
            `${userServiceUrl}/${userServiceEndpoint.getUser}`,
            { id: agentId }
          );
          if (!getAgentDetailResponse.data.success) {
            return {
              success: false,
              error: getAgentDetailResponse.data.error,
            };
          }
          let agentEmail = getAgentDetailResponse.data.user.email;

          if (agentEmail) {
            const sendMailResponse = await sendEmail(
              caseId,
              "Dealer Advance Payment Escalation",
              [agentEmail],
              "sla-dealerAdvancePayment-template.html",
              `The advance payment for the Delivery Request ${caseNumber} is still outstanding. Kindly request the dealer to make the advance payment.`
            );
            if (!sendMailResponse.success) {
              console.log(sendMailResponse.error);
            }
          }

          let updateDealerAdvanceSlaWarningStatusResponse: any =
            await axios.post(
              `${caseServiceUrl}/${caseEndpoint.case.updateDealerAdvanceSlaWarningStatus}`,
              {
                activityId: activityId,
                time: "escalation",
                previousActivityPaidByDealerId: previousActivityPaidByDealerId,
              }
            );
          if (!updateDealerAdvanceSlaWarningStatusResponse.data.success) {
            return {
              success: false,
              error: updateDealerAdvanceSlaWarningStatusResponse.data.error,
            };
          }
        }

        return {
          success: true,
          id: 363,
          name: "Dealer Advance Payment - Final Warning",
          status: status,
          statusColor: statusColor,
        };
      } else {
        console.log("else");
        return {
          success: false,
          error: null,
        };
      }
    } else if (dealerAdvancePaidAt) {
      //DEALER ADVANCE PAID
      const timeDifference = Math.floor(
        (new Date(dealerAdvancePaidAt).getTime() -
          new Date(sentApprovalAt).getTime()) /
          1000
      );
      let status = "";
      let statusColor = "";
      if (timeDifference > dealerAdvanceFinalWarningSlaTime) {
        status = "SLA Violated";
        statusColor = "red";
      } else {
        status = "SLA Achieved";
        statusColor = "green";
      }
      return {
        success: true,
        id: 363,
        name: "Dealer Advance Payment - Final Warning",
        status: status,
        statusColor: statusColor,
      };
    } else {
      // Handle other cases if needed
      return {
        success: false,
        error: null,
      };
    }
  }

  // ASP Reached Pickup
  private aspCompleted(
    reachedToPickupDate: any,
    expectedPickupDate: any,
    expectedPickupTime: any
  ) {
    const slaMinimumTimeForTimeLeftInSeconds: any =
      process.env.SLA_MIN_TIME_FOR_TIME_LEFT_IN_SECONDS;
    const [year, month, day] = expectedPickupDate.split("-");
    const [startHour, endHour] = expectedPickupTime.split(" - ");
    let expectedPickupDateAndTime = new Date(
      `${year}-${month}-${day}T${this.timeConvert(endHour)}:00:00`
    );

    //ASP NOT REACHED PICKUP LOCATION
    if (!reachedToPickupDate) {
      const timeDifference = Math.floor(
        (new Date(expectedPickupDateAndTime).getTime() - new Date().getTime()) /
          1000
      );
      let status = "";
      let statusColor = "";
      if (timeDifference < 0) {
        status = "SLA Violated";
        statusColor = "red";
      } else {
        const seconds = timeDifference;
        status = `${Utils.secondsToTime(seconds)} left`;
        if (seconds > slaMinimumTimeForTimeLeftInSeconds) {
          statusColor = "green";
        } else {
          statusColor = "orange";
        }
      }

      return {
        id: 365,
        name: "ASP Reached Pickup",
        status: status,
        statusColor: statusColor,
      };
    } else if (reachedToPickupDate) {
      //ASP REACHED PICKUP LOCATION
      const timeDifference = Math.floor(
        (new Date(reachedToPickupDate).getTime() -
          new Date(expectedPickupDateAndTime).getTime()) /
          1000
      );
      let status = "";
      let statusColor = "";
      if (timeDifference > 0) {
        status = "SLA Violated";
        statusColor = "red";
      } else {
        status = "SLA Achieved";
        statusColor = "green";
      }
      return {
        id: 365,
        name: "ASP Reached Pickup",
        status: status,
        statusColor: statusColor,
      };
    } else {
      // Handle other cases if needed
      return null;
    }
  }

  // Convert 2PM to 14
  private timeConvert(timeString: any) {
    // Extract hour and period (AM/PM) from the time string
    const [hour, period] = timeString.match(/\d+|AM|PM/g);

    // Convert hour to 24-hour format
    let hour24 = parseInt(hour, 10);
    if (period === "PM" && hour24 !== 12) {
      hour24 += 12;
    } else if (period === "AM" && hour24 === 12) {
      hour24 = 0;
    }

    // Return hour in 24-hour format
    return hour24.toString().padStart(2, "0");
  }

  getSlaSettings = async (req: any, res: any) => {
    try {
      const crmSlaSettings = await SlaSetting.findAll({
        where: { caseTypeId: 31 },
      });
      return res.status(200).json({
        success: true,
        data: crmSlaSettings,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getByCaseTypeAndTypeId = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        caseTypeId: "required|numeric",
        typeId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const breakdownAreaData = payload.breakdownAreaId
        ? await Utils.findByModelId(City, payload.breakdownAreaId, [
            "id",
            "name",
            "locationTypeId",
          ])
        : null;

      const where: any = {};
      where.caseTypeId = payload.caseTypeId;
      where.typeId = payload.typeId;
      if (breakdownAreaData) {
        where.locationTypeId = breakdownAreaData.locationTypeId;
      }

      const slaSetting = await SlaSetting.findOne({
        where,
        attributes: ["id", "time"],
        paranoid: false,
      });
      if (!slaSetting) {
        return res.status(200).json({
          success: false,
          error: "SLA setting not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: slaSetting,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  saveAndUpdate = async (req: any, res: any) => {
    return await save(req, res);
  };

  public async import(req: any, res: any) {
    try {
      const inData: any[] = req.body.jsonDataArray;
      const errorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      let importColumns = [
        "Case Type Name",
        "Type Name",
        "Time",
        "Location Type Name",
        "Status",
      ];

      const slaSettingSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const slaSettingSheet of slaSettingSheets) {
        importColumns.forEach((importColumn) => {
          if (!slaSettingSheet.hasOwnProperty(importColumn)) {
            slaSettingSheet[importColumn] = "";
          }
        });

        let reArrangedSlaSettings: any = {
          "Case Type Name": slaSettingSheet["Case Type Name"]
            ? String(slaSettingSheet["Case Type Name"])
            : null,
          "Type Name": slaSettingSheet["Type Name"]
            ? String(slaSettingSheet["Type Name"])
            : null,
          Time: slaSettingSheet["Time"]
            ? String(slaSettingSheet["Time"])
            : null,
          "Location Type Name": slaSettingSheet["Location Type Name"]
            ? String(slaSettingSheet["Location Type Name"])
            : null,
          Status: slaSettingSheet["Status"]
            ? String(slaSettingSheet["Status"])
            : null,
        };

        const record: any = {};
        const keyMapping: any = {
          caseTypeName: "caseTypeId",
          typeName: "typeId",
          locationTypeName: "locationTypeId",
        };
        for (const key in reArrangedSlaSettings) {
          let transformedKey = key
            .replace(/\s+/g, "")
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
              index === 0 ? word.toLowerCase() : word.toUpperCase()
            );

          // Check if key has a mapping, use the mapping if available
          transformedKey = keyMapping[transformedKey] || transformedKey;
          record[transformedKey] = reArrangedSlaSettings[key];
        }

        //CASE TYPE
        let caseTypeId = 0;
        if (record.caseTypeId) {
          const trimmedCaseTypeName = record.caseTypeId.trim();
          const caseTypeExists = await Config.findOne({
            where: {
              name: trimmedCaseTypeName,
              typeId: 4, //Case Types
            },
            attributes: ["id"],
          });
          if (caseTypeExists) {
            caseTypeId = caseTypeExists.dataValues.id;
          }
        }

        //TYPE
        let typeId = 0;
        if (record.typeId) {
          const trimmedTypeName = record.typeId.trim();
          const typeExists = await Config.findOne({
            where: {
              name: trimmedTypeName,
              typeId: 33, //SLA Types
            },
            attributes: ["id"],
          });
          if (typeExists) {
            typeId = typeExists.dataValues.id;
          }
        }

        //IF TYPE ASP Breakdown Reach Time SLA THEN GET LOCATION TYPE
        let locationTypeId = null;
        let locationTypeName = null;
        if (
          record.locationTypeId &&
          (typeId == 870 || typeId == 871 || typeId == 872 || typeId == 873)
        ) {
          const trimmedLocationTypeName = record.locationTypeId.trim();
          const locationTypeExists = await Config.findOne({
            where: {
              name: trimmedLocationTypeName,
              typeId: 53, //City Location Types
            },
            attributes: ["id"],
          });
          if (locationTypeExists) {
            locationTypeId = locationTypeExists.dataValues.id;
          }

          locationTypeName = trimmedLocationTypeName;
        }

        let slaId = null;
        if (caseTypeId && typeId) {
          const slaExists: any = await SlaSetting.findOne({
            where: {
              caseTypeId: caseTypeId,
              typeId: typeId,
              locationTypeId: locationTypeId,
            },
            attributes: ["id"],
            paranoid: false,
          });

          if (slaExists) {
            slaId = slaExists.id;
          }
        }

        record.slaId = slaId;
        record.caseTypeId = caseTypeId;
        record.typeId = typeId;
        record.locationTypeId = locationTypeId;
        record.locationTypeName = locationTypeName;
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
            ...reArrangedSlaSettings,
            Error: output.errors ? output.errors.join(",") : output.error,
          });
        } else {
          if (output.message === "SLA created successfully") {
            newRecordsCreated += 1;
          } else {
            existingRecordsUpdated += 1;
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New SLA created (${newRecordsCreated} records) and existing SLA updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New SLA created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing SLA updated (${existingRecordsUpdated} records)`
          : "No SLA created or updated";

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
        "SLA"
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

      const slaSettings = await SlaSetting.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!slaSettings || slaSettings.length === 0) {
        return res.status(200).json({
          success: false,
          error: "SLA data not found",
        });
      }

      let slaSettingsArray: any[] = [];
      for (const slaSetting of slaSettings) {
        const [caseType, type, locationType] = await Promise.all([
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: slaSetting.dataValues.caseTypeId },
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: slaSetting.dataValues.typeId },
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: slaSetting.dataValues.locationTypeId },
          }),
        ]);

        slaSettingsArray.push({
          "Case Type": caseType ? caseType.dataValues.name : null,
          Type: type ? type.dataValues.name : null,
          Time: slaSetting.dataValues.time,
          "Location Type": locationType ? locationType.dataValues.name : null,
          "Created At": moment
            .tz(slaSetting.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: slaSetting.dataValues.deletedAt ? "Inactive" : "Active",
        });
      }

      // Column Filter;
      const slaSettingColumnNames = slaSettingsArray
        ? Object.keys(slaSettingsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          slaSettingsArray,
          slaSettingColumnNames,
          format,
          "SLA Settings"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(slaSettingsArray, slaSettingColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `SLA export successfully`,
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
    let payload = req.body;
    if (importData) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATION
    const validatorRules = {
      caseTypeId: "numeric",
      typeId: "required|numeric",
      time: "required",
      status: "required|numeric",
    };
    const errors = await Utils.validateParams(payload, validatorRules);
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

    const { slaId, ...inputData } = payload;

    //CUSTOM VALIDATIONS
    const caseType = await Config.findOne({
      where: {
        id: inputData.caseTypeId,
        typeId: 4, //CASE TYPES
      },
      transaction,
    });
    if (!caseType) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          error: "Case Type not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Case Type not found",
        });
      }
    }

    const type = await Config.findOne({
      where: {
        id: inputData.typeId,
        typeId: 33, //SLA TYPES
      },
      transaction,
    });
    if (!type) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          error: "Type not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Type not found",
        });
      }
    }

    if (importData && inputData.locationTypeName && !inputData.locationTypeId) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Location type not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Location type not found",
        });
      }
    }

    let uniqueWhereClause: any = {};
    if (slaId) {
      const slaSetting = await SlaSetting.findByPk(slaId, {
        paranoid: false,
        transaction: transaction,
      });
      if (!slaSetting) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "SLA Not Found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "SLA Not Found",
          });
        }
      }

      uniqueWhereClause = {
        caseTypeId: inputData.caseTypeId,
        typeId: inputData.typeId,
        locationTypeId: inputData.locationTypeId
          ? inputData.locationTypeId
          : null,
        id: {
          [Op.ne]: slaId,
        },
      };
    } else {
      uniqueWhereClause = {
        caseTypeId: inputData.caseTypeId,
        typeId: inputData.typeId,
        locationTypeId: inputData.locationTypeId
          ? inputData.locationTypeId
          : null,
      };
    }

    const slaSettingAlreadyExists = await SlaSetting.findOne({
      where: uniqueWhereClause,
      attributes: ["id"],
      paranoid: false,
      transaction,
    });
    if (slaSettingAlreadyExists) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          error: "SLA is already taken",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "SLA is already taken",
        });
      }
    }

    let deletedAt = null;
    let deletedById = null;
    //INACTIVE
    if (inputData.status == 0) {
      deletedAt = new Date();
      deletedById = inputData.authUserId;
    }

    const data: any = {
      ...inputData,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message: any;
    if (slaId) {
      await SlaSetting.update(data, {
        where: {
          id: slaId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "SLA updated successfully";
    } else {
      await SlaSetting.create(data, {
        transaction: transaction,
      });
      message = "SLA created successfully";
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

export default new SlaController();
