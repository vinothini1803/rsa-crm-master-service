import { Op, Sequelize } from "sequelize";
import {
  Asp,
  State,
  City,
  AspMechanic,
  Config,
  AspSubService,
  SubService,
  Service,
  OwnPatrolVehicle,
  OwnPatrolVehicleHelper,
  Client,
  AspClient,
  AspLocationLog,
} from "../database/models/index";
import {
  generateMultipleCSVExport,
  generateMultipleXLSXAndXLSXExport,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import xlsx from "xlsx";
import { Validator } from "node-input-validator";
import { Request, Response } from "express";
import moment, { MomentInput } from "moment-timezone";
import axios from "axios";
import config from "../config/config.json";
import sequelize from "../database/connection";
const fs = require("fs").promises;
import { removeAspId } from "../controllers/aspMechanic";
import Utils from "../lib/utils";
import ownPatrolVehicle from "./ownPatrolVehicle";
import { checkOwnPatrolVehicleHasActiveShift } from "../utils/attendanceHelper";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class AspController {
  private static defaultLimit: number = 5;
  private static defaultOffset: number = 0;
  constructor() { }

  getFilterData = async (req: Request, res: Response) => {
    try {
      //EXTRAS
      const states = await State.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      const data = {
        extras: {
          states,
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

  getList = async (req: any, res: any) => {
    try {
      const {
        limit,
        offset,
        stateId,
        cityId,
        apiType,
        search,
        status,
        filterOwnPatrol,
        filterThirdParty,
        filterHasMechanic,
        includeParanoidFalse,
        financeAdminAspId,
      } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      if (stateId !== undefined) {
        where.stateId = stateId;
      }
      if (cityId !== undefined) {
        where.cityId = cityId;
      }
      if (filterOwnPatrol) {
        where.isOwnPatrol = filterOwnPatrol;
      }
      if (filterThirdParty) {
        where.isOwnPatrol = 0;
      }
      if (filterHasMechanic) {
        where.hasMechanic = 1;
      }
      // LIST FINANCE ADMIN ASP AND ITS SUB ASP WHOSE HAS MECHANIC IS 1
      if (financeAdminAspId) {
        where[Op.and] = [
          { hasMechanic: 1 },
          {
            [Op.or]: [
              { id: financeAdminAspId },
              { financeAdminId: financeAdminAspId },
            ],
          },
        ];
      }

      let asps: any;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
            { workshopName: { [Op.like]: `%${search}%` } },
          ];
        }

        let aspParanoid = true;
        if (includeParanoidFalse && includeParanoidFalse == 1) {
          aspParanoid = false;
        }

        asps = await Asp.findAll({
          where,
          attributes: [
            "id",
            "name",
            "code",
            "workshopName",
            [Sequelize.literal('CONCAT(code, " - ", workshopName)'), "aspCode"],
          ],
          order: [["id", "asc"]],
          paranoid: aspParanoid,
        });

        if (asps.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
            { workshopName: { [Op.like]: `%${search}%` } },
            { contactNumber: { [Op.like]: `%${search}%` } },
            Sequelize.literal(`state.name LIKE "%${search}%"`),
            Sequelize.literal(`city.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (asp.isOwnPatrol = 1, 'Yes', 'No') LIKE "%${search}%" )`
            ),
            Sequelize.literal(
              `( IF (asp.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
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
        let limitValue: number = AspController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = AspController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        asps = await Asp.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "code",
            "workshopName",
            "contactNumber",
            [Sequelize.literal("( SELECT state.name)"), "stateName"],
            [Sequelize.literal("( SELECT city.name)"), "cityName"],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(asp.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (asp.isOwnPatrol = 1, 'Yes', 'No') )"
              ),
              "isOwnPatrol",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (asp.isFinanceAdmin = 1, 'Yes', 'No') )"
              ),
              "isFinanceAdmin",
            ],
            [
              Sequelize.literal("( SELECT financeAdmin.code)"),
              "financeAdminCode",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (asp.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: State,
              required: true,
              attributes: ["id", "name"],
            },
            {
              model: City,
              required: false,
              attributes: ["id", "name"],
            },
            {
              model: Asp,
              as: "financeAdmin",
              required: false,
              attributes: ["id", "code"],
              paranoid: false,
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (asps.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: asps,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  //USED FOR DELIVERY REQUEST && ASP INVOICE (LOGIN RESPONSE - TO ENABLE TICKETS & INVOICE IN MOBILE APP) PURPOSE
  getAspDetails = async (req: any, res: any) => {
    try {
      const { aspId, aspCode, setParanoidFalse } = req.query;
      //IF SET PARANOID FALSE VALUE IS TRUE THEN ALLOW TO GET INACTIVE ASP OTHERWISE ALLOW TO GET ONLY ACTIVE ASP
      const paranoid = setParanoidFalse == "true" ? false : true;

      let asp = null;

      // If aspCode is provided, find by code; otherwise find by ID
      if (aspCode) {
        const whereClause: any = { code: aspCode };
        asp = await Asp.findOne({ where: whereClause, paranoid: paranoid });
      } else if (aspId) {
        asp = await Asp.findByPk(aspId, { paranoid: paranoid });
      } else {
        return res.status(200).json({
          success: false,
          error: "ASP ID or ASP Code is required",
        });
      }

      if (!asp) {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      } else {
        const foundAspId = asp.dataValues.id;
        let ownPatrolVehicleData = null;
        let cocoAspTechnicianData = null;
        //IF COCO ASP
        if (asp.dataValues.isOwnPatrol == 1) {
          const ownPatrolVehicle = await OwnPatrolVehicle.findOne({
            attributes: ["id", "vehicleRegistrationNumber"],
            where: {
              aspId: foundAspId,
            },
          });
          ownPatrolVehicleData = ownPatrolVehicle;

          const cocoAspTechnician = await AspMechanic.findOne({
            attributes: ["id", "name"],
            where: {
              aspId: foundAspId,
              aspTypeId: 771, //COCO
            },
          });
          cocoAspTechnicianData = cocoAspTechnician;
        }

        return res.status(200).json({
          success: true,
          message: "ASP found",
          data: asp,
          ownPatrolVehicleData: ownPatrolVehicleData,
          cocoAspTechnicianData: cocoAspTechnicianData,
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
      const { aspId } = req.query;
      let aspData = null;
      let userData = null;
      let financeAdminWhereClause: any = {
        isFinanceAdmin: 1,
      };

      if (aspId) {
        const aspExists: any = await Asp.findOne({
          where: {
            id: aspId,
          },
          include: [
            // {
            //   model: AspMechanic,
            //   required: false,
            //   paranoid: false,
            // },
            {
              model: City,
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
          ],
          paranoid: false,
        });

        if (!aspExists) {
          return res.status(200).json({
            success: false,
            error: "ASP not found",
          });
        }

        //GET ASP USER DETAILS
        const getEntityUser: any = await axios.get(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=142&entityId=${aspId}`
        );

        // if (aspExists.aspMechanics.length > 0) {
        //   for (const aspMechanic of aspExists.aspMechanics) {
        //     //GET ASP MECHANIC USER DETAILS
        //     const getEntityUser: any = await axios.get(
        //       `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=143&entityId=${aspMechanic.dataValues.id}`
        //     );
        //     if (!getEntityUser.data.success) {
        //       return res.status(200).json({
        //         success: false,
        //         error: getEntityUser.data.error,
        //       });
        //     }
        //     const aspMechanicUserData = getEntityUser.data.data;
        //     aspMechanic.dataValues.status = aspMechanic.dataValues.deletedAt
        //       ? 0
        //       : 1;
        //     aspMechanic.dataValues.userName = aspMechanicUserData.userName;
        //     aspMechanic.dataValues.user = {
        //       id: aspMechanicUserData.id,
        //       roleId: aspMechanicUserData.roleId,
        //       userName: aspMechanicUserData.userName,
        //     };
        //   }
        // }

        aspData = aspExists;
        userData = getEntityUser.data.success ? getEntityUser.data.data : null;

        financeAdminWhereClause.id = {
          [Op.ne]: aspId,
        };
      }

      //EXTRAS
      const [
        getServiceRegionalManagers,
        states,
        salutations,
        workingHours,
        performances,
        priorities,
        tiers,
        financeAdminList,
      ]: any = await Promise.all([
        axios.get(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getList}?apiType=dropdown&roleId=6`
        ),
        State.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Config.findAll({
          where: {
            typeId: 9, //SALUTATIONS
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Config.findAll({
          where: {
            typeId: 10, //WORKING HOURS
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Config.findAll({
          where: {
            typeId: 24, //PERFORMANCES
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Config.findAll({
          where: {
            typeId: 25, //PRIORITIES
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Config.findAll({
          where: {
            typeId: 29, //TIERS
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Asp.findAll({
          attributes: [
            "id",
            [Sequelize.literal('CONCAT(code, " - ", workshopName)'), "code"],
          ],
          where: financeAdminWhereClause,
        }),
      ]);

      if (!getServiceRegionalManagers.data.success) {
        return res.status(200).json(getServiceRegionalManagers.data);
      }
      const serviceRegionalManagers = getServiceRegionalManagers.data.data;

      let user = null;
      if (userData) {
        user = {
          id: userData.id,
          roleId: userData.roleId,
          userName: userData.userName,
        };
      }

      let asp = null;
      if (aspData) {
        const { isOwnPatrol, hasMechanic, isFinanceAdmin, ...restAspData } =
          aspData.dataValues;
        asp = {
          ...restAspData,
          isOwnPatrol: isOwnPatrol ? 1 : 0,
          hasMechanic: hasMechanic ? 1 : 0,
          isFinanceAdmin: isFinanceAdmin ? 1 : 0,
          status: restAspData.deletedAt ? 0 : 1,
          userName: userData ? userData.userName : null,
          user: user,
        };
      }

      const data = {
        extras: {
          states,
          salutations,
          workingHours,
          performances,
          priorities,
          serviceRegionalManagers,
          tiers,
          financeAdminList,
        },
        asp: asp,
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

  saveAndUpdate = async (req: Request, res: Response) => {
    return save(req, res);
  };

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        status: "required|numeric",
        aspIds: "required|array",
        "aspIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { aspIds, status, updatedById, deletedById } = payload;
      if (aspIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one ASP",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      const aspEntityIds = [];
      for (const aspId of aspIds) {
        const aspExists: any = await Asp.findOne({
          attributes: [
            "id",
            "isOwnPatrol",
            "hasMechanic",
            "isFinanceAdmin",
            "financeAdminId",
          ],
          where: {
            id: aspId,
          },
          include: {
            model: AspMechanic,
            required: false,
            paranoid: false,
          },
          paranoid: false,
        });
        if (!aspExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `ASP (${aspId}) not found`,
          });
        }

        const cocoVehicleHelper = await OwnPatrolVehicleHelper.findOne({
          attributes: ["id", "ownPatrolVehicleId"],
          paranoid: false,
          include: {
            model: OwnPatrolVehicle,
            as: "ownPatrolVehicle",
            where: {
              aspId: aspId,
            },
            required: true,
            paranoid: false,
          },
        });

        //If coco asp has technician or helper assigned then inactive is not possible
        if (
          (aspExists.dataValues.isOwnPatrol == 1 &&
            status == 0 &&
            aspExists.aspMechanics &&
            aspExists.aspMechanics.length > 0) ||
          (status == 0 && cocoVehicleHelper)
        ) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `ASP (${aspId}) : It’s not possible to inactive the ASP at the moment because the technician / helper is on shift`,
          });
        }

        await Asp.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: aspId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );

        //If 3rd party asp means, we need to update asp mechanics and its user details.
        if (
          !aspExists.dataValues.isOwnPatrol &&
          aspExists.dataValues.hasMechanic == 1
        ) {
          if (aspExists.aspMechanics.length > 0) {
            const aspMechanicIds = aspExists.aspMechanics.map(
              (aspMechanic: any) => aspMechanic.dataValues.id
            );

            await AspMechanic.update(
              {
                updatedById,
                deletedById,
                deletedAt,
              },
              {
                where: {
                  id: {
                    [Op.in]: aspMechanicIds,
                  },
                },
                paranoid: false,
                transaction: transaction,
              }
            );

            //GET ASP MECHANIC USER DETAILS
            const getAllAspMechanicEntityUsers: any = await axios.post(
              `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
              {
                userTypeId: 143, //ASP MECHANIC
                entityIds: aspMechanicIds,
              }
            );
            if (!getAllAspMechanicEntityUsers.data.success) {
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: getAllAspMechanicEntityUsers.data.error,
              });
            }
            const entityAspMechanicUserIds =
              getAllAspMechanicEntityUsers.data.data.map(
                (entityUser: any) => entityUser.id
              );

            //UPDATE ASP MECHANIC STATUS IN USER
            const entityAspMechanicUserUpdateStatus: any = await axios.put(
              `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.updateStatus}`,
              {
                userIds: entityAspMechanicUserIds,
                status: status,
                updatedById,
                deletedById,
              }
            );
            if (!entityAspMechanicUserUpdateStatus.data.success) {
              await transaction.rollback();
              return res
                .status(200)
                .json(entityAspMechanicUserUpdateStatus.data);
            }
          }
        }

        const ownPatrolVehicleUpdate: any = {};
        ownPatrolVehicleUpdate.updatedById = updatedById;
        ownPatrolVehicleUpdate.deletedById = deletedById;
        ownPatrolVehicleUpdate.deletedAt = deletedAt;
        if (status == 1) {
          //ACTIVE
          ownPatrolVehicleUpdate.inActiveReason = null;
          ownPatrolVehicleUpdate.inActiveFromDate = null;
          ownPatrolVehicleUpdate.inActiveToDate = null;
          ownPatrolVehicleUpdate.isActiveReminderSent = 0;
        }

        //If coco asp have coco vehicle then update inactive or active to coco vehicle.
        await OwnPatrolVehicle.update(ownPatrolVehicleUpdate, {
          where: {
            aspId: aspId,
          },
          paranoid: false,
          transaction: transaction,
        });

        // USER HAS LOGIN ONLY FOR THE THIRD PARTY ASP WHICH IS FINANCE ADMIN OR IF THE ASP IS NOT FINANCE ADMIN AND FINANCE ADMIN USER IS NOT MAPPED
        if (
          !aspExists.dataValues.isOwnPatrol &&
          (aspExists.dataValues.isFinanceAdmin ||
            (!aspExists.dataValues.isFinanceAdmin &&
              !aspExists.dataValues.financeAdminId))
        ) {
          aspEntityIds.push(aspId);
        }
      }

      if (aspEntityIds.length > 0) {
        //GET ASP USER DETAILS
        const getAllAspEntityUsers: any = await axios.post(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
          {
            userTypeId: 142, //ASP
            entityIds: aspEntityIds,
          }
        );
        if (!getAllAspEntityUsers.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: getAllAspEntityUsers.data.error,
          });
        }
        const entityAspUserIds = getAllAspEntityUsers.data.data.map(
          (entityUser: any) => entityUser.id
        );

        //UPDATE ASP STATUS IN USER
        const entityAspUserUpdateStatus: any = await axios.put(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.updateStatus}`,
          {
            userIds: entityAspUserIds,
            status: status,
            updatedById,
            deletedById,
          }
        );
        if (!entityAspUserUpdateStatus.data.success) {
          await transaction.rollback();
          return res.status(200).json(entityAspUserUpdateStatus.data);
        }
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ASP status updated successfully",
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
        aspIds: "required|array",
        "aspIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { aspIds } = payload;
      if (aspIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one ASP",
        });
      }

      const aspEntityIds = [];
      for (const aspId of aspIds) {
        const aspExists: any = await Asp.findOne({
          attributes: [
            "id",
            "isOwnPatrol",
            "hasMechanic",
            "isFinanceAdmin",
            "financeAdminId",
          ],
          where: {
            id: aspId,
          },
          include: {
            model: AspMechanic,
            required: false,
            paranoid: false,
          },
          paranoid: false,
        });
        if (!aspExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `ASP (${aspId}) not found`,
          });
        }

        const cocoVehicleHelper = await OwnPatrolVehicleHelper.findOne({
          attributes: ["id", "ownPatrolVehicleId"],
          paranoid: false,
          include: {
            model: OwnPatrolVehicle,
            as: "ownPatrolVehicle",
            where: {
              aspId: aspId,
            },
            required: true,
            paranoid: false,
          },
        });

        //If coco asp has technician or helper assigned then force delete is not possible
        if (
          (aspExists.dataValues.isOwnPatrol == 1 &&
            aspExists.aspMechanics &&
            aspExists.aspMechanics.length > 0) ||
          cocoVehicleHelper
        ) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `ASP (${aspId}) : It’s not possible to delete the ASP at the moment because the technician / helper is on shift`,
          });
        }

        await Asp.destroy({
          where: {
            id: aspId,
          },
          force: true,
          transaction: transaction,
        });

        //If 3rd party asp means, we need to force delete asp mechanics and its user details.
        if (
          !aspExists.dataValues.isOwnPatrol &&
          aspExists.dataValues.hasMechanic == 1
        ) {
          if (aspExists.aspMechanics.length > 0) {
            const aspMechanicIds = aspExists.aspMechanics.map(
              (aspMechanic: any) => aspMechanic.dataValues.id
            );

            await AspMechanic.destroy({
              where: {
                id: {
                  [Op.in]: aspMechanicIds,
                },
              },
              force: true,
              transaction: transaction,
            });

            //GET ASP MECHANIC USER DETAILS
            const getAllAspMechanicEntityUsers: any = await axios.post(
              `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
              {
                userTypeId: 143, //ASP MECHANIC
                entityIds: aspMechanicIds,
              }
            );
            if (!getAllAspMechanicEntityUsers.data.success) {
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: getAllAspMechanicEntityUsers.data.error,
              });
            }
            const entityAspMechanicUserIds =
              getAllAspMechanicEntityUsers.data.data.map(
                (entityUser: any) => entityUser.id
              );

            //DELETE ASP MECHANICS IN USER
            const entityAspMechanicUserDelete: any = await axios.put(
              `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.delete}`,
              {
                userIds: entityAspMechanicUserIds,
              }
            );
            if (!entityAspMechanicUserDelete.data.success) {
              await transaction.rollback();
              return res.status(200).json(entityAspMechanicUserDelete.data);
            }
          }
        }

        // USER HAS LOGIN ONLY FOR THE THIRD PARTY ASP WHICH IS FINANCE ADMIN OR IF THE ASP IS NOT FINANCE ADMIN AND FINANCE ADMIN USER IS NOT MAPPED
        if (
          !aspExists.dataValues.isOwnPatrol &&
          (aspExists.dataValues.isFinanceAdmin ||
            (!aspExists.dataValues.isFinanceAdmin &&
              !aspExists.dataValues.financeAdminId))
        ) {
          aspEntityIds.push(aspId);
        }
      }

      if (aspEntityIds.length > 0) {
        //GET ASP USER DETAILS
        const getAllAspEntityUsers: any = await axios.post(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
          {
            userTypeId: 142, //ASP
            entityIds: aspEntityIds,
          }
        );
        if (!getAllAspEntityUsers.data.success) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: getAllAspEntityUsers.data.error,
          });
        }
        const entityAspUserIds = getAllAspEntityUsers.data.data.map(
          (entityUser: any) => entityUser.id
        );

        //DELETE ASP IN USER
        const entityAspUserDelete: any = await axios.put(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.delete}`,
          {
            userIds: entityAspUserIds,
          }
        );
        if (!entityAspUserDelete.data.success) {
          await transaction.rollback();
          return res.status(200).json(entityAspUserDelete.data);
        }
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ASP deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getViewData = async (req: Request, res: Response) => {
    try {
      const { aspId } = req.query;
      if (!aspId) {
        return res.status(200).json({
          success: false,
          error: "ASP ID is required",
        });
      }
      const asp: any = await Asp.findOne({
        where: {
          id: aspId,
        },
        attributes: [
          "id",
          [Sequelize.literal("( SELECT tier.name)"), "tierName"],
          "axaptaCode",
          [Sequelize.literal("( SELECT salutation.name)"), "salutationName"],
          [Sequelize.literal("( SELECT workingHour.name)"), "workingHourName"],
          "code",
          "name",
          "workShopName",
          "email",
          "whatsAppNumber",
          "contactNumber",
          [Sequelize.literal("( SELECT performance.name)"), "performanceName"],
          [Sequelize.literal("( SELECT priority.name)"), "priorityName"],
          [
            Sequelize.literal(
              "( SELECT IF (asp.isOwnPatrol = 1, 'Yes', 'No') )"
            ),
            "isOwnPatrol",
          ],
          "latitude",
          "longitude",
          "addressLineOne",
          "addressLineTwo",
          [Sequelize.literal("( SELECT state.name)"), "stateName"],
          [Sequelize.literal("( SELECT city.name)"), "cityName"],
          "location",
          "pincode",
          [
            Sequelize.literal(
              "( SELECT IF (asp.hasMechanic = 1, 'Yes', 'No') )"
            ),
            "hasMechanic",
          ],
          [
            Sequelize.literal("( SELECT financeAdmin.code)"),
            "financeAdminCode",
          ],
          [
            Sequelize.literal(
              "( SELECT IF (asp.isFinanceAdmin = 1, 'Yes', 'No') )"
            ),
            "isFinanceAdmin",
          ],
          [
            Sequelize.literal(
              "( SELECT DATE_FORMAT(asp.createdAt,'%d/%m/%Y %h:%i %p') )"
            ),
            "createdAt",
          ],
          [
            Sequelize.literal(
              "( SELECT IF (asp.deletedAt IS NULL, 'Active', 'Inactive') )"
            ),
            "status",
          ],
          "rmId",
        ],
        include: [
          {
            model: Config,
            as: "tier",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: Config,
            as: "salutation",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: Config,
            as: "workingHour",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: Config,
            as: "performance",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: Config,
            as: "priority",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: State,
            required: false,
            attributes: ["id", "name"],
            paranoid: false,
          },
          {
            model: City,
            required: false,
            attributes: ["id", "name"],
            paranoid: false,
          },
          {
            model: Asp,
            as: "financeAdmin",
            required: false,
            attributes: ["id", "code"],
            paranoid: false,
          },
        ],
        paranoid: false,
      });
      if (!asp) {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      // GET REGIONAL MANAGER DETAILS
      const getRmDetail = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.getUser}`,
        {
          id: asp.dataValues.rmId,
        }
      );

      asp.dataValues.rmName = getRmDetail.data.success
        ? getRmDetail.data.user.name
        : null;
      asp.dataValues.rmContactNumber = getRmDetail.data.success
        ? getRmDetail.data.user.mobileNumber
        : null;

      //ASP MECHANICS
      const aspMechanics = await AspMechanic.findAll({
        where: {
          aspId: asp.dataValues.id,
        },
        attributes: [
          "id",
          "name",
          "code",
          "email",
          "contactNumber",
          "alternateContactNumber",
          "latitude",
          "longitude",
          [Sequelize.literal("( SELECT performance.name)"), "performanceName"],
          [Sequelize.literal("( SELECT priority.name)"), "priorityName"],
          "address",
          [
            Sequelize.literal(
              "( SELECT DATE_FORMAT(aspMechanic.createdAt,'%d/%m/%Y %h:%i %p') )"
            ),
            "createdAt",
          ],
          [
            Sequelize.literal(
              "( SELECT IF (aspMechanic.deletedAt IS NULL, 'Active', 'Inactive') )"
            ),
            "status",
          ],
        ],
        include: [
          {
            model: Config,
            as: "performance",
            attributes: ["id", "name"],
            required: false,
          },
          {
            model: Config,
            as: "priority",
            attributes: ["id", "name"],
            required: false,
          },
        ],
        paranoid: false,
      });

      const data = {
        asp: asp,
        aspMechanics: aspMechanics,
      };

      return res.status(200).json({
        success: true,
        message: "ASP data fetched successfully",
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  //Asp data Export;
  public async aspDataExport(req: any, res: any) {
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

      const AspData = await Asp.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!AspData || AspData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let aspDetailsArray: any[] = [];

      const rmIds = [...new Set(AspData.map((aspData: any) => aspData.rmId))];
      const aspIds = [...new Set(AspData.map((aspData: any) => aspData.id))];
      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          rmIds: rmIds,
          aspIds: aspIds,
        }
      );

      let regionalManagers = [];
      let aspUsers = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        regionalManagers = getUserDetails.data.data.regionalManagers;
        aspUsers = getUserDetails.data.data.aspUsers;
      }

      for (const aspData of AspData) {
        const [
          tier,
          salutation,
          workingHour,
          performance,
          priority,
          state,
          city,
          financeAdmin,
        ] = await Promise.all([
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspData.dataValues.tierId },
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspData.dataValues.salutationId },
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspData.dataValues.workingHourId },
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspData.dataValues.performanceId },
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspData.dataValues.priorityId },
          }),
          State.findOne({
            attributes: ["id", "name"],
            where: { id: aspData.dataValues.stateId },
            paranoid: false,
          }),
          City.findOne({
            attributes: ["id", "name"],
            where: { id: aspData.dataValues.cityId },
            paranoid: false,
          }),
          Asp.findOne({
            attributes: ["id", "code"],
            where: {
              id: aspData.dataValues.financeAdminId,
            },
            paranoid: false,
          }),
        ]);

        const regionalManager = regionalManagers.find(
          (regionalManager: any) =>
            regionalManager.id == aspData.dataValues.rmId
        );
        const aspUser = aspUsers.find(
          (aspUser: any) => aspUser.entityId == aspData.dataValues.id
        );

        const aspDetails = {
          Tier: tier?.dataValues.name || null,
          "Axapta Code": aspData.dataValues.axaptaCode,
          Salutation: salutation?.dataValues.name || null,
          Name: aspData.dataValues.name,
          "ASP Code": aspData.dataValues.code,
          "Workshop Name": aspData.dataValues.workshopName,
          Email: aspData.dataValues.email,
          "WhatsApp Number": aspData.dataValues.whatsAppNumber,
          "Contact Number": aspData.dataValues.contactNumber,
          "Working Hours": workingHour?.dataValues.name || null,
          Performance: performance?.dataValues.name || null,
          Priority: priority?.dataValues.name || null,
          "Regional Manager": regionalManager?.name || null,
          "Regional Manager Mobile Number":
            regionalManager?.mobileNumber || null,
          "Own Patrol": aspData.dataValues.isOwnPatrol == 1 ? "Yes" : "No",
          "Has Mechanic": aspData.dataValues.hasMechanic == 1 ? "Yes" : "No",
          "Is Finance Admin":
            aspData.dataValues.isFinanceAdmin == 1 ? "Yes" : "No",
          "Finance Admin Code": financeAdmin?.dataValues.code || null,
          Username: aspUser?.userName || null,
          "Address Line One": aspData.dataValues.addressLineOne,
          "Address Line Two": aspData.dataValues.addressLineTwo,
          State: state?.dataValues.name || null,
          City: city?.dataValues.name || null,
          Pincode: aspData.dataValues.pincode,
          Location: aspData.dataValues.location,
          Latitude: aspData.dataValues.latitude,
          Longitude: aspData.dataValues.longitude,
          "Created At": moment
            .tz(aspData.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: aspData.dataValues.deletedAt ? "Inactive" : "Active",
        };
        aspDetailsArray.push(aspDetails);
      }

      // Column Filter;
      const AspColumnNames = aspDetailsArray
        ? Object.keys(aspDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          aspDetailsArray,
          AspColumnNames,
          format,
          "AspDetails"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(aspDetailsArray, AspColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Asp data export successfully`,
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

  public async aspDataImport(req: any, res: any) {
    try {
      const inData: any[] = req.body.jsonDataArray;
      const aspErrorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      // let aspImportColumns = [
      //   "Tier",
      //   "Axapta Code",
      //   "Salutation",
      //   "Name",
      //   "ASP Code",
      //   "Workshop Name",
      //   "Email",
      //   "WhatsApp Number",
      //   "Contact Number",
      //   "Working Hours",
      //   "Performance",
      //   "Priority",
      //   "Regional Manager User Name",
      //   "Own Patrol",
      //   "Has Mechanic",
      //   "Username",
      //   "Password",
      //   "Change Password",
      //   "Status",
      //   "Address Line One",
      //   "Address Line Two",
      //   "State",
      //   "City",
      //   "Pincode",
      //   "Location",
      //   "Latitude",
      //   "Longitude",
      // ];

      const importColumnsResponse = await Utils.getExcelImportColumns(1094);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let aspImportColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1094,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      //GET all asp user details
      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          roleIds: [4, 6],
        }
      );
      let aspUserDetails = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        aspUserDetails = getUserDetails.data.data.roleUserDetails;
      }

      const aspSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const aspSheet of aspSheets) {
        aspImportColumns.forEach((importColumn: any) => {
          if (!aspSheet.hasOwnProperty(importColumn)) {
            aspSheet[importColumn] = "";
          }
        });

        let reArrangedAsps: any = {
          Tier: aspSheet["Tier"] ? String(aspSheet["Tier"]) : null,
          "Axapta Code": aspSheet["Axapta Code"]
            ? String(aspSheet["Axapta Code"])
            : null,
          Salutation: aspSheet["Salutation"]
            ? String(aspSheet["Salutation"])
            : null,
          Name: aspSheet["Name"],
          "ASP Code": aspSheet["ASP Code"]
            ? String(aspSheet["ASP Code"])
            : null,
          "Workshop Name": aspSheet["Workshop Name"],
          Email: aspSheet["Email"],
          "WhatsApp Number": aspSheet["WhatsApp Number"]
            ? String(aspSheet["WhatsApp Number"])
            : null,
          "Contact Number": aspSheet["Contact Number"]
            ? String(aspSheet["Contact Number"])
            : null,
          "Working Hours": aspSheet["Working Hours"]
            ? String(aspSheet["Working Hours"])
            : null,
          Performance: aspSheet["Performance"]
            ? String(aspSheet["Performance"])
            : null,
          Priority: aspSheet["Priority"] ? String(aspSheet["Priority"]) : null,
          "Regional Manager User Name": aspSheet["Regional Manager User Name"]
            ? String(aspSheet["Regional Manager User Name"])
            : null,
          "Own Patrol": aspSheet["Own Patrol"]
            ? String(aspSheet["Own Patrol"])
            : null,
          "Has Mechanic": aspSheet["Has Mechanic"]
            ? String(aspSheet["Has Mechanic"])
            : null,
          "Is Finance Admin": aspSheet["Is Finance Admin"]
            ? String(aspSheet["Is Finance Admin"])
            : null,
          "Finance Admin Code": aspSheet["Finance Admin Code"]
            ? String(aspSheet["Finance Admin Code"])
            : null,
          Username: aspSheet["Username"] ? String(aspSheet["Username"]) : null,
          Password: aspSheet["Password"] ? String(aspSheet["Password"]) : null,
          "Change Password": aspSheet["Change Password"]
            ? String(aspSheet["Change Password"])
            : null,
          Status: aspSheet["Status"] ? String(aspSheet["Status"]) : null,
          "Address Line One": aspSheet["Address Line One"]
            ? String(aspSheet["Address Line One"])
            : null,
          "Address Line Two": aspSheet["Address Line Two"]
            ? String(aspSheet["Address Line Two"])
            : null,
          State: aspSheet["State"] ? String(aspSheet["State"]) : null,
          City: aspSheet["City"] ? String(aspSheet["City"]) : null,
          Pincode: aspSheet["Pincode"] ? String(aspSheet["Pincode"]) : null,
          Location: aspSheet["Location"] ? String(aspSheet["Location"]) : null,
          Latitude: aspSheet["Latitude"] ? String(aspSheet["Latitude"]) : null,
          Longitude: aspSheet["Longitude"]
            ? String(aspSheet["Longitude"])
            : null,
        };

        if (aspSheet["ASP Code"]) {
          const record: any = {};
          const keyMapping: any = {
            tier: "tierId",
            salutation: "salutationId",
            aSPCode: "code",
            workingHours: "workingHourId",
            performance: "performanceId",
            priority: "priorityId",
            ownPatrol: "isOwnPatrol",
            username: "userName",
            state: "stateId",
            city: "cityId",
          };

          for (const key in reArrangedAsps) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedAsps[key];
          }

          //VALIDATIONS
          const validationErrors = [];
          if (
            record.whatsAppNumber &&
            !/^[0-9]{10}$/.test(record.whatsAppNumber)
          ) {
            validationErrors.push("Invalid whatsapp number.");
          }

          if (
            record.contactNumber &&
            !/^[0-9]{10}$/.test(record.contactNumber)
          ) {
            validationErrors.push("Invalid contact number.");
          }

          if (!record.isOwnPatrol) {
            validationErrors.push("Own patrol value is required.");
          } else {
            if (!["Yes", "No"].includes(record.isOwnPatrol)) {
              validationErrors.push("Own patrol value should be Yes or No.");
            }
          }

          if (record.isOwnPatrol == "No") {
            if (!record.hasMechanic) {
              validationErrors.push("Has mechanic value is required.");
            } else {
              if (!["Yes", "No"].includes(record.hasMechanic)) {
                validationErrors.push(
                  "Has mechanic value should be Yes or No."
                );
              }
            }
          }

          if (
            record.isFinanceAdmin &&
            !["Yes", "No"].includes(record.isFinanceAdmin)
          ) {
            validationErrors.push(
              "Is finance admin value should be Yes or No."
            );
          }

          if (
            record.changePassword &&
            !["Yes", "No"].includes(record.changePassword)
          ) {
            validationErrors.push("Change password value should be Yes or No.");
          }

          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          if (record.pincode && !/^\d{6}$/.test(record.pincode)) {
            validationErrors.push("Invalid pincode.");
          }

          if (record.latitude && !/^-?\d+(\.\d+)?$/.test(record.latitude)) {
            validationErrors.push("Invalid latitude.");
          }

          if (record.longitude && !/^-?\d+(\.\d+)?$/.test(record.longitude)) {
            validationErrors.push("Invalid longitude.");
          }

          if (validationErrors.length > 0) {
            aspErrorData.push({
              ...reArrangedAsps,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //ASP
          let aspId = null;
          let userId = null;
          if (record.code) {
            const trimmedCode = record.code.trim();
            const aspAlreadyExists = await Asp.findOne({
              where: {
                code: trimmedCode,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (aspAlreadyExists) {
              aspId = aspAlreadyExists.dataValues.id;

              //USER
              const aspUserDetail = aspUserDetails.find(
                (aspUserDetail: any) =>
                  aspUserDetail.entityId == aspAlreadyExists.dataValues.id &&
                  aspUserDetail.roleId == 4
              );

              if (aspUserDetail) {
                userId = aspUserDetail.id;
              }
            }
          }

          //RM
          let rmId = 0;
          if (record.regionalManagerUserName) {
            const trimmedRmUserName = record.regionalManagerUserName.trim();
            const rmDetail = aspUserDetails.find(
              (aspUserDetail: any) =>
                aspUserDetail.userName == trimmedRmUserName &&
                aspUserDetail.roleId == 6
            );

            if (rmDetail) {
              rmId = rmDetail.id;
            }
          }

          //PERFORMANCE
          let performanceName: any = null;
          if (record.performanceId) {
            const trimmedPerformanceName = record.performanceId.trim();
            performanceName = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedPerformanceName,
                typeId: 24, //ASP PERFORMANCES
              },
            });
          }
          const performanceId = performanceName
            ? performanceName.dataValues.id
            : 0;

          //PRIORITY
          let priorityName: any = null;
          if (record.priorityId) {
            const trimmedPriorityName = record.priorityId.trim();
            priorityName = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedPriorityName,
                typeId: 25, //ASP PRIORITIES
              },
            });
          }
          const priorityId = priorityName ? priorityName.dataValues.id : 0;

          //TIER
          let tierName: any = null;
          if (record.tierId) {
            const trimmedTierName = record.tierId.trim();
            tierName = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedTierName,
                typeId: 29, //ASP TIERS
              },
            });
          }
          const tierId = tierName ? tierName.dataValues.id : 0;

          //Salutation
          let salutationName: any = null;
          if (record.salutationId) {
            const trimmedSalutationName = record.salutationId.trim();
            salutationName = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedSalutationName,
                typeId: 9, //Salutations
              },
            });
          }
          const salutationId = salutationName
            ? salutationName.dataValues.id
            : 0;

          //Working Hours
          let workingHourName: any = null;
          if (record.workingHourId) {
            const trimmedWorkingHourName = record.workingHourId.trim();
            workingHourName = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedWorkingHourName,
                typeId: 10, //ASP Working Hours
              },
            });
          }
          const workingHourId = workingHourName
            ? workingHourName.dataValues.id
            : 0;

          //STATE
          let stateName: any = null;
          if (record.stateId) {
            const trimmedStateName = record.stateId.trim();
            stateName = await State.findOne({
              attributes: ["id", "name"],
              where: { name: trimmedStateName },
              paranoid: false,
            });
          }
          const stateId = stateName ? stateName.dataValues.id : 0;

          //CITY
          let cityName: any = null;
          if (stateId && record.cityId) {
            const trimmedCityName = record.cityId.trim();
            cityName = await City.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedCityName,
                stateId: stateId,
              },
              paranoid: false,
            });
          }
          const cityId = cityName ? cityName.dataValues.id : 0;

          //Finance admin
          let financeAdminId = null;
          if (record.financeAdminCode) {
            const trimmedFinanceAdminCode = record.financeAdminCode.trim();

            const financeAdminDetail: any = await Asp.findOne({
              attributes: ["id"],
              where: {
                code: trimmedFinanceAdminCode,
              },
              paranoid: false,
            });

            if (financeAdminDetail) {
              financeAdminId = financeAdminDetail.id;
            }
          }

          record.aspId = aspId;
          record.userId = userId;
          record.tierId = tierId;
          record.salutationId = salutationId;
          record.workingHourId = workingHourId;
          record.performanceId = performanceId;
          record.priorityId = priorityId;
          record.rmId = rmId;
          record.businessHourId = null; //doubt
          record.isOwnPatrol =
            record.isOwnPatrol &&
              record.isOwnPatrol.trim().toLowerCase() === "yes"
              ? 1
              : 0;
          record.hasMechanic =
            record.hasMechanic &&
              record.hasMechanic.trim().toLowerCase() === "yes"
              ? 1
              : 0;
          record.isFinanceAdmin =
            record.isFinanceAdmin &&
              record.isFinanceAdmin.trim().toLowerCase() === "yes"
              ? 1
              : 0;
          record.financeAdminId = financeAdminId;
          record.changePassword =
            record.changePassword &&
              record.changePassword.trim().toLowerCase() === "yes"
              ? 1
              : 0;

          record.stateId = stateId;
          record.cityId = cityId;
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
            if (output.type == "asp") {
              aspErrorData.push({
                ...reArrangedAsps,
                Error: output.errors ? output.errors.join(",") : output.error,
              });
            }
          } else {
            if (output.message === "ASP created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          aspErrorData.push({
            ...reArrangedAsps,
            Error: "ASP Code is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New ASP created successfully (${newRecordsCreated} records) and existing ASP updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New ASP created successfully (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing ASP updated (${existingRecordsUpdated} records)`
              : "No ASP created or updated";

      if (aspErrorData.length === 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Error Buffer Generation;
      aspImportColumns.push("Error");

      const buffer = generateXLSXAndXLSExport(
        aspErrorData,
        aspImportColumns,
        "xlsx",
        "AspDetails"
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

  sync = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        aspPortalId: "required|numeric",
        tierName: "required|string",
        axaptaCode: "required|string|maxLength:60",
        salutationName: "required|string",
        name: "required|string|minLength:3|maxLength:255",
        aspCode: "required|string|minLength:3|maxLength:60",
        workshopName: "required|string|minLength:3|maxLength:255",
        email: "nullable|email",
        whatsappNumber: "string|minLength:10|maxLength:10",
        contactNumber: "required|string|minLength:10|maxLength:10",
        workingHourName: "required|string",
        performanceName: "required|string",
        priority: "required|numeric",
        regionalManagerName: "nullable|string",
        regionalManagerUsername: "nullable|string",
        workshopType: "required|numeric",
        isFinanceAdmin: "nullable|numeric",
        financeAdminCode: "nullable|string",
        addressLineOne: "required|string",
        addressLineTwo: "nullable|string",
        stateName: "required|string",
        location: "required|string|minLength:3|maxLength:255",
        zipCode: "required|string|minLength:6|maxLength:6",
        lat: "required|string|maxLength:60",
        long: "required|string|maxLength:60",
        status: "required|numeric",
        deletedAt: "nullable|string",

        aspServiceTypes: "required|array",
        aspClients: "required|array",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      // Map field names from ELK to CRM format
      const subServiceDetails = payload.aspServiceTypes || [];
      const clientDetails = payload.aspClients || [];

      const trimmedTierName = String(payload.tierName).trim();
      const trimmedSalutationName = String(payload.salutationName).trim();
      const trimmedWorkingHourName = String(payload.workingHourName).trim();
      const trimmedPerformanceName = String(payload.performanceName).trim();
      const trimmedPriority = String(payload.priority).trim();
      const trimmedStateName = String(payload.stateName).trim();
      const trimmedFinanceAdminCode = String(payload.financeAdminCode).trim();
      const trimmedRegionalManagerUsername = payload.regionalManagerUsername
        ? String(payload.regionalManagerUsername).trim()
        : null;

      const [
        getAspRoleDetail,
        tier,
        salutation,
        workingHour,
        performance,
        priority,
        state,
        financeAdminDetail,
        getRmByUsername,
      ]: any = await Promise.all([
        axios.get(
          `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=ASP`
        ),
        Config.findOne({
          attributes: ["id"],
          where: {
            name: trimmedTierName,
            typeId: 29, //ASP TIERS
          },
        }),
        Config.findOne({
          attributes: ["id"],
          where: {
            name: trimmedSalutationName,
            typeId: 9, //SALUTATIONS
          },
        }),
        Config.findOne({
          attributes: ["id"],
          where: {
            name: trimmedWorkingHourName,
            typeId: 10, //WORKING HOURS
          },
        }),
        Config.findOne({
          attributes: ["id"],
          where: {
            name: trimmedPerformanceName,
            typeId: 24, //ASP PERFORMANCES
          },
        }),
        Config.findOne({
          attributes: ["id"],
          where: {
            name: trimmedPriority,
            typeId: 25, //ASP PRIORITIES
          },
        }),
        State.findOne({
          attributes: ["id"],
          where: {
            name: trimmedStateName,
            countryId: 1,
          },
        }),
        trimmedFinanceAdminCode
          ? Asp.findOne({
            attributes: ["id"],
            where: {
              code: trimmedFinanceAdminCode,
            },
            paranoid: false,
          })
          : Promise.resolve(null),
        trimmedRegionalManagerUsername
          ? axios.post(
            `${userServiceUrl}/user/${userServiceEndpoint.getUserByUserName}`,
            { userName: trimmedRegionalManagerUsername }
          )
          : Promise.resolve(null),
      ]);

      // Extract Regional Manager ID from the result
      let rmId = null;
      if (getRmByUsername?.data?.success && getRmByUsername.data.data) {
        rmId = getRmByUsername.data.data.id;
      }

      if (!getAspRoleDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: getAspRoleDetail.data.error,
        });
      }

      if (!tier) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          message: "Tier not found",
        });
      }

      if (!salutation) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          message: "Salutation not found",
        });
      }

      if (!workingHour) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          message: "Working hour not found",
        });
      }

      if (!performance) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          message: "Performance not found",
        });
      }

      if (!priority) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          message: "Priority not found",
        });
      }

      if (!state) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          message: "State not found",
        });
      }

      // IS FINANCE ADMIN FIELD IS REQUIRED FOR THIRD PARTY ASP
      if (payload.workshopType != 1 && payload.isFinanceAdmin == null) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Is finance admin field is required",
        });
      }

      const aspRoleId = getAspRoleDetail.data.data.id;

      let isOwnPatrol = 0;
      let hasMechanic = 0;
      // IF WORKSHOP TYPE IS OWN PATROL OF TVSAA THEN SET IS_OWN_PATROL TO 1 AND HAS_MECHANIC TO 1
      if (payload.workshopType == 1) {
        isOwnPatrol = 1;
        hasMechanic = 1;
      }

      const businessAdminId = process.env.BUSINESS_ADMIN_ID || 484; //theadmin
      let deletedAt = null;
      let deletedById = null;
      //INACTIVE
      if (payload.status == 0) {
        deletedAt = new Date();
        deletedById = businessAdminId;
      }

      const aspData: any = {
        aspPortalId: payload.aspPortalId,
        tierId: tier.dataValues.id,
        axaptaCode: payload.axaptaCode,
        salutationId: salutation.dataValues.id,
        workingHourId: workingHour.dataValues.id,
        code: String(payload.aspCode).trim(),
        name: payload.name,
        workshopName: payload.workshopName,
        email: payload.email || null,
        whatsAppNumber: String(payload.whatsappNumber),
        contactNumber: String(payload.contactNumber),
        performanceId: performance.dataValues.id,
        priorityId: priority.dataValues.id,
        ...(rmId ? { rmId: rmId } : {}),
        isOwnPatrol: isOwnPatrol,
        hasMechanic: hasMechanic,
        isFinanceAdmin: payload.isFinanceAdmin,
        financeAdminId: financeAdminDetail?.dataValues.id || null,
        latitude: payload.lat,
        longitude: payload.long,
        addressLineOne: payload.addressLineOne,
        addressLineTwo: payload.addressLineTwo,
        stateId: state.dataValues.id,
        location: payload.location,
        pincode: payload.zipCode,
        status: payload.status,
        deletedAt: deletedAt,
        deletedById: deletedById,
      };

      const existingAspData = await Asp.findOne({
        where: {
          code: payload.aspCode,
        },
        attributes: ["id", "isOwnPatrol", "hasMechanic"],
        paranoid: false,
      });

      const aspId = existingAspData?.dataValues.id || null;
      let userEntityId: any;
      let savedAspId: any;
      let userCreatedByOrUpdatedById: any;
      let aspUserId = null;
      if (aspId) {
        const getEntityUser: any = await axios.get(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=142&entityId=${aspId}`
        );
        // COCO ASP USER IS NOT MAPPED IN USER SERVICE SO WE ARE NOT CHECKING THE SUCCESS
        // if (!getEntityUser.data.success) {
        //   await transaction.rollback();
        //   return res.status(200).json({
        //     success: false,
        //     error: getEntityUser.data.error,
        //   });
        // }
        aspUserId = getEntityUser?.data?.data?.id || null;

        // For existing third-party ASPs (isOwnPatrol = 0), preserve hasMechanic value from CRM
        // Don't update it from sync since hasMechanic doesn't exist in ELK database
        if (isOwnPatrol === 0) {
          delete aspData.hasMechanic;
        }

        await Asp.update(aspData, {
          where: {
            id: aspId,
          },
          paranoid: false,
          transaction: transaction,
        });
        userEntityId = aspId;
        savedAspId = aspId;
        userCreatedByOrUpdatedById = {
          updatedById: businessAdminId,
        };
      } else {
        const newAsp = await Asp.create(aspData, {
          transaction: transaction,
        });
        userEntityId = newAsp.dataValues.id;
        savedAspId = newAsp.dataValues.id;
        userCreatedByOrUpdatedById = {
          createdById: businessAdminId,
        };
      }

      const subServiceMappingResponse = await subServiceMapping(
        savedAspId,
        subServiceDetails,
        transaction
      );

      if (!subServiceMappingResponse.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: subServiceMappingResponse.error,
        });
      }

      const clientMappingResponse = await clientMapping(
        savedAspId,
        clientDetails,
        transaction
      );

      if (!clientMappingResponse.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: clientMappingResponse.error,
        });
      }

      let saveAspUser = true;
      //ON EDIT ASP
      if (aspId) {
        const cocoVehicleHelper = await OwnPatrolVehicleHelper.findOne({
          attributes: ["id", "ownPatrolVehicleId"],
          paranoid: false,
          include: {
            model: OwnPatrolVehicle,
            as: "ownPatrolVehicle",
            where: {
              aspId: aspId,
            },
            required: true,
            paranoid: false,
          },
        });

        //If existing coco and current coco then
        //inactive:
        //  1. inactive is not possible if technician or helper is in shift.
        //  2. if technician or helper not in shift then update inactive to asp and coco vehicle.
        //active:
        //  1. update asp active.
        //  2. update coco vehicle active status.
        if (
          existingAspData &&
          existingAspData.dataValues.isOwnPatrol == 1 &&
          aspData.isOwnPatrol == 1
        ) {
          const cocoAspMechanic: any = await AspMechanic.findOne({
            where: { aspId: aspId },
            attributes: ["id"],
            paranoid: false,
          });

          if (aspData.status == 0 && (cocoAspMechanic || cocoVehicleHelper)) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error:
                "It’s not possible to inactive the ASP at the moment because the COCO technician / helper is on shift",
            });
          }

          const ownPatrolVehicleUpdate: any = {};
          ownPatrolVehicleUpdate.updatedById = businessAdminId;
          ownPatrolVehicleUpdate.deletedById = deletedById;
          ownPatrolVehicleUpdate.deletedAt = deletedAt;
          //ACTIVE
          if (aspData.status == 1) {
            ownPatrolVehicleUpdate.inActiveReason = null;
            ownPatrolVehicleUpdate.inActiveFromDate = null;
            ownPatrolVehicleUpdate.inActiveToDate = null;
            ownPatrolVehicleUpdate.isActiveReminderSent = 0;
          }
          await OwnPatrolVehicle.update(ownPatrolVehicleUpdate, {
            where: {
              aspId: aspId,
            },
            paranoid: false,
            transaction: transaction,
          });

          // EXISTING COCO ASP & CURRENT COCO ASP THEN NO NEED TO CREATE USER
          saveAspUser = false;
        }

        //If existing third party and current third party then
        //inactive:
        //  1.update inactive status to asp mechanics.
        //  2.update aspId as null in coco vehicle.
        //active:
        //  1.update active status to asp mechanics.
        //  2.update aspId as null in coco vehicle.
        if (
          existingAspData &&
          !existingAspData.dataValues.isOwnPatrol &&
          !aspData.isOwnPatrol
        ) {
          const thirdPartyAspMechanics: any = await AspMechanic.findAll({
            where: { aspId: aspId },
            attributes: ["id"],
            paranoid: false,
          });
          if (thirdPartyAspMechanics.length > 0) {
            const aspMechanicUpdateStatusResponse =
              await updateStatusForAspMechanics(
                thirdPartyAspMechanics,
                businessAdminId,
                deletedById,
                deletedAt,
                aspData.status,
                transaction
              );
            if (!aspMechanicUpdateStatusResponse.success) {
              await transaction.rollback();
              return res.status(200).json(aspMechanicUpdateStatusResponse);
            }
          }

          //DELETE ASP IN USER
          if (aspUserId && !aspData.isFinanceAdmin && aspData.financeAdminId) {
            const entityAspUserDelete: any = await axios.put(
              `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.delete}`,
              {
                userIds: [aspUserId],
              }
            );
            if (!entityAspUserDelete.data.success) {
              await transaction.rollback();
              return res.status(200).json(entityAspUserDelete.data);
            }
          }
        }

        //IF ASP HAS MECHANIC 0 MEANS, WE NEED TO UPDATE ASP ID TO NULL FOR ASP MECHANICS
        // For third-party ASPs, use existing hasMechanic value from CRM since we preserve it during sync
        // For own patrol ASPs, use the value from sync (which is always 1)
        const hasMechanicValue = isOwnPatrol === 0
          ? existingAspData?.dataValues?.hasMechanic
          : aspData.hasMechanic;
        if (hasMechanicValue == 0) {
          const thirdPartyAspMechanics: any = await AspMechanic.findAll({
            where: { aspId: aspId },
            attributes: ["id"],
            paranoid: false,
          });
          if (thirdPartyAspMechanics.length > 0) {
            const thirdPartyAspMechanicsIds = thirdPartyAspMechanics.map(
              (thirdPartyAspMechanic: any) => thirdPartyAspMechanic.id
            );
            const removeAspIdResponse = await removeAspId(
              thirdPartyAspMechanicsIds,
              transaction
            );
            if (!removeAspIdResponse.success) {
              await transaction.rollback();
              return res.status(200).json(removeAspIdResponse);
            }
          }
        }

        //If existing third party and current coco then
        //inactive:
        //  1.update aspId to null for asp mechanics
        //  2.update inactive to coco vehicle.
        //active:
        //  1.update aspId to null for asp mechanics
        //  2.update active to coco vehicle.
        if (
          existingAspData &&
          !existingAspData.dataValues.isOwnPatrol &&
          aspData.isOwnPatrol == 1
        ) {
          const thirdPartyToOwnPatrolMechanics: any = await AspMechanic.findAll(
            {
              where: { aspId: aspId },
              attributes: ["id"],
              paranoid: false,
            }
          );
          if (thirdPartyToOwnPatrolMechanics.length > 0) {
            const thirdPartyToOwnPatrolMechanicIds =
              thirdPartyToOwnPatrolMechanics.map(
                (thirdPartyToOwnPatrolMechanic: any) =>
                  thirdPartyToOwnPatrolMechanic.id
              );
            const thirdPartyToOwnPatrolAspIdRemoveResponse = await removeAspId(
              thirdPartyToOwnPatrolMechanicIds,
              transaction
            );
            if (!thirdPartyToOwnPatrolAspIdRemoveResponse.success) {
              await transaction.rollback();
              return res
                .status(200)
                .json(thirdPartyToOwnPatrolAspIdRemoveResponse);
            }
          }

          const ownPatrolVehicleUpdate: any = {};
          ownPatrolVehicleUpdate.updatedById = businessAdminId;
          ownPatrolVehicleUpdate.deletedById = deletedById;
          ownPatrolVehicleUpdate.deletedAt = deletedAt;
          //ACTIVE
          if (aspData.status == 1) {
            ownPatrolVehicleUpdate.inActiveReason = null;
            ownPatrolVehicleUpdate.inActiveFromDate = null;
            ownPatrolVehicleUpdate.inActiveToDate = null;
            ownPatrolVehicleUpdate.isActiveReminderSent = 0;
          }

          await OwnPatrolVehicle.update(ownPatrolVehicleUpdate, {
            where: {
              aspId: aspId,
            },
            paranoid: false,
            transaction: transaction,
          });

          // EXISTING THIRD PARTY ASP & CURRENT COCO ASP THEN DELETE USER ENTRY AND NO NEED TO NEED TO CREATE/UPDATE USER

          //DELETE ASP IN USER
          if (aspUserId) {
            const entityAspUserDelete: any = await axios.put(
              `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.delete}`,
              {
                userIds: [aspUserId],
              }
            );
            if (!entityAspUserDelete.data.success) {
              await transaction.rollback();
              return res.status(200).json(entityAspUserDelete.data);
            }
          }
          saveAspUser = false;
        }

        //If existing own patrol and current third party then
        //inactive:
        //  1.inactive is not possible if technician or helper is in shift
        //  2.if technician or helper not in shift then update aspId null to coco vehicle.
        //  3.if technician or helper not in shift then update inactive to asp mechanics
        //active:
        //  1.active is not possible if technician or helper is in shift.
        //  2.if technician or helper not in shift then update aspId null to coco vehicle.
        //  3.if technician or helper not in shift then update active to asp mechanics
        if (
          existingAspData &&
          existingAspData.dataValues.isOwnPatrol == 1 &&
          !aspData.isOwnPatrol
        ) {
          const ownPatrolToThirdPartyAspMechanics: any =
            await AspMechanic.findAll({
              where: { aspId: aspId },
              attributes: ["id"],
              paranoid: false,
            });
          if (
            (ownPatrolToThirdPartyAspMechanics &&
              ownPatrolToThirdPartyAspMechanics.length > 0) ||
            cocoVehicleHelper
          ) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error:
                "It’s not possible to change 'Own Patrol' status at the moment because the COCO technician / helper is on shift",
            });
          }

          await OwnPatrolVehicle.update(
            {
              aspId: null,
            },
            {
              where: {
                aspId: aspId,
              },
              paranoid: false,
              transaction: transaction,
            }
          );
        }
      } else {
        //ON ADD ASP
        if (aspData.isOwnPatrol == 1) {
          saveAspUser = false;
        }
      }

      // ASP IS NOT FINANCE ADMIN AND FINANCE ADMIN IS MAPPED THEN NO NEED TO SAVE USER
      if (!aspData.isFinanceAdmin && aspData.financeAdminId) {
        saveAspUser = false;
      }

      //UPDATE OTHER SUB ASPS FINANCE ADMIN AS NULL BECAUSE THIS ASP IS CHANGED TO NOT AN FINANCE ADMIN
      if (!aspData.isFinanceAdmin) {
        await Asp.update(
          {
            financeAdminId: null,
          },
          {
            where: {
              financeAdminId: userEntityId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      if (saveAspUser) {
        let aspAddress = payload.addressLineOne;
        if (payload.addressLineTwo) {
          aspAddress += `, ${payload.addressLineTwo}`;
        }
        const aspUserData = {
          userId: aspUserId,
          roleId: aspRoleId,
          userTypeId: 142, //ASP
          entityId: userEntityId,
          code: payload.aspCode,
          name: payload.name,
          mobileNumber: String(payload.contactNumber),
          email: payload.email || null,
          userName: String(payload.contactNumber),
          password: String(payload.contactNumber),
          ignorePasswordPattern: 1,
          address: aspAddress,
          changePassword: 1,
          status: payload.status,
          deletedById: deletedById,
          ...userCreatedByOrUpdatedById,
        };

        //SAVE USER ENTITY
        const saveAspUserEntity = await axios.post(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
          aspUserData
        );

        if (!saveAspUserEntity.data.success) {
          await transaction.rollback();
          const errorObject = {
            success: false,
            error: saveAspUserEntity.data.errors
              ? `ASP : ${saveAspUserEntity.data.errors.join(",")}`
              : `ASP : ${saveAspUserEntity.data.error}`,
          };

          return res.status(200).json(errorObject);
        }
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ASP synced successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  // subServiceMapping = async (req: Request, res: Response) => {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     const payload = req.body;
  //     const v = {
  //       aspCode: "required|string",
  //       subServiceDetails: "required|array",
  //       "subServiceDetails.*": "required",
  //     };
  //     const errors = await Utils.validateParams(payload, v);
  //     if (errors) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         errors: errors,
  //       });
  //     }

  //     if (payload.subServiceDetails.length == 0) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "ASP sub services are required",
  //       });
  //     }

  //     const trimmedAspCode = String(payload.aspCode).trim();
  //     const aspExists: any = await Asp.findOne({
  //       attributes: ["id"],
  //       where: {
  //         code: trimmedAspCode,
  //       },
  //       paranoid: false,
  //     });
  //     if (!aspExists) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "ASP not found",
  //       });
  //     }

  //     let index = 0;
  //     let subServicesArray: any = [];
  //     for (const subServiceDetail of payload.subServiceDetails) {
  //       index++;

  //       const v = {
  //         serviceName: "required|string",
  //         subServiceName: "required|string",
  //       };
  //       const errors = await Utils.validateParams(subServiceDetail, v);
  //       if (errors) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           errors: `Sub service record (${index}) : ${errors}`,
  //         });
  //       }

  //       const trimmedServiceName = String(subServiceDetail.serviceName).trim();
  //       const serviceExists: any = await Service.findOne({
  //         attributes: ["id"],
  //         where: {
  //           name: trimmedServiceName,
  //         },
  //         paranoid: false,
  //       });
  //       if (!serviceExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `Sub service record (${index}) : service not found`,
  //         });
  //       }

  //       const trimmedSubServiceName = String(
  //         subServiceDetail.subServiceName
  //       ).trim();
  //       const subServiceExists: any = await SubService.findOne({
  //         attributes: ["id", "serviceId"],
  //         where: {
  //           name: trimmedSubServiceName,
  //           serviceId: serviceExists.dataValues.id,
  //         },
  //         paranoid: false,
  //       });
  //       if (!subServiceExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `Sub service record (${index}) : sub service not found`,
  //         });
  //       }

  //       subServicesArray.push({
  //         aspId: aspExists.dataValues.id,
  //         subServiceId: subServiceExists.dataValues.id,
  //       });
  //     }

  //     // await AspSubService.destroy({
  //     //   where: {
  //     //     aspId: aspExists.dataValues.id,
  //     //   },
  //     //   force: true,
  //     //   transaction: transaction,
  //     // });

  //     const subServiceIds = subServicesArray.map(
  //       (subServiceArray: any) => subServiceArray.subServiceId
  //     );
  //     await AspSubService.destroy({
  //       where: {
  //         aspId: aspExists.dataValues.id,
  //         subServiceId: {
  //           [Op.notIn]: subServiceIds,
  //         },
  //       },
  //       force: true,
  //       transaction: transaction,
  //     });

  //     for (const subServiceArray of subServicesArray) {
  //       const aspSubServiceExists = await AspSubService.findOne({
  //         attributes: ["id"],
  //         where: {
  //           aspId: subServiceArray.aspId,
  //           subServiceId: subServiceArray.subServiceId,
  //         },
  //         transaction: transaction,
  //         paranoid: false,
  //       });
  //       if (aspSubServiceExists) {
  //         await sequelize.query(
  //           `UPDATE aspSubServices SET updatedAt = :updatedAt WHERE id = :id`,
  //           {
  //             replacements: {
  //               updatedAt: new Date(),
  //               id: aspSubServiceExists.dataValues.id,
  //             },
  //             transaction: transaction,
  //           }
  //         );
  //       } else {
  //         await AspSubService.create(
  //           {
  //             aspId: subServiceArray.aspId,
  //             subServiceId: subServiceArray.subServiceId,
  //           },
  //           {
  //             transaction: transaction,
  //           }
  //         );
  //       }

  //       // await AspSubService.findOrCreate({
  //       //   where: {
  //       //     aspId: subServiceArray.aspId,
  //       //     subServiceId: subServiceArray.subServiceId,
  //       //   },
  //       //   transaction: transaction,
  //       // });
  //     }

  //     await transaction.commit();
  //     return res.status(200).json({
  //       success: true,
  //       message: "ASP sub services mapped successfully",
  //     });
  //   } catch (error: any) {
  //     await transaction.rollback();
  //     return res.status(500).json({
  //       success: false,
  //       error: error?.message,
  //     });
  //   }
  // };

  getAspSubAsps = async (req: Request, res: Response) => {
    try {
      const { aspId, aspCode } = req.query;
      const whereClause: any = {};
      if (aspId) {
        whereClause.id = aspId;
      }
      if (aspCode) {
        whereClause.code = aspCode;
      }
      const aspExists: any = await Asp.findOne({
        attributes: ["id", "isFinanceAdmin"],
        where: whereClause,
        paranoid: false,
      });
      if (!aspExists) {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      let subAsps: any = [];
      if (aspExists.isFinanceAdmin) {
        subAsps = await Asp.findAll({
          attributes: ["id", "code"],
          where: {
            financeAdminId: aspExists.id,
          },
          paranoid: false,
        });
      }

      return res.status(200).json({
        success: true,
        subAsps: subAsps,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  captureLocation = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      //VALIDATIONS
      const v = {
        aspId: "required|numeric",
        latitude: "required|string|maxLength:60",
        longitude: "required|string|maxLength:60",
      };
      const errors = await Utils.validateParams(req.body, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { aspId, latitude, longitude } = req.body;

      // Check if ASP exists
      const asp = await Asp.findOne({
        where: { id: aspId },
        attributes: ["id", "isOwnPatrol"],
      });

      if (!asp) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      // Check if ASP is own patrol
      if (asp.dataValues.isOwnPatrol != 1) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP is not an own patrol ASP",
        });
      }

      // Get vehicle associated with this ASP
      const vehicle = await OwnPatrolVehicle.findOne({
        where: { aspId: aspId },
        attributes: ["id", "aspId"],
      });

      if (!vehicle) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Vehicle not found for this ASP",
        });
      }

      // Check if vehicle has active shift
      const activeShiftCheck = await checkOwnPatrolVehicleHasActiveShift(vehicle.dataValues.id);
      if (!activeShiftCheck.success || !activeShiftCheck.hasActiveShift) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Vehicle does not have an active shift",
        });
      }

      const aspMechanic = await AspMechanic.findOne({
        where: {
          aspId: aspId,
          aspTypeId: 771, //COCO
        },
        attributes: ["id"],
      });
      if (!aspMechanic) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP Mechanic not found",
        });
      }

      const attendanceLogId = activeShiftCheck.attendanceLogId;
      const capturedAt = new Date();
      const aspMechanicId = aspMechanic.dataValues.id;

      await Promise.all([
        // Insert location log
        AspLocationLog.create({
          aspId: aspId,
          attendanceLogId: attendanceLogId,
          aspMechanicId: aspMechanicId,
          latitude: latitude,
          longitude: longitude,
          capturedAt: capturedAt,
        }, { transaction }),

        // Update last location in asps
        Asp.update(
          {
            lastLatitude: latitude,
            lastLongitude: longitude,
            lastLocationUpdatedAt: capturedAt,
            lastLocationAttendanceLogId: attendanceLogId,
          },
          {
            where: { id: aspId },
            transaction,
          }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ASP location captured successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message || "Internal server error",
      });
    }
  };
}

//COMMON SAVE AND UPDATE API FOR SAVE ASP AND ASP DATA IMPORT
async function save(req: any, res: any, importData?: any) {
  const transaction = await sequelize.transaction();
  try {
    let payload;
    if (importData !== undefined) {
      payload = importData;
    } else {
      payload = req.body;
    }

    //VALIDATIONS
    const v = {
      aspId: "numeric",
      tierId: "required|numeric",
      axaptaCode: "required|string|maxLength:60",
      salutationId: "required|numeric",
      workingHourId: "required|numeric",
      code: "required|string|minLength:3|maxLength:60",
      name: "required|string|minLength:3|maxLength:255",
      workshopName: "required|string|minLength:3|maxLength:255",
      email: "email",
      whatsAppNumber: "string|minLength:10|maxLength:10",
      contactNumber: "required|string|minLength:10|maxLength:10",
      performanceId: "required|numeric",
      priorityId: "required|numeric",
      isOwnPatrol: "required|numeric",
      rmId: "required|numeric",
      businessHourId: "numeric",
      latitude: "required|string|maxLength:60",
      longitude: "required|string|maxLength:60",
      addressLineOne: "required|string",
      addressLineTwo: "string",
      stateId: "required|numeric",
      cityId: "required|numeric",
      location: "required|string|minLength:3|maxLength:255",
      pincode: "required|string|minLength:6|maxLength:6",
      hasMechanic: "required|numeric",
      isFinanceAdmin: "numeric",
      financeAdminId: "nullable",
      userId: "numeric",
      userName: "string|minLength:3|maxLength:255",
      password: "string",
      changePassword: "numeric",
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
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }
    }

    const {
      aspId,
      email,
      whatsAppNumber,
      rmId,
      businessHourId,
      addressLineTwo,
      pincode,
      ...inputData
    } = payload;

    // IS FINANCE ADMIN FIELD IS REQUIRED FOR THIRD PARTY ASP
    if (!inputData.isOwnPatrol && inputData.isFinanceAdmin == null) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "The is finance admin field is required",
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "The is finance admin field is required",
        });
      }
    }

    // USERNAME IS REQUIRED FOR THIRD PARTY ASP ONLY IT IS FINANCE ADMIN OR NOT FINANCE ADMIN AND FINANCE ADMIN USER IS NOT MAPPED
    if (
      !inputData.userName &&
      !inputData.isOwnPatrol &&
      (inputData.isFinanceAdmin ||
        (!inputData.isFinanceAdmin && !inputData.financeAdminId))
    ) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "The username field is required",
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "The username field is required",
        });
      }
    }

    //CUSTOM VALIDATIONS
    let existingAspData = null;
    if (aspId) {
      existingAspData = await Asp.findOne({
        attributes: ["id", "isOwnPatrol"],
        where: {
          id: aspId,
        },
        paranoid: false,
      });
    }

    const [
      tier,
      salutation,
      aspWorkingHour,
      aspPerformance,
      aspPriority,
      state,
      city,
      getAspRoleDetail,
    ]: any = await Promise.all([
      Config.findOne({
        where: {
          id: inputData.tierId,
          typeId: 29, //ASP TIERS
        },
        attributes: ["id"],
      }),
      Config.findOne({
        where: {
          id: inputData.salutationId,
          typeId: 9, //SALUTATIONS
        },
      }),
      Config.findOne({
        where: {
          id: inputData.workingHourId,
          typeId: 10, //WORKING HOURS
        },
      }),
      Config.findOne({
        where: {
          id: inputData.performanceId,
          typeId: 24, //ASP PERFORMANCES
        },
      }),
      Config.findOne({
        where: {
          id: inputData.priorityId,
          typeId: 25, //ASP PRIORITIES
        },
      }),
      State.findByPk(inputData.stateId),
      City.findByPk(inputData.cityId),
      //GET ASP ROLE DETAILS
      axios.get(
        `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=ASP`
      ),
    ]);

    if (!tier) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Tier not found",
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Tier not found",
        });
      }
    }

    if (!salutation) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Salutation not found",
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Salutation not found",
        });
      }
    }

    if (!aspWorkingHour) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Working Hour not found",
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "ASP Working Hour not found",
        });
      }
    }

    if (!aspPerformance) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Performance not found",
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "ASP Performance not found",
        });
      }
    }

    if (!aspPriority) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Priority not found",
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "ASP Priority not found",
        });
      }
    }

    if (!state) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "State not found",
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "State not found",
        });
      }
    }

    if (!city) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "City not found",
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "City not found",
        });
      }
    }

    if (!getAspRoleDetail.data.success) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: getAspRoleDetail.data.error,
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: getAspRoleDetail.data.error,
        });
      }
    }
    const aspRoleId = getAspRoleDetail.data.data.id;

    //REGIONAL MANAGER VALIDATION FOR ASP IMPORT
    // if (importData && payload.regionalManagerUserName && !rmId) {
    if (importData && !rmId) {
      await transaction.rollback();
      return {
        success: false,
        error: "Regional manager not found",
        data: payload,
        type: "asp",
      };
    }

    if (importData && inputData.financeAdminCode && !inputData.financeAdminId) {
      await transaction.rollback();
      return {
        success: false,
        error: "Finance admin not found",
        data: payload,
        type: "asp",
      };
    }

    if (aspId) {
      const asp = await Asp.findOne({
        attributes: ["id"],
        where: {
          id: aspId,
        },
        paranoid: false,
        transaction: transaction,
      });

      if (!asp) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "ASP not found",
            data: payload,
            type: "asp",
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "ASP not found",
          });
        }
      }

      const aspAlreadyExists = await Asp.findOne({
        where: {
          code: inputData.code,
          id: {
            [Op.ne]: aspId,
          },
        },
        attributes: ["id"],
        paranoid: false,
        transaction: transaction,
      });
      if (aspAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "ASP code is already taken",
            data: payload,
            type: "asp",
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "ASP code is already taken",
          });
        }
      }
    } else {
      const aspAlreadyExists = await Asp.findOne({
        where: {
          code: inputData.code,
        },
        attributes: ["id"],
        paranoid: false,
        transaction: transaction,
      });
      if (aspAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "ASP code is already taken",
            data: payload,
            type: "asp",
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "ASP code is already taken",
          });
        }
      }
    }

    // SAVE ASP PROCESS
    let deletedAt = null;
    let deletedById = null;
    //INACTIVE
    if (inputData.status == 0) {
      deletedAt = new Date();
      deletedById = inputData.authUserId;
    }

    const aspData: any = {
      ...inputData,
      email: email ? email : null,
      whatsAppNumber: whatsAppNumber ? whatsAppNumber : null,
      rmId: rmId ? rmId : null,
      businessHourId: businessHourId ? businessHourId : null,
      addressLineTwo: addressLineTwo ? addressLineTwo : null,
      pincode: pincode ? pincode : null,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    //If coco asp means has mechanic will be 1
    if (aspData && aspData.isOwnPatrol == 1) {
      aspData.hasMechanic = 1;
    }

    let userEntityId: any;
    let savedAspId: any;
    let userCreatedByOrUpdatedById: any;
    let message = null;
    if (aspId) {
      await Asp.update(aspData, {
        where: {
          id: aspId,
        },
        paranoid: false,
        transaction: transaction,
      });
      userEntityId = aspId;
      savedAspId = aspId;
      userCreatedByOrUpdatedById = {
        updatedById: inputData.updatedById,
      };
      message = "ASP updated successfully";
    } else {
      const newAsp = await Asp.create(aspData, {
        transaction: transaction,
      });
      userEntityId = newAsp.dataValues.id;
      savedAspId = newAsp.dataValues.id;
      userCreatedByOrUpdatedById = {
        createdById: inputData.createdById,
      };
      message = "ASP created successfully";
    }

    let saveAspUser = true;
    //ON EDIT ASP
    if (aspId) {
      const cocoVehicleHelper = await OwnPatrolVehicleHelper.findOne({
        attributes: ["id", "ownPatrolVehicleId"],
        paranoid: false,
        include: {
          model: OwnPatrolVehicle,
          as: "ownPatrolVehicle",
          where: {
            aspId: aspId,
          },
          required: true,
          paranoid: false,
        },
      });

      //If existing coco and current coco then
      //inactive:
      //  1. inactive is not possible if technician or helper is in shift.
      //  2. if technician or helper not in shift then update inactive to asp and coco vehicle.
      //active:
      //  1. update asp active.
      //  2. update coco vehicle active status.
      if (
        existingAspData &&
        existingAspData.dataValues.isOwnPatrol == 1 &&
        aspData.isOwnPatrol == 1
      ) {
        const cocoAspMechanic: any = await AspMechanic.findOne({
          where: { aspId: aspId },
          attributes: ["id"],
          paranoid: false,
        });

        if (aspData.status == 0 && (cocoAspMechanic || cocoVehicleHelper)) {
          await transaction.rollback();
          if (importData !== undefined) {
            return {
              success: false,
              error:
                "It’s not possible to inactive the ASP at the moment because the COCO technician / helper is on shift",
              data: payload,
              type: "asp",
            };
          } else {
            return res.status(200).json({
              success: false,
              error:
                "It’s not possible to inactive the ASP at the moment because the COCO technician / helper is on shift",
            });
          }
        }

        const ownPatrolVehicleUpdate: any = {};
        ownPatrolVehicleUpdate.updatedById = inputData.updatedById;
        ownPatrolVehicleUpdate.deletedById = deletedById;
        ownPatrolVehicleUpdate.deletedAt = deletedAt;
        if (aspData.status == 1) {
          //ACTIVE
          ownPatrolVehicleUpdate.inActiveReason = null;
          ownPatrolVehicleUpdate.inActiveFromDate = null;
          ownPatrolVehicleUpdate.inActiveToDate = null;
          ownPatrolVehicleUpdate.isActiveReminderSent = 0;
        }
        await OwnPatrolVehicle.update(ownPatrolVehicleUpdate, {
          where: {
            aspId: aspId,
          },
          paranoid: false,
          transaction: transaction,
        });

        // EXISTING COCO ASP & CURRENT COCO ASP THEN NO NEED TO CREATE USER
        saveAspUser = false;
      }

      //If existing third party and current third party then
      //inactive:
      //  1.update inactive status to asp mechanics.
      //  2.update aspId as null in coco vehicle.
      //active:
      //  1.update active status to asp mechanics.
      //  2.update aspId as null in coco vehicle.
      if (
        existingAspData &&
        !existingAspData.dataValues.isOwnPatrol &&
        !aspData.isOwnPatrol
      ) {
        const thirdPartyAspMechanics: any = await AspMechanic.findAll({
          where: { aspId: aspId },
          attributes: ["id"],
          paranoid: false,
        });
        if (thirdPartyAspMechanics.length > 0) {
          const aspMechanicUpdateStatusResponse =
            await updateStatusForAspMechanics(
              thirdPartyAspMechanics,
              inputData.updatedById,
              deletedById,
              deletedAt,
              aspData.status,
              transaction
            );
          if (!aspMechanicUpdateStatusResponse.success) {
            await transaction.rollback();
            if (importData !== undefined) {
              return {
                ...aspMechanicUpdateStatusResponse,
                data: payload,
                type: "asp",
              };
            } else {
              return res.status(200).json(aspMechanicUpdateStatusResponse);
            }
          }
        }

        //DELETE ASP IN USER
        if (
          inputData.userId &&
          !aspData.isFinanceAdmin &&
          aspData.financeAdminId
        ) {
          const entityAspUserDelete: any = await axios.put(
            `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.delete}`,
            {
              userIds: [inputData.userId],
            }
          );
          if (!entityAspUserDelete.data.success) {
            await transaction.rollback();
            if (importData !== undefined) {
              return {
                ...entityAspUserDelete.data,
                data: payload,
                type: "asp",
              };
            } else {
              return res.status(200).json(entityAspUserDelete.data);
            }
          }
        }
      }

      //IF ASP HAS MECHANIC 0 MEANS, WE NEED TO UPDATE ASP ID TO NULL FOR ASP MECHANICS
      if (aspData.hasMechanic == 0) {
        const thirdPartyAspMechanics: any = await AspMechanic.findAll({
          where: { aspId: aspId },
          attributes: ["id"],
          paranoid: false,
        });
        if (thirdPartyAspMechanics.length > 0) {
          const thirdPartyAspMechanicsIds = thirdPartyAspMechanics.map(
            (thirdPartyAspMechanic: any) => thirdPartyAspMechanic.id
          );
          const removeAspIdResponse = await removeAspId(
            thirdPartyAspMechanicsIds,
            transaction
          );
          if (!removeAspIdResponse.success) {
            await transaction.rollback();
            if (importData !== undefined) {
              return {
                ...removeAspIdResponse,
                data: payload,
                type: "asp",
              };
            } else {
              return res.status(200).json(removeAspIdResponse);
            }
          }
        }
      }

      //If existing third party and current coco then
      //inactive:
      //  1.update aspId to null for asp mechanics
      //  2.update inactive to coco vehicle.
      //active:
      //  1.update aspId to null for asp mechanics
      //  2.update active to coco vehicle.
      if (
        existingAspData &&
        !existingAspData.dataValues.isOwnPatrol &&
        aspData.isOwnPatrol == 1
      ) {
        const thirdPartyToOwnPatrolMechanics: any = await AspMechanic.findAll({
          where: { aspId: aspId },
          attributes: ["id"],
          paranoid: false,
        });
        if (thirdPartyToOwnPatrolMechanics.length > 0) {
          const thirdPartyToOwnPatrolMechanicIds =
            thirdPartyToOwnPatrolMechanics.map(
              (thirdPartyToOwnPatrolMechanic: any) =>
                thirdPartyToOwnPatrolMechanic.id
            );
          const thirdPartyToOwnPatrolAspIdRemoveResponse = await removeAspId(
            thirdPartyToOwnPatrolMechanicIds,
            transaction
          );
          if (!thirdPartyToOwnPatrolAspIdRemoveResponse.success) {
            await transaction.rollback();
            if (importData !== undefined) {
              return {
                ...thirdPartyToOwnPatrolAspIdRemoveResponse,
                data: payload,
                type: "asp",
              };
            } else {
              return res
                .status(200)
                .json(thirdPartyToOwnPatrolAspIdRemoveResponse);
            }
          }
        }

        const ownPatrolVehicleUpdate: any = {};
        ownPatrolVehicleUpdate.updatedById = inputData.updatedById;
        ownPatrolVehicleUpdate.deletedById = deletedById;
        ownPatrolVehicleUpdate.deletedAt = deletedAt;
        if (aspData.status == 1) {
          //ACTIVE
          ownPatrolVehicleUpdate.inActiveReason = null;
          ownPatrolVehicleUpdate.inActiveFromDate = null;
          ownPatrolVehicleUpdate.inActiveToDate = null;
          ownPatrolVehicleUpdate.isActiveReminderSent = 0;
        }

        await OwnPatrolVehicle.update(ownPatrolVehicleUpdate, {
          where: {
            aspId: aspId,
          },
          paranoid: false,
          transaction: transaction,
        });

        // EXISTING THIRD PARTY ASP & CURRENT COCO ASP THEN DELETE USER ENTRY AND NO NEED TO NEED TO CREATE/UPDATE USER

        //DELETE ASP IN USER
        if (inputData.userId) {
          const entityAspUserDelete: any = await axios.put(
            `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.delete}`,
            {
              userIds: [inputData.userId],
            }
          );
          if (!entityAspUserDelete.data.success) {
            await transaction.rollback();
            if (importData !== undefined) {
              return {
                ...entityAspUserDelete.data,
                data: payload,
                type: "asp",
              };
            } else {
              return res.status(200).json(entityAspUserDelete.data);
            }
          }
        }
        saveAspUser = false;
      }

      //If existing own patrol and current third party then
      //inactive:
      //  1.inactive is not possible if technician or helper is in shift
      //  2.if technician or helper not in shift then update aspId null to coco vehicle.
      //  3.if technician or helper not in shift then update inactive to asp mechanics
      //active:
      //  1.active is not possible if technician or helper is in shift.
      //  2.if technician or helper not in shift then update aspId null to coco vehicle.
      //  3.if technician or helper not in shift then update active to asp mechanics
      if (
        existingAspData &&
        existingAspData.dataValues.isOwnPatrol == 1 &&
        !aspData.isOwnPatrol
      ) {
        const ownPatrolToThirdPartyAspMechanics: any =
          await AspMechanic.findAll({
            where: { aspId: aspId },
            attributes: ["id"],
            paranoid: false,
          });
        if (
          (ownPatrolToThirdPartyAspMechanics &&
            ownPatrolToThirdPartyAspMechanics.length > 0) ||
          cocoVehicleHelper
        ) {
          await transaction.rollback();
          if (importData !== undefined) {
            return {
              success: false,
              error:
                "It’s not possible to change 'Own Patrol' status at the moment because the COCO technician / helper is on shift",
              data: payload,
              type: "asp",
            };
          } else {
            return res.status(200).json({
              success: false,
              error:
                "It’s not possible to change 'Own Patrol' status at the moment because the COCO technician / helper is on shift",
            });
          }
        }

        await OwnPatrolVehicle.update(
          {
            aspId: null,
          },
          {
            where: {
              aspId: aspId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }
    } else {
      //ON ADD ASP
      if (aspData.isOwnPatrol == 1) {
        saveAspUser = false;
      }
    }

    // ASP IS NOT FINANCE ADMIN AND FINANCE ADMIN IS MAPPED THEN NO NEED TO SAVE USER
    if (!aspData.isFinanceAdmin && aspData.financeAdminId) {
      saveAspUser = false;
    }

    //UPDATE OTHER SUB ASPS FINANCE ADMIN AS NULL BECAUSE THIS ASP IS CHANGED TO NOT AN FINANCE ADMIN
    if (!aspData.isFinanceAdmin) {
      await Asp.update(
        {
          financeAdminId: null,
        },
        {
          where: {
            financeAdminId: userEntityId,
          },
          paranoid: false,
          transaction: transaction,
        }
      );
    }

    if (saveAspUser) {
      let aspAddress = inputData.addressLineOne;
      if (inputData.addressLineTwo) {
        aspAddress += `, ${inputData.addressLineTwo}`;
      }
      const aspUserData = {
        userId: inputData.userId,
        roleId: aspRoleId,
        userTypeId: 142, //ASP
        entityId: userEntityId,
        code: inputData.code,
        name: inputData.name,
        mobileNumber: inputData.contactNumber,
        // email: inputData.email,
        email: email ? email : null,
        userName: inputData.userName,
        password: inputData.password,
        ignorePasswordPattern: 1,
        address: aspAddress,
        changePassword: inputData.changePassword,
        status: inputData.status,
        deletedById: deletedById,
        ...userCreatedByOrUpdatedById,
      };

      //SAVE USER ENTITY
      const saveAspUserEntity = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
        aspUserData
      );
      if (!saveAspUserEntity.data.success) {
        await transaction.rollback();
        const errorObject = {
          success: false,
          error: saveAspUserEntity.data.errors
            ? `ASP : ${saveAspUserEntity.data.errors.join(",")}`
            : `ASP : ${saveAspUserEntity.data.error}`,
        };
        if (importData !== undefined) {
          return {
            ...errorObject,
            data: payload,
            type: "asp",
          };
        } else {
          return res.status(200).json(errorObject);
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
    if (importData !== undefined) {
      return {
        success: false,
        error: error.message,
        data: importData,
        type: "asp",
      };
    } else {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const getAsp = async (id: any) => {
  try {
    return await Asp.findOne({
      attributes: [
        "id",
        "code",
        "name",
        "workShopName",
        "contactNumber",
        "whatsAppNumber",
        "location",
        "rmId",
        "addressLineOne",
        "addressLineTwo",
      ],
      where: { id: id },
      paranoid: false,
    });
  } catch (error: any) {
    throw error;
  }
};

const updateStatusForAspMechanics = async (
  aspMechanics: any,
  updatedById: any,
  deletedById: any,
  deletedAt: any,
  status: number,
  transaction: any
) => {
  try {
    const aspMechanicIds = aspMechanics.map(
      (aspMechanic: any) => aspMechanic.dataValues.id
    );
    await AspMechanic.update(
      {
        updatedById: updatedById,
        deletedById: deletedById,
        deletedAt: deletedAt,
      },
      {
        where: {
          id: {
            [Op.in]: aspMechanicIds,
          },
        },
        paranoid: false,
        transaction: transaction,
      }
    );

    //GET ASP MECHANIC USER DETAILS
    const getAllAspMechanicEntityUsers: any = await axios.post(
      `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
      {
        userTypeId: 143, //ASP MECHANIC
        entityIds: aspMechanicIds,
      }
    );
    if (!getAllAspMechanicEntityUsers.data.success) {
      return {
        success: false,
        error: getAllAspMechanicEntityUsers.data.error,
      };
    }
    const entityAspMechanicUserIds = getAllAspMechanicEntityUsers.data.data.map(
      (entityUser: any) => entityUser.id
    );

    //UPDATE ASP MECHANIC STATUS IN USER
    const entityAspMechanicUserUpdateStatus: any = await axios.put(
      `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.updateStatus}`,
      {
        userIds: entityAspMechanicUserIds,
        status: status,
        updatedById: updatedById,
        deletedById: deletedById,
      }
    );
    if (!entityAspMechanicUserUpdateStatus.data.success) {
      return entityAspMechanicUserUpdateStatus.data;
    }
    return {
      success: true,
      message: "Processed successfully",
    };
  } catch (error: any) {
    throw error;
  }
};

