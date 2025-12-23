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
} from "../database/models/index";
import {
  generateMultipleCSVExport,
  generateMultipleXLSXAndXLSXExport,
} from "../middleware/excelMiddleware";
import xlsx from "xlsx";
import { Validator } from "node-input-validator";
import { Request, Response } from "express";
import moment, { MomentInput } from "moment";
import axios from "axios";
import config from "../config/config.json";
import sequelize from "../database/connection";
const fs = require("fs").promises;
import Utils from "../lib/utils";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class AspBkController {
  private static defaultLimit: number = 5;
  private static defaultOffset: number = 0;
  constructor() {}

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
      const { limit, offset, stateId, cityId, apiType, search, status } =
        req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};
      if (stateId !== undefined) {
        where.stateId = stateId;
      }
      if (cityId !== undefined) {
        where.cityId = cityId;
      }

      let asps: any;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
          ];
        }

        asps = await Asp.findAll({
          where,
          attributes: ["id", "name", "code", "workshopName"],
          order: [["id", "asc"]],
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
            Sequelize.literal(`state.name LIKE "%${search}%"`),
            Sequelize.literal(`city.name LIKE "%${search}%"`),
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
        let limitValue: number = AspBkController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = AspBkController.defaultOffset;

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
              required: true,
              attributes: ["id", "name"],
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
      const { aspId } = req.query;
      const asp = await Asp.findByPk(aspId);
      if (!asp) {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      } else {
        return res.status(200).json({
          success: true,
          message: "ASP found",
          data: asp,
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
      let aspMechanicsData = null;

      if (aspId) {
        const aspExists: any = await Asp.findOne({
          where: {
            id: aspId,
          },
          include: [
            {
              model: AspMechanic,
              required: false,
              paranoid: false,
            },
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
        if (!getEntityUser.data.success) {
          return res.status(200).json({
            success: false,
            error: getEntityUser.data.error,
          });
        }

        if (aspExists.aspMechanics.length > 0) {
          for (const aspMechanic of aspExists.aspMechanics) {
            //GET ASP MECHANIC USER DETAILS
            const getEntityUser: any = await axios.get(
              `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=143&entityId=${aspMechanic.dataValues.id}`
            );
            if (!getEntityUser.data.success) {
              return res.status(200).json({
                success: false,
                error: getEntityUser.data.error,
              });
            }
            const aspMechanicUserData = getEntityUser.data.data;
            aspMechanic.dataValues.status = aspMechanic.dataValues.deletedAt
              ? 0
              : 1;
            aspMechanic.dataValues.userName = aspMechanicUserData.userName;
            aspMechanic.dataValues.user = {
              id: aspMechanicUserData.id,
              roleId: aspMechanicUserData.roleId,
              userName: aspMechanicUserData.userName,
            };
          }
        }

        aspData = aspExists;
        userData = getEntityUser.data.data;
      }

      //EXTRAS
      const getServiceRegionalManagers: any = await axios.get(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getList}?apiType=dropdown&roleId=6`
      );
      if (!getServiceRegionalManagers.data.success) {
        return res.status(200).json(getServiceRegionalManagers.data);
      }
      const serviceRegionalManagers = getServiceRegionalManagers.data.data;
      const states = await State.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });
      const salutations = await Config.findAll({
        where: {
          typeId: 9, //SALUTATIONS
        },
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });
      const workingHours = await Config.findAll({
        where: {
          typeId: 10, //WORKING HOURS
        },
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });
      const performances = await Config.findAll({
        where: {
          typeId: 24, //PERFORMANCES
        },
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });
      const priorities = await Config.findAll({
        where: {
          typeId: 25, //PRIORITIES
        },
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });
      const tiers = await Config.findAll({
        where: {
          typeId: 29, //TIERS
        },
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

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
        const { isOwnPatrol, hasMechanic, ...restAspData } = aspData.dataValues;
        asp = {
          ...restAspData,
          isOwnPatrol: isOwnPatrol ? 1 : 0,
          hasMechanic: hasMechanic ? 1 : 0,
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
        },
        asp: asp,
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

  saveAndUpdate = async (req: Request, res: Response) => {
    return save(req, res);
  };

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = new Validator(payload, {
        status: "required|numeric",
        aspIds: "required|array",
        "aspIds.*": "required",
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

      for (const aspId of aspIds) {
        const aspExists: any = await Asp.findOne({
          attributes: ["id", "hasMechanic"],
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

        if (aspExists.dataValues.hasMechanic == 1) {
          if (aspExists.aspMechanics.length > 0) {
            const aspMechanicIds = aspExists.aspMechanics.map(
              (aspMechanic: any) => aspMechanic.dataValues.id
            );

            await AspMechanic.update(
              {
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
      }

      //GET ASP USER DETAILS
      const getAllAspEntityUsers: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
        {
          userTypeId: 142, //ASP
          entityIds: aspIds,
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
      const v = new Validator(payload, {
        aspIds: "required|array",
        "aspIds.*": "required",
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

      const { aspIds } = payload;
      if (aspIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one ASP",
        });
      }

      for (const aspId of aspIds) {
        const aspExists: any = await Asp.findOne({
          attributes: ["id", "hasMechanic"],
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

        await Asp.destroy({
          where: {
            id: aspId,
          },
          force: true,
          transaction: transaction,
        });

        if (aspExists.dataValues.hasMechanic == 1) {
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
      }

      //GET ASP USER DETAILS
      const getAllAspEntityUsers: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
        {
          userTypeId: 142, //ASP
          entityIds: aspIds,
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

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ASP deleted successfully",
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
            Sequelize.literal("( SELECT IF (isOwnPatrol = 1, 'Yes', 'No') )"),
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
            Sequelize.literal("( SELECT IF (hasMechanic = 1, 'Yes', 'No') )"),
            "hasMechanic",
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
      if (!isValidExportFormat(format)) {
        return res.status(200).json({
          success: false,
          error: "Invalid or missing export format",
        });
      }

      const where: any = {};
      if (startDate && endDate) {
        const dateFilter = getDateFilter(startDate, endDate);
        where.createdAt = dateFilter;
      }

      const AspData = await Asp.findAll({ where, paranoid: false });
      if (!AspData || AspData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Asp data not found",
        });
      }

      let aspDetailsArray: any[] = [];
      let mechanicDetailsArray: any[] = [];
      for (const aspData of AspData) {
        const [
          tier,
          salutation,
          workingHour,
          performance,
          priority,
          state,
          city,
        ] = await Promise.all([
          Config.findOne({ where: { id: aspData.dataValues.tierId } }),
          Config.findOne({ where: { id: aspData.dataValues.salutationId } }),
          Config.findOne({ where: { id: aspData.dataValues.workingHourId } }),
          Config.findOne({ where: { id: aspData.dataValues.performanceId } }),
          Config.findOne({ where: { id: aspData.dataValues.priorityId } }),
          State.findOne({
            where: { id: aspData.dataValues.stateId },
            paranoid: false,
          }),
          City.findOne({
            where: { id: aspData.dataValues.cityId },
            paranoid: false,
          }),
        ]);

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
          "Own Patrol": aspData.dataValues.isOwnPatrol == 1 ? "Yes" : "No",
          "Has Mechanic": aspData.dataValues.hasMechanic == 1 ? "Yes" : "No",
          "Address Line One": aspData.dataValues.addressLineOne,
          "Address Line Two": aspData.dataValues.addressLineTwo,
          State: state?.dataValues.name || null,
          City: city?.dataValues.name || null,
          Pincode: aspData.dataValues.pincode,
          Location: aspData.dataValues.location,
          Latitude: aspData.dataValues.latitude,
          Longitude: aspData.dataValues.longitude,
          "Created At": moment(aspData.dataValues.createdAt)
            .utcOffset(330)
            .format("DD/MM/YYYY hh:mm A"),
          Status: aspData.dataValues.deletedAt ? "Inactive" : "Active",
        };
        aspDetailsArray.push(aspDetails);

        const mechanicData = await AspMechanic.findAll({
          where: { aspId: aspData.dataValues.id },
          attributes: { exclude: ["id", "updatedAt"] },
          paranoid: false,
        });

        if (mechanicData && mechanicData.length > 0) {
          for (const mechanic of mechanicData) {
            const [mechanicPerformance, mechanicPriority] = await Promise.all([
              Config.findOne({
                where: { id: mechanic.dataValues.performanceId },
              }),
              Config.findOne({ where: { id: mechanic.dataValues.priorityId } }),
            ]);

            const mechanicDetails = {
              "ASP Code": aspDetails?.["ASP Code"] || null,
              Name: mechanic.dataValues.name,
              Code: mechanic.dataValues.code,
              Email: mechanic.dataValues.email,
              "Contact Number": mechanic.dataValues.contactNumber,
              "Alternate Contact Number":
                mechanic.dataValues.alternateContactNumber,
              Latitude: mechanic.dataValues.latitude,
              Longitude: mechanic.dataValues.longitude,
              Performance: mechanicPerformance?.dataValues.name || null,
              Priority: mechanicPriority?.dataValues.name || null,
              Address: mechanic.dataValues.address,
              "Created At": moment(mechanic.dataValues.createdAt)
                .utcOffset(330)
                .format("DD/MM/YYYY hh:mm A"),
              Status: mechanic.dataValues.deletedAt ? "Inactive" : "Active",
            };
            mechanicDetailsArray.push(mechanicDetails);
          }
        }
      }

      // Column Filter;
      const AspColumnNames = aspDetailsArray
        ? Object.keys(aspDetailsArray[0])
        : [];
      const AsMechanicColumnNames = mechanicDetailsArray
        ? Object.keys(mechanicDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;

      // Excel or CSV file Creation;
      if (isExcelFormat(format)) {
        buffer = generateMultipleXLSXAndXLSXExport(
          aspDetailsArray,
          AspColumnNames,
          mechanicDetailsArray,
          AsMechanicColumnNames,
          format,
          "AspDetails",
          "MechanicDetails"
        );
        // Excel file Header set;
        setExcelHeaders(res, format);
      } else if (format === "csv") {
        const { aspCsvBuffer, mechanicCsvBuffer } = generateMultipleCSVExport(
          aspDetailsArray,
          AspColumnNames,
          mechanicDetailsArray,
          AsMechanicColumnNames
        );
        // CSV Respond;
        return res.status(200).json({
          success: true,
          message: `Asp data export successfully`,
          data: {
            aspCsvBuffer,
            mechanicCsvBuffer,
          },
          format: format,
        });
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
      console.log(error);
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
      const aspMechanicErrorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      let aspImportColumns = [
        "Tier",
        "Axapta Code",
        "Salutation",
        "Name",
        "ASP Code",
        "Workshop Name",
        "Email",
        "WhatsApp Number",
        "Contact Number",
        "Working Hours",
        "Performance",
        "Priority",
        "Regional Manager",
        "Regional Manager Mobile Number",
        "Own Patrol",
        "Has Mechanic",
        "Username",
        "Password",
        "Change Password",
        "Status",
        "Address Line One",
        "Address Line Two",
        "State",
        "City",
        "Pincode",
        "Location",
        "Latitude",
        "Longitude",
      ];

      let aspMechanicImportColumns = [
        "ASP Code",
        "Name",
        "Code",
        "Email",
        "Contact Number",
        "Alternate Contact Number",
        "Latitude",
        "Longitude",
        "Performance",
        "Priority",
        "Address",
        "Username",
        "Password",
        "Change Password",
        "Status",
      ];

      const aspSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];
      const aspMechanicSheets = Object.values(inData)[1]
        ? Object.values(inData)[1]["data"]
        : [];
      for (const aspSheet of aspSheets) {
        aspImportColumns.forEach((importColumn) => {
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
          "Regional Manager": aspSheet["Regional Manager"]
            ? String(aspSheet["Regional Manager"])
            : null,
          "Regional Manager Mobile Number": aspSheet[
            "Regional Manager Mobile Number"
          ]
            ? String(aspSheet["Regional Manager Mobile Number"])
            : null,
          "Own Patrol": aspSheet["Own Patrol"]
            ? String(aspSheet["Own Patrol"])
            : null,
          "Has Mechanic": aspSheet["Has Mechanic"]
            ? String(aspSheet["Has Mechanic"])
            : null,
          Username: aspSheet["Username"] ? String(aspSheet["Username"]) : null,
          Password: aspSheet["Password"] ? String(aspSheet["Password"]) : null,
          "Change Password": aspSheet["Change Password"]
            ? String(aspSheet["Change Password"])
            : null,
          Status: aspSheet["Status"] ? String(aspSheet["Status"]) : null,
          "Address Line One": aspSheet["Address Line One"],
          "Address Line Two": aspSheet["Address Line Two"],
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

          //ASP
          let aspId = null;
          let userId = null;
          if (record.code) {
            const trimedCode = record.code.trim();
            const aspAlreadyExists = await Asp.findOne({
              where: {
                code: trimedCode,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (aspAlreadyExists) {
              aspId = aspAlreadyExists.dataValues.id;

              //USER
              const getAspUser: any = await axios.get(
                `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=142&entityId=${aspId}`
              );
              if (getAspUser.data.success) {
                userId = getAspUser.data.data.id;
              }
            }
          }

          //RM
          let rmId = null;
          if (record.regionalManager && record.regionalManagerMobileNumber) {
            const regionalManagerServiceResponse: any = await axios.post(
              `${userServiceUrl}/user/${userServiceEndpoint.getRegionalManager}`,
              {
                name: record.regionalManager,
                mobileNumber: record.regionalManagerMobileNumber,
              }
            );
            if (
              regionalManagerServiceResponse.data &&
              regionalManagerServiceResponse.data.success
            ) {
              rmId = regionalManagerServiceResponse.data.user.id;
            }
          }

          //PERFORMANCE
          let performanceName: any = null;
          if (record.performanceId) {
            const trimedPerformanceName = record.performanceId.trim();
            performanceName = await Config.findOne({
              where: {
                name: trimedPerformanceName,
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
            const trimedPriorityName = record.priorityId.trim();
            priorityName = await Config.findOne({
              where: {
                name: trimedPriorityName,
                typeId: 25, //ASP PRIORITIES
              },
            });
          }
          const priorityId = priorityName ? priorityName.dataValues.id : 0;

          //TIER
          let tierName: any = null;
          if (record.tierId) {
            const trimedTierName = record.tierId.trim();
            tierName = await Config.findOne({
              where: {
                name: trimedTierName,
                typeId: 29, //ASP TIERS
              },
            });
          }
          const tierId = tierName ? tierName.dataValues.id : 0;

          //Salutation
          let salutationName: any = null;
          if (record.salutationId) {
            const trimedSalutationName = record.salutationId.trim();
            salutationName = await Config.findOne({
              where: {
                name: trimedSalutationName,
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
            const trimedWorkingHourName = record.workingHourId.trim();
            workingHourName = await Config.findOne({
              where: {
                name: trimedWorkingHourName,
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
            const trimedStateName = record.stateId.trim();
            stateName = await State.findOne({
              where: { name: trimedStateName },
              paranoid: false,
            });
          }
          const stateId = stateName ? stateName.dataValues.id : 0;

          //CITY
          let cityName: any = null;
          if (stateId && record.cityId) {
            const trimedCityName = record.cityId.trim();
            cityName = await City.findOne({
              where: {
                name: trimedCityName,
                stateId: stateId,
              },
              paranoid: false,
            });
          }
          const cityId = cityName ? cityName.dataValues.id : 0;

          record.aspId = aspId;
          record.userId = userId;
          record.tierId = tierId;
          record.salutationId = salutationId;
          record.workingHourId = workingHourId;
          record.performanceId = performanceId;
          record.priorityId = priorityId;
          record.rmId = rmId;
          record.businessHourId = null; //doubt
          let trimedIsOwnPatrol = null;
          if (record.isOwnPatrol) {
            trimedIsOwnPatrol = record.isOwnPatrol.trim();
          }
          record.isOwnPatrol =
            trimedIsOwnPatrol && trimedIsOwnPatrol.toLowerCase() === "yes"
              ? 1
              : 0;
          let trimedHasMechanic = null;
          if (record.hasMechanic) {
            trimedHasMechanic = record.hasMechanic.trim();
          }
          record.hasMechanic =
            trimedHasMechanic && trimedHasMechanic.toLowerCase() === "yes"
              ? 1
              : 0;
          let trimedChangePassword = null;
          if (record.changePassword) {
            trimedChangePassword = record.changePassword.trim();
          }
          record.changePassword =
            trimedChangePassword && trimedChangePassword.toLowerCase() === "yes"
              ? 1
              : 0;
          record.stateId = stateId;
          record.cityId = cityId;
          record.authUserId = req.body.authUserId;
          record.createdById = req.body.authUserId;
          record.updatedById = req.body.authUserId;
          let trimedStatus = null;
          if (record.status) {
            trimedStatus = record.status.trim();
          }
          record.status =
            trimedStatus && trimedStatus.toLowerCase() === "active" ? 1 : 0;

          //ASP MECHANICS
          const trimedAspCode = String(reArrangedAsps["ASP Code"])
            .trim()
            .toLowerCase();
          let aspMechanicRecords = [];
          let aspMechanicExcelRecords = [];
          if (
            record.hasMechanic == 1 &&
            aspMechanicSheets &&
            aspMechanicSheets.length > 0
          ) {
            const aspMechanics = aspMechanicSheets.filter((mechanic: any) => {
              const trimedAspMechanicCode = String(mechanic["ASP Code"])
                .trim()
                .toLowerCase();
              return trimedAspMechanicCode === trimedAspCode;
            });

            let aspMechanicIndex = 0;
            for (const aspMechanic of aspMechanics) {
              aspMechanicImportColumns.forEach((aspMechanicImportColumn) => {
                if (!aspMechanic.hasOwnProperty(aspMechanicImportColumn)) {
                  aspMechanic[aspMechanicImportColumn] = "";
                }
              });
              aspMechanicIndex++;

              let reArrangedAspMechanic: any = {
                index: aspMechanicIndex,
                "ASP Code": aspMechanic["ASP Code"]
                  ? String(aspMechanic["ASP Code"])
                  : null,
                Name: aspMechanic["Name"],
                Code: aspMechanic["Code"] ? String(aspMechanic["Code"]) : null,
                Email: aspMechanic["Email"],
                "Contact Number": aspMechanic["Contact Number"]
                  ? String(aspMechanic["Contact Number"])
                  : null,
                "Alternate Contact Number": aspMechanic[
                  "Alternate Contact Number"
                ]
                  ? String(aspMechanic["Alternate Contact Number"])
                  : null,
                Latitude: aspMechanic["Latitude"]
                  ? String(aspMechanic["Latitude"])
                  : null,
                Longitude: aspMechanic["Longitude"]
                  ? String(aspMechanic["Longitude"])
                  : null,
                Performance: aspMechanic["Performance"]
                  ? String(aspMechanic["Performance"])
                  : null,
                Priority: aspMechanic["Priority"]
                  ? String(aspMechanic["Priority"])
                  : null,
                Address: aspMechanic["Address"],
                Username: aspMechanic["Username"]
                  ? String(aspMechanic["Username"])
                  : null,
                Password: aspMechanic["Password"]
                  ? String(aspMechanic["Password"])
                  : null,
                "Change Password": aspMechanic["Change Password"]
                  ? String(aspMechanic["Change Password"])
                  : null,
                Status: aspMechanic["Status"]
                  ? String(aspMechanic["Status"])
                  : null,
              };

              const aspMechanicRecord: any = {};
              const aspMechanicKeyMapping: any = {
                aSPCode: "aspCode",
                performance: "performanceId",
                priority: "priorityId",
                username: "userName",
              };

              for (const reArrangedAspMechanicKey in reArrangedAspMechanic) {
                let transformedKey = reArrangedAspMechanicKey
                  .replace(/\s+/g, "")
                  .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                    index === 0 ? word.toLowerCase() : word.toUpperCase()
                  );

                // Check if key has a mapping, use the mapping if available
                transformedKey =
                  aspMechanicKeyMapping[transformedKey] || transformedKey;
                aspMechanicRecord[transformedKey] =
                  reArrangedAspMechanic[reArrangedAspMechanicKey];
              }

              //ASP MECHANIC
              let aspMechanicId = null;
              let aspMechanicUserId = null;
              if (aspId && aspMechanicRecord.code) {
                const trimedAspMechanicCode = aspMechanicRecord.code.trim();
                const aspMechanicAlreadyExists = await AspMechanic.findOne({
                  where: {
                    aspId: aspId,
                    code: trimedAspMechanicCode,
                  },
                  attributes: ["id"],
                  paranoid: false,
                });
                if (aspMechanicAlreadyExists) {
                  aspMechanicId = aspMechanicAlreadyExists.dataValues.id;

                  //ASP MECHANIC USER
                  const getAspMechanicUser: any = await axios.get(
                    `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=143&entityId=${aspMechanicId}`
                  );
                  if (getAspMechanicUser.data.success) {
                    aspMechanicUserId = getAspMechanicUser.data.data.id;
                  }
                }
              }

              //ASP MECHANIC PERFORMANCE
              let aspMechanicPerformanceName: any = null;
              if (aspMechanicRecord.performanceId) {
                const trimedAspMechanicPerformanceName =
                  aspMechanicRecord.performanceId.trim();
                aspMechanicPerformanceName = await Config.findOne({
                  where: {
                    name: trimedAspMechanicPerformanceName,
                    typeId: 24, //ASP PERFORMANCES
                  },
                });
              }
              const aspMechanicPerformanceId = aspMechanicPerformanceName
                ? aspMechanicPerformanceName.dataValues.id
                : 0;

              //ASP MECHANIC PRIORITY
              let aspMechanicPriorityName: any = null;
              if (aspMechanicRecord.priorityId) {
                const trimedAspMechanicPriorityName =
                  aspMechanicRecord.priorityId.trim();
                aspMechanicPriorityName = await Config.findOne({
                  where: {
                    name: trimedAspMechanicPriorityName,
                    typeId: 25, //ASP PRIORITIES
                  },
                });
              }
              const aspMechanicPriorityId = aspMechanicPriorityName
                ? aspMechanicPriorityName.dataValues.id
                : 0;

              aspMechanicRecord.aspMechanicId = aspMechanicId;
              aspMechanicRecord.businessHourId = null; //doubt
              aspMechanicRecord.performanceId = aspMechanicPerformanceId;
              aspMechanicRecord.priorityId = aspMechanicPriorityId;
              aspMechanicRecord.userId = aspMechanicUserId;
              let trimedAspMechanicChangePassword = null;
              if (aspMechanicRecord.changePassword) {
                trimedAspMechanicChangePassword =
                  aspMechanicRecord.changePassword.trim();
              }
              aspMechanicRecord.changePassword =
                trimedAspMechanicChangePassword &&
                trimedAspMechanicChangePassword.toLowerCase() === "yes"
                  ? 1
                  : 0;
              let trimedAspMechanicStatus = null;
              if (aspMechanicRecord.status) {
                trimedAspMechanicStatus = aspMechanicRecord.status.trim();
              }
              aspMechanicRecord.status =
                trimedAspMechanicStatus &&
                trimedAspMechanicStatus.toLowerCase() === "active"
                  ? 1
                  : 0;
              aspMechanicRecords.push(aspMechanicRecord);
              aspMechanicExcelRecords.push(reArrangedAspMechanic);
            }
          }
          record.aspMechanics = aspMechanicRecords;

          //SAVE
          const output = await save({}, {}, record);
          if (output.success === false) {
            if (output.type == "asp") {
              aspErrorData.push({
                ...reArrangedAsps,
                Error: output.errors ? output.errors.join(",") : output.error,
              });
            } else if (output.type == "aspMechanic") {
              const aspMechanicOriginalData = aspMechanicExcelRecords.filter(
                (aspMechanicExcelRecord: any) => {
                  return aspMechanicExcelRecord["index"] === output.data.index;
                }
              );
              aspMechanicErrorData.push({
                ...aspMechanicOriginalData[0],
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

      if (aspErrorData.length === 0 && aspMechanicErrorData.length === 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Error Buffer Generation;
      aspImportColumns.push("Error");
      aspMechanicImportColumns.push("Error");
      const buffer = generateMultipleXLSXAndXLSXExport(
        aspErrorData,
        aspImportColumns,
        aspMechanicErrorData,
        aspMechanicImportColumns,
        "xlsx",
        "AspDetails",
        "MechanicDetails"
      );
      setExcelHeaders(res, "xlsx");

      //Respond
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

  subServiceMapping = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        aspCode: "required|string",
        subServiceDetails: "required|array",
        "subServiceDetails.*": "required",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      if (payload.subServiceDetails.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP sub services are required",
        });
      }

      const trimmedAspCode = String(payload.aspCode).trim();
      const aspExists: any = await Asp.findOne({
        attributes: ["id"],
        where: {
          code: trimmedAspCode,
        },
        paranoid: false,
      });
      if (!aspExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      let index = 0;
      let subServicesArray: any = [];
      for (const subServiceDetail of payload.subServiceDetails) {
        index++;

        const v = {
          serviceName: "required|string",
          subServiceName: "required|string",
        };
        const errors = await Utils.validateParams(subServiceDetail, v);
        if (errors) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            errors: `Sub service record (${index}) : ${errors}`,
          });
        }

        const trimmedServiceName = String(subServiceDetail.serviceName).trim();
        const serviceExists: any = await Service.findOne({
          attributes: ["id"],
          where: {
            name: trimmedServiceName,
          },
          paranoid: false,
        });
        if (!serviceExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Sub service record (${index}) : service not found`,
          });
        }

        const trimmedSubServiceName = String(
          subServiceDetail.subServiceName
        ).trim();
        const subServiceExists: any = await SubService.findOne({
          attributes: ["id", "serviceId"],
          where: {
            name: trimmedSubServiceName,
            serviceId: serviceExists.dataValues.id,
          },
          paranoid: false,
        });
        if (!subServiceExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Sub service record (${index}) : sub service not found`,
          });
        }

        subServicesArray.push({
          aspId: aspExists.dataValues.id,
          subServiceId: subServiceExists.dataValues.id,
        });
      }

      await AspSubService.destroy({
        where: {
          aspId: aspExists.dataValues.id,
        },
        force: true,
        transaction: transaction,
      });

      for (const subServiceArray of subServicesArray) {
        await AspSubService.findOrCreate({
          where: {
            aspId: subServiceArray.aspId,
            subServiceId: subServiceArray.subServiceId,
          },
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ASP sub services mapped successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
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
    const v = new Validator(payload, {
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
      userId: "numeric",
      userName: "required|string|minLength:10|maxLength:10",
      password: "string",
      changePassword: "numeric",
      status: "required|numeric",
      aspMechanics: "requiredIf:hasMechanic,1|array",
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

    //CUSTOM VALIDATIONS
    const salutation = await Config.findOne({
      where: {
        id: inputData.salutationId,
        typeId: 9, //SALUTATIONS
      },
    });
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
    const aspWorkingHour = await Config.findOne({
      where: {
        id: inputData.workingHourId,
        typeId: 10, //WORKING HOURS
      },
    });
    if (!aspWorkingHour) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "ASP Working Hour not found",
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
    const aspPerformance = await Config.findOne({
      where: {
        id: inputData.performanceId,
        typeId: 24, //ASP PERFORMANCES
      },
    });
    if (!aspPerformance) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "ASP Performance not found",
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
    const aspPriority = await Config.findOne({
      where: {
        id: inputData.priorityId,
        typeId: 25, //ASP PRIORITIES
      },
    });
    if (!aspPriority) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "ASP Priority not found",
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
    const state = await State.findByPk(inputData.stateId);
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
    const city = await City.findByPk(inputData.cityId);
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

    //GET ASP ROLE DETAILS
    const getAspRoleDetail: any = await axios.get(
      `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=ASP`
    );
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

    //GET ASP MECHANIC ROLE DETAILS
    const getAspMechanicRoleDetail: any = await axios.get(
      `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=ASP Mechanic`
    );
    if (!getAspMechanicRoleDetail.data.success) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: getAspMechanicRoleDetail.data.error,
          data: payload,
          type: "asp",
        };
      } else {
        return res.status(200).json({
          success: false,
          error: getAspMechanicRoleDetail.data.error,
        });
      }
    }
    const aspMechanicRoleId = getAspMechanicRoleDetail.data.data.id;

    //REGIONAL MANAGER VALIDATION FOR ASP IMPORT
    if (
      importData &&
      payload.regionalManager &&
      payload.regionalManagerMobileNumber
    ) {
      const regionalManagerDetail: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.getRegionalManager}`,
        {
          name: payload.regionalManager,
          mobileNumber: payload.regionalManagerMobileNumber,
        }
      );
      if (!regionalManagerDetail.data.success) {
        await transaction.rollback();
        return {
          success: false,
          error: regionalManagerDetail.data.errors
            ? `ASP: ${regionalManagerDetail.data.errors.join(",")}`
            : `ASP: ${regionalManagerDetail.data.error}`,
          data: payload,
          type: "asp",
        };
      }
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
      email: inputData.email,
      userName: inputData.userName,
      password: inputData.password,
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

    //GET EXISTING ASP MECHANICS
    const existingAspMechanics = await AspMechanic.findAll({
      where: { aspId: savedAspId },
      attributes: ["id"],
      paranoid: false,
    });

    //CHECK EXISTING(DATABASE) ASP MECHANICS EXIST IN THE GIVEN(FORM OR UPLOAD) ASP MECHANIC. IF NOT DELETE IT.
    if (existingAspMechanics.length > 0) {
      for (const existingAspMechanic of existingAspMechanics) {
        let removeExistingAspMechanic = false;
        //IF HAS MECHANIC IS 1
        if (inputData.hasMechanic == 1 && inputData.aspMechanics.length > 0) {
          const existingAspMechanicExists = inputData.aspMechanics.find(
            (givenAspMechanic: any) =>
              givenAspMechanic.aspMechanicId ==
              existingAspMechanic.dataValues.id
          );
          //NOT EXIST THEN DELETE THE EXISTING ASP MECHANIC
          if (!existingAspMechanicExists) {
            removeExistingAspMechanic = true;
          }
        } else {
          //IF HAS MECHANIC IS 0
          removeExistingAspMechanic = true;
        }

        if (removeExistingAspMechanic) {
          await AspMechanic.destroy({
            where: {
              id: existingAspMechanic.dataValues.id,
            },
            force: true,
            transaction: transaction,
          });

          //GET ASP MECHANIC USER DETAILS
          const getAspMechanicEntityUser: any = await axios.get(
            `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=143&entityId=${existingAspMechanic.dataValues.id}`
          );

          if (!getAspMechanicEntityUser.data.success) {
            await transaction.rollback();
            if (importData !== undefined) {
              return {
                success: false,
                error: getAspMechanicEntityUser.data.error,
                data: payload,
                type: "asp",
              };
            } else {
              return res.status(200).json({
                success: false,
                error: getAspMechanicEntityUser.data.error,
              });
            }
          }

          const entityUserIds: any = [];
          entityUserIds.push(getAspMechanicEntityUser.data.data.id);

          //DELETE ASP MECHANIC IN USERS
          const entityUsersDelete: any = await axios.put(
            `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.delete}`,
            {
              userIds: entityUserIds,
            }
          );
          if (!entityUsersDelete.data.success) {
            await transaction.rollback();
            if (importData !== undefined) {
              return {
                success: false,
                error: entityUsersDelete.data.errors
                  ? entityUsersDelete.data.errors.join(",")
                  : entityUsersDelete.data.error,
                data: payload,
                type: "asp",
              };
            } else {
              return res.status(200).json(entityUsersDelete.data);
            }
          }
        }
      }
    }

    //SAVE ASP MECHANIC PROCESS
    if (inputData.hasMechanic == 1 && inputData.aspMechanics.length > 0) {
      //CREATE OR UPDATE ASP MECHANICS
      for (const aspMechanic of inputData.aspMechanics) {
        const aspMechanicValidator = new Validator(aspMechanic, {
          aspMechanicId: "numeric",
          name: "required|string|minLength:3|maxLength:255",
          code: "required|string|minLength:3|maxLength:60",
          email: "email",
          contactNumber: "required|string|minLength:10|maxLength:10",
          alternateContactNumber: "string|minLength:10|maxLength:10",
          businessHourId: "numeric",
          latitude: "string|maxLength:60",
          longitude: "string|maxLength:60",
          performanceId: "required|numeric",
          priorityId: "required|numeric",
          address: "required|string",
          userId: "numeric",
          userName: "required|string|minLength:10|maxLength:10",
          password: "string",
          changePassword: "numeric",
          status: "required|numeric",
        });

        const aspMechanicMatched = await aspMechanicValidator.check();
        if (!aspMechanicMatched) {
          const aspMechanicErrors: any = [];
          Object.keys(aspMechanic).forEach((aspMechanicKey) => {
            if (aspMechanicValidator.errors[aspMechanicKey]) {
              aspMechanicErrors.push(
                `ASP Mechanic (${aspMechanicInputData.code}): ${aspMechanicValidator.errors[aspMechanicKey].message}`
              );
            }
          });
          await transaction.rollback();
          if (importData !== undefined) {
            return {
              success: false,
              errors: aspMechanicErrors,
              data: aspMechanic,
              type: "aspMechanic",
            };
          } else {
            return res.status(200).json({
              success: false,
              errors: aspMechanicErrors,
            });
          }
        }

        const {
          aspMechanicId,
          email,
          alternateContactNumber,
          businessHourId,
          ...aspMechanicInputData
        } = aspMechanic;
        //CUSTOM VALIDATIONS
        const aspMechanicPerformance = await Config.findOne({
          where: {
            id: aspMechanicInputData.performanceId,
            typeId: 24, //ASP PERFORMANCES
          },
        });
        if (!aspMechanicPerformance) {
          await transaction.rollback();
          if (importData !== undefined) {
            return {
              success: false,
              error: `Performance not found for the ASP Mechanic(${aspMechanicInputData.code})`,
              data: aspMechanic,
              type: "aspMechanic",
            };
          } else {
            return res.status(200).json({
              success: false,
              error: `Performance not found for the ASP Mechanic(${aspMechanicInputData.code})`,
            });
          }
        }
        const aspMechanicPriority = await Config.findOne({
          where: {
            id: aspMechanicInputData.priorityId,
            typeId: 25, //ASP PRIORITIES
          },
        });
        if (!aspMechanicPriority) {
          await transaction.rollback();
          if (importData !== undefined) {
            return {
              success: false,
              error: `Priority not found for the ASP Mechanic(${aspMechanicInputData.code})`,
              data: aspMechanic,
              type: "aspMechanic",
            };
          } else {
            return res.status(200).json({
              success: false,
              error: `Priority not found for the ASP Mechanic(${aspMechanicInputData.code})`,
            });
          }
        }

        if (aspMechanicId) {
          const checkAspMechanicAlreadyExists = await AspMechanic.findOne({
            where: {
              aspId: savedAspId,
              code: aspMechanicInputData.code,
              id: {
                [Op.ne]: aspMechanicId,
              },
            },
            paranoid: false,
            transaction: transaction,
          });
          if (checkAspMechanicAlreadyExists) {
            await transaction.rollback();
            if (importData !== undefined) {
              return {
                success: false,
                error: `ASP Mechanic(${aspMechanicInputData.code}) code is already taken`,
                data: aspMechanic,
                type: "aspMechanic",
              };
            } else {
              return res.status(200).json({
                success: false,
                error: `ASP Mechanic(${aspMechanicInputData.code}) code is already taken`,
              });
            }
          }
        } else {
          const checkAspMechanicAlreadyExists = await AspMechanic.findOne({
            where: {
              aspId: savedAspId,
              code: aspMechanicInputData.code,
            },
            paranoid: false,
            transaction: transaction,
          });
          if (checkAspMechanicAlreadyExists) {
            await transaction.rollback();
            if (importData !== undefined) {
              return {
                success: false,
                error: `ASP Mechanic(${aspMechanicInputData.code}) code is already taken`,
                data: aspMechanic,
                type: "aspMechanic",
              };
            } else {
              return res.status(200).json({
                success: false,
                error: `ASP Mechanic(${aspMechanicInputData.code}) code is already taken`,
              });
            }
          }
        }

        //IF ASP STATUS IS INACTIVE THEN ASP MECHANIC STATUS ALSO INACTIVE
        if (inputData.status == 0) {
          aspMechanicInputData.status = 0;
        }

        let aspMechanicDeletedAt = null;
        let aspMechanicDeletedById = null;
        //INACTIVE
        if (aspMechanicInputData.status == 0) {
          aspMechanicDeletedAt = new Date();
          aspMechanicDeletedById = inputData.authUserId;
        }

        let createdByOrUpdatedById: any;
        if (aspMechanicId) {
          createdByOrUpdatedById = {
            updatedById: inputData.updatedById,
          };
        } else {
          createdByOrUpdatedById = {
            createdById: inputData.createdById,
          };
        }

        const aspMechanicData: any = {
          ...aspMechanicInputData,
          aspId: savedAspId,
          email: email ? email : null,
          alternateContactNumber: alternateContactNumber
            ? alternateContactNumber
            : null,
          businessHourId: businessHourId ? businessHourId : null,
          deletedById: aspMechanicDeletedById,
          deletedAt: aspMechanicDeletedAt,
        };

        let aspMechanicUserEntityId: any;
        if (aspMechanicId) {
          await AspMechanic.update(aspMechanicData, {
            where: {
              id: aspMechanicId,
            },
            paranoid: false,
            transaction: transaction,
          });
          aspMechanicUserEntityId = aspMechanicId;
        } else {
          const newAspMechanic = await AspMechanic.create(aspMechanicData, {
            transaction: transaction,
          });
          aspMechanicUserEntityId = newAspMechanic.dataValues.id;
        }

        const aspMechanicUserData = {
          userId: aspMechanicInputData.userId,
          roleId: aspMechanicRoleId,
          userTypeId: 143, //ASP MECHANIC
          entityId: aspMechanicUserEntityId,
          code: aspMechanicInputData.code,
          name: aspMechanicInputData.name,
          mobileNumber: aspMechanicInputData.contactNumber,
          email: aspMechanicInputData.email,
          userName: aspMechanicInputData.userName,
          password: aspMechanicInputData.password,
          address: aspMechanicInputData.address,
          changePassword: aspMechanicInputData.changePassword,
          status: aspMechanicInputData.status,
          deletedById: aspMechanicDeletedById,
          ...createdByOrUpdatedById,
        };

        //SAVE USER ENTITY
        const saveAspMechanicUserEntity = await axios.post(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
          aspMechanicUserData
        );
        if (!saveAspMechanicUserEntity.data.success) {
          await transaction.rollback();
          const errorObject = {
            success: false,
            error: saveAspMechanicUserEntity.data.errors
              ? `ASP Mechanic (${
                  aspMechanicInputData.code
                }): ${saveAspMechanicUserEntity.data.errors.join(",")}`
              : `ASP Mechanic (${aspMechanicInputData.code}): ${saveAspMechanicUserEntity.data.error}`,
          };
          if (importData !== undefined) {
            return {
              ...errorObject,
              data: aspMechanic,
              type: "aspMechanic",
            };
          } else {
            return res.status(200).json(errorObject);
          }
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
    console.log(error);
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

//ASP Export Sub Functions;
//Format Validation;
function isValidExportFormat(format: string | undefined): boolean {
  return format !== undefined && ["xlsx", "xls", "csv"].includes(format);
}

//Date Filter Using StartDate and EndDate;
function getDateFilter(
  startDate: string | undefined,
  endDate: string | undefined
): any {
  if (startDate !== undefined && endDate !== undefined) {
    const startOfDay = moment(startDate as MomentInput)
      .startOf("day")
      .format("YYYY-MM-DD HH:mm:ss");
    const endOfDay = moment(endDate as MomentInput)
      .endOf("day")
      .format("YYYY-MM-DD HH:mm:ss");
    return { [Op.between]: [startOfDay, endOfDay] };
  }
  return undefined;
}

//Excel format Checking;
function isExcelFormat(format: string | undefined): boolean {
  return format === "xlsx" || format === "xls";
}

//Excel File Header Setting;
function setExcelHeaders(res: any, format: string): void {
  if (format === "xlsx") {
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
  } else if (format === "xls") {
    res.setHeader("Content-Type", "application/vnd.ms-excel");
  }
}

export default new AspBkController();