export const uatAspSeeder = async (data: any) => {
  try {
    //Get asp and service regional manager user details
    const getUserDetails: any = await axios.post(
      `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
      {
        roleIds: [4, 6], // Asp, Service Regional Manager
      }
    );
    let allUserDetails: any = [];
    if (getUserDetails?.data?.success) {
      allUserDetails = getUserDetails.data.data.roleUserDetails;
    }

    //Get asp role detail
    const getAspRoleDetail = await axios.get(
      `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=ASP`
    );
    let aspRoleId: any = null;
    if (getAspRoleDetail?.data?.success) {
      aspRoleId = getAspRoleDetail.data.data.id;
    }

    const details: any = [];
    await data.eachRow(async (row: any, rowNumber: number) => {
      if (rowNumber !== 1) {
        let [
          ,
          tier,
          axaptaCode,
          salutation,
          name,
          aspCode,
          workshopName,
          email,
          whatsAppNumber,
          contactNumber,
          workingHours,
          performance,
          priority,
          regionalManagerUserName,
          isOwnPatrol,
          isFinanceAdmin,
          financeAdminCode,
          userName,
          password,
          changePassword,
          status,
          addressLineOne,
          addressLineTwo,
          state,
          city,
          pincode,
          location,
          latitude,
          longitude,
        ] = row.values;

        details.push({
          tier: tier,
          axaptaCode: axaptaCode,
          salutation: salutation,
          name: name,
          aspCode: aspCode,
          workshopName: workshopName,
          email: email,
          whatsAppNumber: whatsAppNumber,
          contactNumber: contactNumber,
          workingHours: workingHours,
          performance: performance,
          priority: priority,
          regionalManagerUserName: regionalManagerUserName,
          isOwnPatrol: isOwnPatrol,
          isFinanceAdmin: isFinanceAdmin,
          financeAdminCode: financeAdminCode,
          userName: userName,
          password: password,
          changePassword: changePassword,
          status: status,
          addressLineOne: addressLineOne,
          addressLineTwo: addressLineTwo,
          state: state,
          city: city,
          pincode: pincode,
          location: location,
          latitude: latitude,
          longitude: longitude,
        });
      }
    });

    let createdAspCount = 0;
    let updatedAspCount = 0;
    let createdAspUserCount = 0;
    let deletedAspUserCount = 0;
    for (const detail of details) {
      const transaction = await sequelize.transaction();
      try {
        let createdAsp = false;
        let updatedAsp = false;
        let createdAspUser = false;
        let deletedAspUser = false;

        if (!["Yes", "No"].includes(detail.isOwnPatrol)) {
          await transaction.rollback();
          console.log(
            `${detail.aspCode} : Own patrol value should be Yes or No.`
          );
          continue;
        }

        if (
          detail.isFinanceAdmin &&
          !["Yes", "No"].includes(detail.isFinanceAdmin)
        ) {
          await transaction.rollback();
          console.log(
            `${detail.aspCode} : Is finance admin value should be Yes or No.`
          );
          continue;
        }

        if (
          detail.changePassword &&
          !["Yes", "No"].includes(detail.changePassword)
        ) {
          await transaction.rollback();
          console.log(
            `${detail.aspCode} : Change password value should be Yes or No.`
          );
          continue;
        }

        if (detail.status && !["Active", "Inactive"].includes(detail.status)) {
          await transaction.rollback();
          console.log(
            `${detail.aspCode} : Status value should be Active or Inactive.`
          );
          continue;
        }

        //Asp
        let aspId = null;
        let userId = null;
        if (detail.aspCode) {
          const trimmedCode = String(detail.aspCode).trim();
          const aspAlreadyExists = await Asp.findOne({
            attributes: ["id"],
            where: {
              code: trimmedCode,
            },
            paranoid: false,
          });
          if (aspAlreadyExists) {
            aspId = aspAlreadyExists.dataValues.id;

            //User
            const aspUserDetail = allUserDetails.find(
              (allUserDetail: any) =>
                allUserDetail.entityId == aspAlreadyExists.dataValues.id &&
                allUserDetail.roleId == 4
            );

            if (aspUserDetail) {
              userId = aspUserDetail.id;
            }
          }
        }

        //Regional manager
        let rmId = null;
        if (detail.regionalManagerUserName) {
          const trimmedRmUserName = String(
            detail.regionalManagerUserName
          ).trim();
          const rmDetail: any = allUserDetails.find(
            (allUserDetail: any) =>
              allUserDetail.userName == trimmedRmUserName &&
              allUserDetail.roleId == 6
          );

          if (rmDetail) {
            rmId = rmDetail.id;
          }
        }

        //Performance
        let performanceId = null;
        if (detail.performance) {
          const trimmedPerformanceName = String(detail.performance).trim();
          const performanceDetail = await Config.findOne({
            attributes: ["id", "name"],
            where: {
              name: trimmedPerformanceName,
              typeId: 24, //ASP PERFORMANCES
            },
          });

          if (performanceDetail) {
            performanceId = performanceDetail.dataValues.id;
          }
        }

        //Priority
        let priorityId = null;
        const trimmedPriorityName = Number(detail.priority) + 1;
        const priorityDetail = await Config.findOne({
          attributes: ["id", "name"],
          where: {
            name: trimmedPriorityName,
            typeId: 25, //ASP PRIORITIES
          },
        });
        if (priorityDetail) {
          priorityId = priorityDetail.dataValues.id;
        }

        //Tier
        let tierId = null;
        if (detail.tier) {
          const trimmedTierName = String(detail.tier).trim();
          const tierDetail = await Config.findOne({
            attributes: ["id", "name"],
            where: {
              name: trimmedTierName,
              typeId: 29, //ASP TIERS
            },
          });

          if (tierDetail) {
            tierId = tierDetail.dataValues.id;
          }
        }

        //Salutation
        let salutationId = null;
        if (detail.salutation) {
          const trimmedSalutationName = String(detail.salutation).trim();
          const salutationDetail = await Config.findOne({
            attributes: ["id", "name"],
            where: {
              name: trimmedSalutationName,
              typeId: 9, //Salutations
            },
          });
          if (salutationDetail) {
            salutationId = salutationDetail.dataValues.id;
          }
        }

        //Working hours
        let workingHourId: any = null;
        if (detail.workingHours) {
          const trimmedWorkingHourName = String(detail.workingHours).trim();
          const workingHourDetail = await Config.findOne({
            attributes: ["id", "name"],
            where: {
              name: trimmedWorkingHourName,
              typeId: 10, //ASP Working Hours
            },
          });

          if (workingHourDetail) {
            workingHourId = workingHourDetail.dataValues.id;
          }
        }

        //State
        let stateId = null;
        if (detail.state) {
          const trimmedStateName = String(detail.state).trim();
          const stateDetail = await State.findOne({
            attributes: ["id", "name"],
            where: { name: trimmedStateName },
            paranoid: false,
          });

          if (stateDetail) {
            stateId = stateDetail.dataValues.id;
          }
        }

        //City
        let cityId = null;
        if (stateId && detail.city) {
          const trimmedCityName = String(detail.city).trim();
          const cityDetail = await City.findOne({
            attributes: ["id", "name"],
            where: {
              name: trimmedCityName,
              stateId: stateId,
            },
            paranoid: false,
          });

          if (cityDetail) {
            cityId = cityDetail.dataValues.id;
          }
        }

        //Finance admin
        let financeAdminId = null;
        if (detail.financeAdminCode) {
          const trimmedFinanceAdminCode = String(
            detail.financeAdminCode
          ).trim();
          const financeAdminDetail: any = await Asp.findOne({
            attributes: ["id"],
            where: {
              code: trimmedFinanceAdminCode,
            },
            paranoid: false,
          });

          if (financeAdminDetail) {
            financeAdminId = financeAdminDetail.id;
          }
        }

        //Reassign to actual values
        detail.isOwnPatrol = detail.isOwnPatrol == "Yes" ? 1 : 0;
        detail.isFinanceAdmin = detail.isFinanceAdmin == "Yes" ? 1 : 0;
        detail.status = detail.status == "Active" ? 1 : 0;
        detail.changePassword = detail.changePassword == "Yes" ? 1 : 0;

        let deleteAspUser = false;
        if (aspId) {
          //Update
          const aspAlreadyExists = await Asp.findOne({
            attributes: ["id"],
            where: {
              code: detail.aspCode,
              id: {
                [Op.ne]: aspId,
              },
            },
            paranoid: false,
          });
          if (aspAlreadyExists) {
            await transaction.rollback();
            console.log(`${detail.aspCode} : ASP code is already taken.`);
            continue;
          }

          const aspData: any = await Asp.findOne({
            attributes: ["isOwnPatrol"],
            where: {
              id: aspId,
            },
            paranoid: false,
          });

          if (
            aspData &&
            (aspData.isOwnPatrol ||
              (!aspData.isOwnPatrol &&
                !detail.isFinanceAdmin &&
                financeAdminId))
          ) {
            deleteAspUser = true;
          }
        } else {
          //Add
          const aspAlreadyExists = await Asp.findOne({
            attributes: ["id"],
            where: {
              code: detail.aspCode,
            },
            paranoid: false,
          });
          if (aspAlreadyExists) {
            await transaction.rollback();
            console.log(`${detail.aspCode} : ASP code is already taken.`);
            continue;
          }
        }

        let deletedAt = null;
        let deletedById: any = null;
        //INACTIVE
        if (detail.status == 0) {
          deletedAt = new Date();
          deletedById = 484; //The admin
        }

        let userEntityId: any;
        let savedAspId: any;
        let userCreatedByOrUpdatedById: any;
        if (aspId) {
          const updateData = {
            isFinanceAdmin: detail.isFinanceAdmin,
            financeAdminId: financeAdminId,
            updatedById: 484, //The admin
          };

          await Asp.update(updateData, {
            where: {
              id: aspId,
            },
            paranoid: false,
            transaction: transaction,
          });
          userEntityId = aspId;
          savedAspId = aspId;
          userCreatedByOrUpdatedById = {
            updatedById: 484, //The admin
          };

          updatedAsp = true;
        } else {
          const createData: any = {
            tierId: tierId,
            axaptaCode: detail.axaptaCode ? detail.axaptaCode : null,
            salutationId: salutationId,
            workingHourId: workingHourId,
            code: detail.aspCode ? detail.aspCode : null,
            name: detail.name ? detail.name : null,
            workshopName: detail.workshopName ? detail.workshopName : null,
            email: detail.email ? detail.email : null,
            whatsAppNumber: detail.whatsAppNumber
              ? detail.whatsAppNumber
              : null,
            contactNumber: detail.contactNumber ? detail.contactNumber : null,
            performanceId: performanceId,
            priorityId: priorityId,
            isOwnPatrol: detail.isOwnPatrol,
            hasMechanic: detail.isOwnPatrol == 1 ? 1 : 0,
            isFinanceAdmin: detail.isFinanceAdmin,
            financeAdminId: financeAdminId,
            rmId: rmId,
            latitude: detail.latitude ? detail.latitude : null,
            longitude: detail.longitude ? detail.longitude : null,
            addressLineOne: detail.addressLineOne
              ? detail.addressLineOne
              : null,
            addressLineTwo: detail.addressLineTwo
              ? detail.addressLineTwo
              : null,
            stateId: stateId,
            cityId: cityId,
            location: detail.location ? detail.location : null,
            pincode: detail.pincode ? detail.pincode : null,
            createdById: 484, //The admin
            deletedById: deletedById,
            deletedAt: deletedAt,
          };

          const newAsp = await Asp.create(createData, {
            transaction: transaction,
          });
          userEntityId = newAsp.dataValues.id;
          savedAspId = newAsp.dataValues.id;
          userCreatedByOrUpdatedById = {
            createdById: 484, //The admin
          };

          createdAsp = true;
        }

        let saveAspUser = false;
        //For new asp creation the user data is required for third party asp is finance admin or if the asp is not finance admin and finance admin user is not mapped.
        if (
          !aspId &&
          !detail.isOwnPatrol &&
          (detail.isFinanceAdmin || (!detail.isFinanceAdmin && !financeAdminId))
        ) {
          saveAspUser = true;
        }

        //UPDATE OTHER SUB ASPS FINANCE ADMIN AS NULL BECAUSE THIS ASP IS CHANGED TO NOT AN FINANCE ADMIN
        if (!detail.isFinanceAdmin) {
          await Asp.update(
            {
              financeAdminId: null,
            },
            {
              where: {
                financeAdminId: userEntityId,
              },
              paranoid: false,
              transaction: transaction,
            }
          );
        }

        if (saveAspUser) {
          let aspAddress = detail.addressLineOne;
          if (detail.addressLineTwo) {
            aspAddress += `, ${detail.addressLineTwo}`;
          }
          const aspUserData = {
            userId: userId,
            roleId: aspRoleId,
            userTypeId: 142, //ASP
            entityId: userEntityId,
            code: detail.aspCode,
            name: detail.name,
            mobileNumber: detail.contactNumber
              ? String(detail.contactNumber)
              : null,
            email: detail.email ? detail.email : null,
            ignoreEmailFormat: 1,
            userName: detail.userName ? String(detail.userName) : null,
            password: detail.password ? String(detail.password) : null,
            address: aspAddress ? String(aspAddress) : null,
            changePassword: detail.changePassword,
            status: detail.status,
            ignorePasswordPattern: 1,
            deletedById: deletedById,
            ...userCreatedByOrUpdatedById,
          };

          const saveAspUserEntity = await axios.post(
            `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
            aspUserData
          );

          if (!saveAspUserEntity.data.success) {
            let errors = saveAspUserEntity.data.errors
              ? saveAspUserEntity.data.errors.join(",")
              : saveAspUserEntity.data.error;

            await transaction.rollback();
            console.log(`${detail.aspCode} : ${errors}.`);
            continue;
          }
          createdAspUser = true;
        }

        //DELETE ASP IN USER
        if (deleteAspUser && userId) {
          const entityAspUserDelete: any = await axios.put(
            `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.delete}`,
            {
              userIds: [userId],
            }
          );
          if (!entityAspUserDelete.data.success) {
            let errors = entityAspUserDelete.data.errors
              ? entityAspUserDelete.data.errors.join(",")
              : entityAspUserDelete.data.error;

            await transaction.rollback();
            console.log(`${detail.aspCode} : ${errors}.`);
            continue;
          }
          deletedAspUser = true;
        }

        if (createdAsp) {
          createdAspCount++;
        }

        if (updatedAsp) {
          updatedAspCount++;
        }

        if (createdAspUser) {
          createdAspUserCount++;
        }

        if (deletedAspUser) {
          deletedAspUserCount++;
        }

        await transaction.commit();
      } catch (error: any) {
        await transaction.rollback();
        console.log(`${detail.aspCode} : ${error.message}.`);
        continue;
      }
    }

    return {
      success: true,
      createdAspCount: createdAspCount,
      updatedAspCount: updatedAspCount,
      createdAspUserCount: createdAspUserCount,
      deletedAspUserCount: deletedAspUserCount,
      message: "Synced successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

const subServiceMapping = async (
  aspId: number,
  subServiceDetails: any,
  transaction: any
) => {
  try {
    if (subServiceDetails.length == 0) {
      return {
        success: false,
        error: "ASP sub services are required",
      };
    }

    const uniqueServiceNames = [
      ...new Set(
        subServiceDetails.map((item: any) => String(item.serviceName).trim())
      ),
    ];
    const uniqueSubServiceNames = [
      ...new Set(
        subServiceDetails.map((item: any) => String(item.subServiceName).trim())
      ),
    ];

    const [services, subServices]: any = await Promise.all([
      Service.findAll({
        attributes: ["id", "name"],
        where: {
          name: {
            [Op.in]: uniqueServiceNames,
          },
        },
        paranoid: false,
      }),
      SubService.findAll({
        attributes: ["id", "name", "serviceId"],
        where: {
          name: {
            [Op.in]: uniqueSubServiceNames,
          },
        },
        paranoid: false,
      }),
    ]);

    let index = 0;
    let subServicesArray: any = [];
    for (const subServiceDetail of subServiceDetails) {
      index++;

      const v = {
        serviceName: "required|string",
        subServiceName: "required|string",
      };
      const errors = await Utils.validateParams(subServiceDetail, v);
      if (errors) {
        return {
          success: false,
          errors: `Sub service record (${index}) : ${errors}`,
        };
      }

      const serviceExists = services.find(
        (service: any) =>
          service.name == String(subServiceDetail.serviceName).trim()
      );
      if (!serviceExists) {
        return {
          success: false,
          error: `Sub service record (${index}) : service not found`,
        };
      }

      const subServiceExists: any = subServices.find(
        (subService: any) =>
          subService.name == String(subServiceDetail.subServiceName).trim() &&
          subService.serviceId == serviceExists.dataValues.id
      );
      // if (!subServiceExists) {
      //   return {
      //     success: false,
      //     error: `Sub service record (${index}) : sub service not found`,
      //   };
      // }
      if (subServiceExists) {
        subServicesArray.push({
          aspId: aspId,
          subServiceId: subServiceExists.dataValues.id,
        });
      }
    }

    const subServiceIds = subServicesArray.map(
      (subServiceArray: any) => subServiceArray.subServiceId
    );
    await AspSubService.destroy({
      where: {
        aspId: aspId,
        subServiceId: {
          [Op.notIn]: subServiceIds,
        },
      },
      force: true,
      transaction: transaction,
    });

    for (const subServiceArray of subServicesArray) {
      const aspSubServiceExists = await AspSubService.findOne({
        attributes: ["id"],
        where: {
          aspId: subServiceArray.aspId,
          subServiceId: subServiceArray.subServiceId,
        },
        transaction: transaction,
        paranoid: false,
      });
      if (aspSubServiceExists) {
        await AspSubService.update(
          {
            updatedAt: new Date(),
          },
          {
            where: {
              id: aspSubServiceExists.dataValues.id,
            },
            transaction: transaction,
          }
        );
      } else {
        await AspSubService.create(
          {
            aspId: subServiceArray.aspId,
            subServiceId: subServiceArray.subServiceId,
          },
          {
            transaction: transaction,
          }
        );
      }
    }

    return {
      success: true,
      message: "ASP sub services mapped successfully",
    };
  } catch (error: any) {
    throw error;
  }
};

const clientMapping = async (
  aspId: number,
  clientDetails: any,
  transaction: any
) => {
  try {
    if (clientDetails.length == 0) {
      return {
        success: false,
        error: "ASP clients are required",
      };
    }

    const uniqueClients = [
      ...new Set(
        clientDetails.map((item: any) => String(item.clientName).trim())
      ),
    ];

    const clients: any = await Client.findAll({
      attributes: ["id", "name"],
      where: {
        name: {
          [Op.in]: uniqueClients,
        },
      },
      paranoid: false,
    });

    let index = 0;
    let clientsArray: any = [];
    for (const clientDetail of clientDetails) {
      index++;

      const v = {
        clientName: "required|string",
      };
      const errors = await Utils.validateParams(clientDetail, v);
      if (errors) {
        return {
          success: false,
          errors: `Client record (${index}) : ${errors}`,
        };
      }

      const clientExists = clients.find(
        (client: any) => client.name == String(clientDetail.clientName).trim()
      );
      // if (!clientExists) {
      //   return {
      //     success: false,
      //     error: `Client record (${index}) : client not found`,
      //   };
      // }
      if (clientExists) {
        clientsArray.push({
          aspId: aspId,
          clientId: clientExists.dataValues.id,
        });
      }
    }

    const clientIds = clientsArray.map(
      (clientArray: any) => clientArray.clientId
    );
    await AspClient.destroy({
      where: {
        aspId: aspId,
        clientId: {
          [Op.notIn]: clientIds,
        },
      },
      force: true,
      transaction: transaction,
    });

    for (const clientArray of clientsArray) {
      const aspClientExists = await AspClient.findOne({
        attributes: ["id"],
        where: {
          aspId: clientArray.aspId,
          clientId: clientArray.clientId,
        },
        transaction: transaction,
        paranoid: false,
      });
      if (aspClientExists) {
        await AspClient.update(
          {
            updatedAt: new Date(),
          },
          {
            where: {
              id: aspClientExists.dataValues.id,
            },
            transaction: transaction,
          }
        );
      } else {
        await AspClient.create(
          {
            aspId: clientArray.aspId,
            clientId: clientArray.clientId,
          },
          {
            transaction: transaction,
          }
        );
      }
    }

    return {
      success: true,
      message: "ASP clients mapped successfully",
    };
  } catch (error: any) {
    throw error;
  }
};

export default new AspController();
