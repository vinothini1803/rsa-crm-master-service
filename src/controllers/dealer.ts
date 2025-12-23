import { Op, Sequelize } from "sequelize";
import {
  Client,
  Dealer,
  State,
  City,
  Config,
  DropDealer,
} from "../database/models/index";
import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";
import xlsx from "xlsx";
import { Validator } from "node-input-validator";
import moment, { MomentInput } from "moment-timezone";
import { Request, Response } from "express";
import axios from "axios";
import config from "../config/config.json";
import sequelize from "../database/connection";
import Utils from "../lib/utils";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class DealerController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;

  constructor() { }

  getFilterData = async (req: Request, res: Response) => {
    try {
      //EXTRAS
      const clients = await Client.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });
      const states = await State.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      const data = {
        extras: {
          clients,
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
        search,
        schemeId,
        loginDealerId,
        pickupDealerId,
        clientId,
        stateId,
        type,
        apiType,
        status,
        includeParanoidFalse,
        authUserId,
        authUserRoleId,
      } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      if (clientId) {
        where.clientId = clientId;
      }

      //IF IT IS FINANCE ADMIN ROLE THEN GET ONLY FINANCE ADMIN DEALERS
      if (authUserRoleId == 31) {
        where.financeAdminUserId = authUserId;
      }

      let dealers: any;
      //DROPDOWN API
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
          ];
        }

        let dealerParanoid = true;
        if (includeParanoidFalse && includeParanoidFalse == 1) {
          dealerParanoid = false;
        }

        //IF IT IS A OEM SCHEME THEN PICKUP AND DROP DEALER SHOULD BE BASED ON LOGIN DEALER GROUP CODE
        // if (schemeId !== undefined && schemeId == 21 && loginDealerId) {
        //   const loginDealer = await Dealer.findOne({
        //     where: { id: loginDealerId },
        //   });
        //   if (loginDealer && loginDealer.dataValues.groupCode) {
        //     where.groupCode = loginDealer.dataValues.groupCode;
        //   } else {
        //     return res.status(200).json({
        //       success: false,
        //       error: "No data found",
        //     });
        //   }
        // }

        //USED FOR DELIVERY REQUEST CREATION PURPOSE
        if (schemeId && schemeId == 21) {
          if (type == "pickup" && loginDealerId) {
            //IF IT IS A OEM SCHEME THEN PICKUP DEALER SHOULD BE BASED ON LOGIN DEALER GROUP CODE
            const loginDealer = await Dealer.findOne({
              attributes: ["id", "groupCode"],
              where: { id: loginDealerId },
            });
            if (loginDealer && loginDealer.dataValues.groupCode) {
              where.groupCode = loginDealer.dataValues.groupCode;
            } else {
              return res.status(200).json({
                success: false,
                error: "No data found",
              });
            }
          } else if (type == "drop" && pickupDealerId) {
            //IF IT IS A OEM SCHEME THEN DROP DEALERS SHOULD BE BASED ON PICKUP DEALER DROP DEALERS
            const dropDealers: any = await DropDealer.findAll({
              attributes: ["id", "dropDealerId"],
              where: { dealerId: pickupDealerId },
            });
            if (dropDealers.length == 0) {
              return res.status(200).json({
                success: false,
                error: "Drop dealer not found",
              });
            }
            const dropDealerIds = dropDealers.map(
              (dropDealer: any) => dropDealer.dropDealerId
            );
            where.id = {
              [Op.in]: dropDealerIds,
            };
          }
        }

        // PICKUP DEALER SHOULD NOT BE INCLUDED IN DROP DEALER LIST
        if (
          type !== undefined &&
          type == "drop" &&
          pickupDealerId !== undefined
        ) {
          where[Op.and] = [{ id: { [Op.ne]: pickupDealerId } }];
        }

        dealers = await Dealer.findAll({
          where,
          attributes: ["id", "name", "code"],
          paranoid: dealerParanoid,
          order: [["id", "asc"]],
        });

        if (dealers.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        // LIST API

        if (stateId) {
          where.stateId = stateId;
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

        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
            Sequelize.literal(`client.name LIKE "%${search}%"`),
            Sequelize.literal(`state.name LIKE "%${search}%"`),
            Sequelize.literal(`city.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (dealer.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = DealerController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = DealerController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        dealers = await Dealer.findAndCountAll({
          where,
          attributes: [
            "id",
            "groupCode",
            "name",
            "code",
            "mobileNumber",
            "email",
            [Sequelize.literal("( SELECT client.name)"), "clientName"],
            [Sequelize.literal("( SELECT state.name)"), "stateName"],
            [Sequelize.literal("( SELECT city.name)"), "cityName"],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(dealer.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (dealer.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: Client,
              as: "client",
              required: true,
              attributes: ["id", "name"],
            },
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

        if (dealers.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: dealers,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getPickupAndDropDealerDetail = async (req: any, res: any) => {
    try {
      const { pickupDealerId, dropDealerId, setParanoidFalse } = req.query;
      const paranoid = setParanoidFalse == "true" ? false : true;

      const attributesToInclude = [
        "code",
        "name",
        "mobileNumber",
        "email",
        "addressLineOne",
        "addressLineTwo",
        "correspondenceAddress",
        "stateId",
        "cityId",
        "area",
        "pincode",
        "lat",
        "long",
      ];

      const pickupDealerData = await Dealer.findByPk(pickupDealerId, {
        attributes: attributesToInclude,
        include: [
          {
            model: State,
            attributes: ["name"],
          },
          {
            model: City,
            attributes: ["name"],
          },
        ],
        paranoid: paranoid,
      });
      if (!pickupDealerData) {
        return res.status(200).json({
          success: false,
          error: "Pickup dealer not found",
        });
      }
      const dropDealerData = await Dealer.findByPk(dropDealerId, {
        attributes: attributesToInclude,
        include: [
          {
            model: State,
            attributes: ["name"],
          },
          {
            model: City,
            attributes: ["name"],
          },
        ],
        paranoid: paranoid,
      });
      if (!dropDealerData) {
        return res.status(200).json({
          success: false,
          error: "Drop dealer not found",
        });
      }
      const dealerData = { pickupDealerData, dropDealerData };

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: dealerData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  //Email, SMS, Delivery Request purpose;
  getDealerDetail = async (req: any, res: any) => {
    try {
      const { dealerId, setParanoidFalse } = req.query;
      let paranoid = false; //DO NOT CHANGE THE VALUE TO TRUE. IT WAS USED IN MANY FUNCTIONS.
      if (setParanoidFalse == "true") {
        paranoid = false;
      } else if (setParanoidFalse == "false") {
        paranoid = true;
      }

      const dealer: any = await Dealer.findByPk(dealerId, {
        attributes: [
          "id",
          "clientId",
          "email",
          "mobileNumber",
          "name",
          "code",
          "groupCode",
        ],
        paranoid: paranoid,
      });

      if (!dealer) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: dealer,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  // TO GET UNBILLED DEALER DELIVERY REQUESTS PURPOSE
  getDealerDetailByCode = async (req: any, res: any) => {
    try {
      const { dealerCode } = req.query;

      const dealer: any = await Dealer.findOne({
        where: {
          code: dealerCode,
        },
        attributes: [
          "id",
          "clientId",
          "email",
          "mobileNumber",
          "name",
          "code",
          "groupCode",
        ],
        paranoid: false,
      });

      if (!dealer) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: dealer,
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
      const { dealerId } = req.query;
      let dealerData = null;
      let userData = null;

      if (dealerId) {
        const dealerExists: any = await Dealer.findOne({
          where: {
            id: dealerId,
          },
          paranoid: false,
          include: [
            {
              model: City,
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
            {
              model: DropDealer,
              as: "dropDealers",
              attributes: ["id", "dropDealerId"],
              required: false,
              include: [
                {
                  model: Dealer,
                  as: "dropDealer",
                  attributes: ["id", "name"],
                  required: false,
                },
              ],
            },
          ],
        });

        if (!dealerExists) {
          return res.status(200).json({
            success: false,
            error: "Dealer not found",
          });
        }

        //GET DEALER USER DETAILS
        const getEntityUser: any = await axios.get(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=140&entityId=${dealerId}`
        );
        if (!getEntityUser.data.success) {
          return res.status(200).json({
            success: false,
            error: getEntityUser.data.error,
          });
        }

        dealerData = dealerExists;
        userData = getEntityUser.data.data;
      }

      //EXTRAS
      const clients = await Client.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });
      const states = await State.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });
      const types = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 22, //DEALER TYPES
        },
        order: [["id", "asc"]],
      });
      const zones = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 23, //DEALER ZONES
        },
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

      let dealer = null;
      if (dealerData) {
        const {
          isExclusive,
          mechanicalType,
          bodyPartType,
          autoCancelForDelivery,
          ...restDealerData
        } = dealerData.dataValues;
        dealer = {
          ...restDealerData,
          isExclusive: isExclusive ? 1 : 0,
          mechanicalType: mechanicalType ? 1 : 0,
          bodyPartType: bodyPartType ? 1 : 0,
          autoCancelForDelivery: autoCancelForDelivery ? 1 : 0,
          status: restDealerData.deletedAt ? 0 : 1,
          userName: userData ? userData.userName : null,
          user: user,
        };
      }

      const data = {
        extras: {
          clients,
          states,
          types,
          zones,
        },
        dealer: dealer,
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

  saveAndUpdate = async (req: any, res: any) => {
    return await save(req, res);
  };

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        status: "required|numeric",
        dealerIds: "required|array",
        "dealerIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { dealerIds, status, updatedById, deletedById } = payload;
      if (dealerIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one dealer",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const dealerId of dealerIds) {
        const dealerExists = await Dealer.findOne({
          where: {
            id: dealerId,
          },
          paranoid: false,
        });
        if (!dealerExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Dealer (${dealerId}) not found`,
          });
        }

        await Dealer.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: dealerId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      //GET DEALERS USER DETAILS
      const getAllEntityUsers: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
        {
          userTypeId: 140,
          entityIds: dealerIds,
        }
      );
      if (!getAllEntityUsers.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: getAllEntityUsers.data.error,
        });
      }
      const entityUserIds = getAllEntityUsers.data.data.map(
        (entityUser: any) => entityUser.id
      );

      //UPDATE DEALERS STATUS IN USER
      const entityUserUpdateStatus: any = await axios.put(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.updateStatus}`,
        {
          userIds: entityUserIds,
          status: status,
          updatedById,
          deletedById,
        }
      );
      if (!entityUserUpdateStatus.data.success) {
        await transaction.rollback();
        return res.status(200).json(entityUserUpdateStatus.data);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Dealer status updated successfully",
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
        dealerIds: "required|array",
        "dealerIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { dealerIds } = payload;
      if (dealerIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one dealer",
        });
      }

      for (const dealerId of dealerIds) {
        const dealerExists = await Dealer.findOne({
          where: {
            id: dealerId,
          },
          paranoid: false,
        });
        if (!dealerExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Dealer (${dealerId}) not found`,
          });
        }

        await Dealer.destroy({
          where: {
            id: dealerId,
          },
          force: true,
          transaction: transaction,
        });
      }

      //GET DEALERS USER DETAILS
      const getAllEntityUsers: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
        {
          userTypeId: 140,
          entityIds: dealerIds,
        }
      );
      if (!getAllEntityUsers.data.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: getAllEntityUsers.data.error,
        });
      }
      const entityUserIds = getAllEntityUsers.data.data.map(
        (entityUser: any) => entityUser.id
      );

      //DELETE DEALERS IN USERS
      const entityUsersDelete: any = await axios.put(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.delete}`,
        {
          userIds: entityUserIds,
        }
      );
      if (!entityUsersDelete.data.success) {
        await transaction.rollback();
        return res.status(200).json(entityUsersDelete.data);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Dealer deleted successfully",
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
      const { dealerId } = req.query;
      if (!dealerId) {
        return res.status(200).json({
          success: false,
          error: "Dealer ID is required",
        });
      }
      const dealer: any = await Dealer.findOne({
        where: {
          id: dealerId,
        },
        include: {
          model: DropDealer,
          as: "dropDealers",
          attributes: ["dropDealerId"],
          required: false,
        },
        paranoid: false,
      });
      if (!dealer) {
        return res.status(200).json({
          success: false,
          error: "Dealer not found",
        });
      }

      const [type, client, state, city, zone, financeAdminUserDetail]: any =
        await Promise.all([
          Config.findOne({
            where: {
              id: dealer.dataValues.typeId,
              typeId: 22, //DEALER TYPES
            },
          }),
          Client.findOne({
            where: {
              id: dealer.dataValues.clientId,
            },
            attributes: ["id", "name"],
          }),
          State.findOne({
            where: {
              id: dealer.dataValues.stateId,
            },
            attributes: ["id", "name"],
          }),
          City.findOne({
            where: {
              id: dealer.dataValues.cityId,
            },
            attributes: ["id", "name"],
          }),
          Config.findOne({
            where: {
              id: dealer.dataValues.zoneId,
              typeId: 23, //DEALER ZONES
            },
            attributes: ["id", "name"],
          }),
          //GET FINANCE ADMIN USER
          dealer.dataValues.financeAdminUserId
            ? axios.post(
              `${userServiceUrl}/user/${userServiceEndpoint.getUser}`,
              {
                id: dealer.dataValues.financeAdminUserId,
                setParanoidFalse: true,
              }
            )
            : Promise.resolve(null),
        ]);
      if (!type) {
        return res.status(200).json({
          success: false,
          error: "Type not found",
        });
      }
      if (!client) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }
      if (!state) {
        return res.status(200).json({
          success: false,
          error: "State not found",
        });
      }
      if (!city) {
        return res.status(200).json({
          success: false,
          error: "City not found",
        });
      }
      if (!zone) {
        return res.status(200).json({
          success: false,
          error: "Zone not found",
        });
      }

      let dropDealers = null;
      if (dealer.dropDealers && dealer.dropDealers.length > 0) {
        const dropDealerIds = dealer.dropDealers.map(
          (dropDealer: any) => dropDealer.dropDealerId
        );
        dropDealers = await Dealer.findAll({
          attributes: ["id", "name", "code"],
          where: {
            id: {
              [Op.in]: dropDealerIds,
            },
          },
          paranoid: false,
        });
      }

      const {
        typeId,
        clientId,
        dealerForId,
        isExclusive,
        mechanicalType,
        bodyPartType,
        autoCancelForDelivery,
        stateId,
        cityId,
        serviceRmId,
        salesRmId,
        zoneId,
        walletBalance,
        deletedAt,
        ...dealerData
      } = dealer.dataValues;

      const data = {
        ...dealerData,
        type: type.dataValues.name,
        client: client.dataValues.name,
        isExclusive: dealer.dataValues.isExclusive == 1 ? "Yes" : "No",
        mechanicalType: dealer.dataValues.mechanicalType == 1 ? "Yes" : "No",
        bodyPartType: dealer.dataValues.bodyPartType == 1 ? "Yes" : "No",
        autoCancelForDelivery:
          dealer.dataValues.autoCancelForDelivery == 1 ? "Yes" : "No",
        state: state.dataValues.name,
        city: city.dataValues.name,
        zone: zone.dataValues.name,
        dropDealers,
        financeAdminUserName: financeAdminUserDetail?.data?.user?.name || null,
        status: deletedAt ? "Inactive" : "Active",
      };

      return res.status(200).json({
        success: true,
        message: "Dealer data fetch successfully",
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public async dealerDataExport(req: any, res: any) {
    try {
      const { format, startDate, endDate, authUserId, authUserRoleId } =
        req.query;

      if (!format || !["xlsx", "csv", "xls"].includes(format)) {
        return res.status(200).json({
          success: false,
          error: "Invalid or missing export format",
        });
      }

      const where: any = {};
      if (startDate !== undefined && endDate !== undefined) {
        const startOfDay = moment
          .tz(startDate as MomentInput, "Asia/Kolkata")
          .startOf("day")
          .format("YYYY-MM-DD HH:mm:ss");
        const endOfDay = moment
          .tz(endDate as MomentInput, "Asia/Kolkata")
          .endOf("day")
          .format("YYYY-MM-DD HH:mm:ss");

        where.createdAt = {
          [Op.between]: [startOfDay, endOfDay],
        };
      }

      //IF IT IS FINANCE ADMIN ROLE THEN GET ONLY FINANCE ADMIN DEALERS
      if (authUserRoleId == 31) {
        where.financeAdminUserId = authUserId;
      }

      const DealerData = await Dealer.findAll({
        where,
        include: [
          {
            model: DropDealer,
            as: "dropDealers",
            attributes: ["dropDealerId"],
            required: false,
          },
        ],
        attributes: { exclude: ["createdById", "updatedById", "deletedById"] },
        paranoid: false,
      });

      if (!DealerData || DealerData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      const dealerIds = [
        ...new Set(DealerData.map((dealerData: any) => dealerData.id)),
      ];

      const financeAdminUserIds = [
        ...new Set(
          DealerData.map(
            (dealerData: any) => dealerData.financeAdminUserId
          ).filter((financeAdminUserId: number) => financeAdminUserId != null)
        ),
      ];

      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          dealerIds: dealerIds,
          userIds: financeAdminUserIds,
        }
      );

      let dealerUsers: any = [];
      let financeAdminUsers: any = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        dealerUsers = getUserDetails.data.data.dealerUsers;
        financeAdminUsers = getUserDetails.data.data.userDetails;
      }

      const dealerFinalData = await Promise.all(
        DealerData.map(async (dealer: any) => {
          //Need Change ID To Name
          const [
            typeNameById,
            clientNameById,
            stateNameById,
            cityNameById,
            zoneDetail,
          ] = await Promise.all([
            Config.findOne({
              attributes: ["name"],
              where: { id: dealer.dataValues.typeId },
            }),
            Client.findOne({
              attributes: ["name"],
              where: { id: dealer.dataValues.clientId },
              paranoid: false,
            }),
            State.findOne({
              attributes: ["name"],
              where: { id: dealer.dataValues.stateId },
              paranoid: false,
            }),
            City.findOne({
              attributes: ["name"],
              where: { id: dealer.dataValues.cityId },
              paranoid: false,
            }),
            Config.findOne({
              attributes: ["name"],
              where: { id: dealer.dataValues.zoneId },
            }),
          ]);

          let dropDealerCodes = [];
          if (dealer.dropDealers && dealer.dropDealers.length > 0) {
            const dropDealerIds = [
              ...new Set(
                dealer.dropDealers.map(
                  (dropDealerDetail: any) => dropDealerDetail.dropDealerId
                )
              ),
            ];

            const dropDealerDetails = await Dealer.findAll({
              attributes: ["code"],
              where: {
                id: {
                  [Op.in]: dropDealerIds,
                },
              },
              paranoid: false,
            });

            dropDealerCodes.push(
              ...new Set(
                dropDealerDetails.map(
                  (dropDealerDetail: any) => dropDealerDetail.code
                )
              )
            );
          }

          const dealerUser = dealerUsers.find(
            (dealerUser: any) => dealerUser.entityId == dealer.dataValues.id
          );

          let financeAdminUserData = null;
          if (dealer.dataValues.financeAdminUserId) {
            financeAdminUserData = financeAdminUsers.find(
              (financeAdminUser: any) =>
                financeAdminUser.id == dealer.dataValues.financeAdminUserId
            );
          }

          //Return Modified Data
          return {
            "Group Code": dealer.dataValues.groupCode,
            Code: dealer.dataValues.code,
            Type: typeNameById?.dataValues.name ?? "",
            Name: dealer.dataValues.name,
            "Legal Name": dealer.dataValues.legalName,
            "Trade Name": dealer.dataValues.tradeName,
            "Mobile Number": dealer.dataValues.mobileNumber,
            Email: dealer.dataValues.email,
            GSTIN: dealer.dataValues.gstin,
            PAN: dealer.dataValues.pan,
            CIN: dealer.dataValues.cin,
            "Mechanical Type":
              dealer.dataValues.mechanicalType == 1 ? "Yes" : "No",
            "Is Exclusive": dealer.dataValues.isExclusive == 1 ? "Yes" : "No",
            "Body Part Type":
              dealer.dataValues.bodyPartType == 1 ? "Yes" : "No",
            Client: clientNameById?.dataValues.name ?? "",
            "RSA Person Name": dealer.dataValues.rsaPersonName,
            "RSA Person Number": dealer.dataValues.rsaPersonNumber,
            "RSA Person Alternate Number":
              dealer.dataValues.rsaPersonAlternateNumber,
            "SM Name": dealer.dataValues.smName,
            "SM Number": dealer.dataValues.smNumber,
            "SM Alternate Number": dealer.dataValues.smAlternateNumber,
            "OEM ASM Name": dealer.dataValues.oemAsmName,
            "OEM ASM Number": dealer.dataValues.oemAsmNumber,
            "OEM ASM Alternate Number": dealer.dataValues.oemAsmAlternateNumber,
            "Auto Cancel For Delivery": dealer.dataValues.autoCancelForDelivery
              ? "Yes"
              : "No",
            "Address Line One": dealer.dataValues.addressLineOne,
            "Address Line Two": dealer.dataValues.addressLineTwo,
            "Correspondence Address": dealer.dataValues.correspondenceAddress,
            State: stateNameById?.dataValues.name ?? "",
            City: cityNameById?.dataValues.name ?? "",
            Area: dealer.dataValues.area,
            "Pin Code": dealer.dataValues.pincode,
            Latitude: dealer.dataValues.lat,
            Longitude: dealer.dataValues.long,
            Zone: zoneDetail ? zoneDetail.dataValues.name : "",
            "Drop Dealer Codes": dropDealerCodes
              ? dropDealerCodes.join(", ")
              : null,
            Username: dealerUser?.userName || null,
            "Finance Admin User": financeAdminUserData?.name || null,
            "Created At": moment
              .tz(dealer.dataValues.createdAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A"),
            Status: dealer.dataValues.deletedAt ? "Inactive" : "Active",
          };
        })
      );

      //Get Column Name
      const renamedColumnNames = dealerFinalData
        ? Object.keys(dealerFinalData[0])
        : [];

      //Buffer Data
      let buffer;

      if (format === "xlsx" || format === "xls") {
        buffer = generateXLSXAndXLSExport(
          dealerFinalData,
          renamedColumnNames,
          format,
          "Dealer"
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
        buffer = generateCSVExport(dealerFinalData, renamedColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Dealer data export successfully`,
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

  public dealerDataImport = async (req: any, res: any) => {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData: any = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = [
      //   "Group Code",
      //   "Code",
      //   "Type",
      //   "Name",
      //   "Legal Name",
      //   "Trade Name",
      //   "Mobile Number",
      //   "Email",
      //   "GSTIN",
      //   "PAN",
      //   "CIN",
      //   "Mechanical Type",
      //   "Is Exclusive",
      //   "Body Part Type",
      //   "Client",
      //   "RSA Person Name",
      //   "RSA Person Number",
      //   "RSA Person Alternate Number",
      //   "SM Name",
      //   "SM Number",
      //   "SM Alternate Number",
      //   "OEM ASM Name",
      //   "OEM ASM Number",
      //   "OEM ASM Alternate Number",
      //   "Auto Cancel For Delivery",
      //   "UserName",
      //   "Password",
      //   "Change Password",
      //   "Address Line One",
      //   "Address Line Two",
      //   "Correspondence Address",
      //   "State",
      //   "City",
      //   "Area",
      //   "Pin Code",
      //   "Latitude",
      //   "Longitude",
      //   "Zone",
      //   "Drop Dealer Codes",
      //   "Status",
      // ];

      const importColumnsResponse = await Utils.getExcelImportColumns(1100);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1100,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      //GET all dealer user details
      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          roleIds: [2],
        }
      );
      let dealerDetails = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        dealerDetails = getUserDetails.data.data.roleUserDetails;
      }

      for (const data1 of inData) {
        let data2 = data1["data"];
        for (const data3 of data2) {
          importColumns.forEach((importColumn: any) => {
            if (!data3.hasOwnProperty(importColumn)) {
              data3[importColumn] = "";
            }
          });

          let reArrangedDealers: any = {
            "Group Code": data3["Group Code"]
              ? String(data3["Group Code"])
              : null,
            Code: data3["Code"] ? String(data3["Code"]) : null,
            Type: data3["Type"] ? String(data3["Type"]) : null,
            Name: data3["Name"],
            "Legal Name": data3["Legal Name"],
            "Trade Name": data3["Trade Name"],
            "Mobile Number": data3["Mobile Number"]
              ? String(data3["Mobile Number"])
              : null,
            Email: data3["Email"],
            GSTIN: data3["GSTIN"],
            PAN: data3["PAN"],
            CIN: data3["CIN"] ? String(data3["CIN"]) : null,
            "Mechanical Type": data3["Mechanical Type"]
              ? String(data3["Mechanical Type"])
              : null,
            "Is Exclusive": data3["Is Exclusive"]
              ? String(data3["Is Exclusive"])
              : null,
            "Body Part Type": data3["Body Part Type"]
              ? String(data3["Body Part Type"])
              : null,
            Client: data3["Client"] ? String(data3["Client"]) : null,
            "RSA Person Name": data3["RSA Person Name"],
            "RSA Person Number": data3["RSA Person Number"]
              ? String(data3["RSA Person Number"])
              : null,
            "RSA Person Alternate Number": data3["RSA Person Alternate Number"]
              ? String(data3["RSA Person Alternate Number"])
              : null,
            "SM Name": data3["SM Name"],
            "SM Number": data3["SM Number"] ? String(data3["SM Number"]) : null,
            "SM Alternate Number": data3["SM Alternate Number"]
              ? String(data3["SM Alternate Number"])
              : null,
            "OEM ASM Name": data3["OEM ASM Name"],
            "OEM ASM Number": data3["OEM ASM Number"]
              ? String(data3["OEM ASM Number"])
              : null,
            "OEM ASM Alternate Number": data3["OEM ASM Alternate Number"]
              ? String(data3["OEM ASM Alternate Number"])
              : null,
            "Auto Cancel For Delivery": data3["Auto Cancel For Delivery"]
              ? String(data3["Auto Cancel For Delivery"])
              : null,
            UserName: data3["UserName"] ? String(data3["UserName"]) : null,
            Password: data3["Password"] ? String(data3["Password"]) : null,
            "Change Password": data3["Change Password"]
              ? String(data3["Change Password"])
              : null,
            "Address Line One": data3["Address Line One"],
            "Address Line Two": data3["Address Line Two"],
            "Correspondence Address": data3["Correspondence Address"],
            State: data3["State"] ? String(data3["State"]) : null,
            City: data3["City"] ? String(data3["City"]) : null,
            Area: data3["Area"] ? String(data3["Area"]) : null,
            "Pin Code": data3["Pin Code"] ? String(data3["Pin Code"]) : null,
            Latitude: data3["Latitude"] ? String(data3["Latitude"]) : null,
            Longitude: data3["Longitude"] ? String(data3["Longitude"]) : null,
            Zone: data3["Zone"] ? String(data3["Zone"]) : null,
            "Drop Dealer Codes": data3["Drop Dealer Codes"]
              ? String(data3["Drop Dealer Codes"])
              : null,
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          const keyMapping: any = {
            type: "typeId",
            gSTIN: "gstin",
            pAN: "pan",
            cIN: "cin",
            client: "clientId",
            rSAPersonName: "rsaPersonName",
            rSAPersonNumber: "rsaPersonNumber",
            rSAPersonAlternateNumber: "rsaPersonAlternateNumber",
            sMName: "smName",
            sMNumber: "smNumber",
            sMAlternateNumber: "smAlternateNumber",
            oEMASMName: "oemAsmName",
            oEMASMNumber: "oemAsmNumber",
            oEMASMAlternateNumber: "oemAsmAlternateNumber",
            dealerFor: "dealerForId", //doubt
            state: "stateId",
            city: "cityId",
            latitude: "lat",
            longitude: "long",
            zone: "zoneId",
            pinCode: "pincode",
          };

          for (const key in reArrangedDealers) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedDealers[key];
          }

          //VALIDATIONS
          const validationErrors = [];
          if (record.mobileNumber && !/^[0-9]{10}$/.test(record.mobileNumber)) {
            validationErrors.push("Invalid mobile number.");
          }

          if (record.gstin && !/^[A-Za-z0-9 ]+$/.test(record.gstin)) {
            validationErrors.push("Invalid gstin.");
          }

          if (record.pan && !/^[A-Za-z0-9 ]+$/.test(record.pan)) {
            validationErrors.push("Invalid pan.");
          }

          if (record.cin && !/^[A-Za-z0-9 ]+$/.test(record.cin)) {
            validationErrors.push("Invalid cin.");
          }

          if (
            record.mechanicalType &&
            !["Yes", "No"].includes(record.mechanicalType)
          ) {
            validationErrors.push("Mechanical type value should be Yes or No.");
          }

          if (
            record.isExclusive &&
            !["Yes", "No"].includes(record.isExclusive)
          ) {
            validationErrors.push("Is exclusive value should be Yes or No.");
          }

          if (
            record.bodyPartType &&
            !["Yes", "No"].includes(record.bodyPartType)
          ) {
            validationErrors.push("Body part type value should be Yes or No.");
          }

          if (
            record.rsaPersonNumber &&
            !/^[0-9]{10}$/.test(record.rsaPersonNumber)
          ) {
            validationErrors.push("Invalid rsa person number.");
          }

          if (
            record.rsaPersonAlternateNumber &&
            !/^[0-9]{10}$/.test(record.rsaPersonAlternateNumber)
          ) {
            validationErrors.push("Invalid rsa person alternate number.");
          }

          if (record.smNumber && !/^[0-9]{10}$/.test(record.smNumber)) {
            validationErrors.push("Invalid sm number.");
          }

          if (
            record.smAlternateNumber &&
            !/^[0-9]{10}$/.test(record.smAlternateNumber)
          ) {
            validationErrors.push("Invalid sm alternate number.");
          }

          if (record.oemAsmNumber && !/^[0-9]{10}$/.test(record.oemAsmNumber)) {
            validationErrors.push("Invalid oem asm number.");
          }

          if (
            record.oemAsmAlternateNumber &&
            !/^[0-9]{10}$/.test(record.oemAsmAlternateNumber)
          ) {
            validationErrors.push("Invalid oem asm alternate number.");
          }

          if (
            record.autoCancelForDelivery &&
            !["Yes", "No"].includes(record.autoCancelForDelivery)
          ) {
            validationErrors.push(
              "Auto cancel for delivery value should be Yes or No."
            );
          }

          if (
            record.changePassword &&
            !["Yes", "No"].includes(record.changePassword)
          ) {
            validationErrors.push("Change password value should be Yes or No.");
          }

          if (record.pincode && !/^\d{6}$/.test(record.pincode)) {
            validationErrors.push("Invalid pincode.");
          }

          if (record.lat && !/^-?\d+(\.\d+)?$/.test(record.lat)) {
            validationErrors.push("Invalid latitude.");
          }

          if (record.long && !/^-?\d+(\.\d+)?$/.test(record.long)) {
            validationErrors.push("Invalid longitude.");
          }

          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          if (validationErrors.length > 0) {
            errorOutData.push({
              ...reArrangedDealers,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //DEALER
          let dealerId = null;
          let userId = null;
          if (record.code) {
            const trimmedCode = record.code.trim();
            const dealerAlreadyExists = await Dealer.findOne({
              where: {
                code: trimmedCode,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (dealerAlreadyExists) {
              dealerId = dealerAlreadyExists.dataValues.id;

              //GET USER
              const dealerUserDetail = dealerDetails.find(
                (dealerDetail: any) =>
                  dealerDetail.entityId == dealerAlreadyExists.dataValues.id &&
                  dealerDetail.roleId == 2
              );

              if (dealerUserDetail) {
                userId = dealerUserDetail.id;
              }
            }
          }

          //TYPE
          let typeName: any = null;
          if (record.typeId) {
            const trimmedTypeName = record.typeId.trim();
            typeName = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedTypeName,
                typeId: 22, //DEALER TYPES
              },
            });
          }
          const typeId = typeName ? typeName.dataValues.id : 0;

          //CLIENT
          let clientName: any = null;
          if (record.clientId) {
            const trimmedClientName = record.clientId.trim();
            clientName = await Client.findOne({
              attributes: ["id", "name"],
              where: { name: trimmedClientName },
              paranoid: false,
            });
          }
          const clientId = clientName ? clientName.dataValues.id : 0;

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
              where: {
                name: trimmedCityName,
                stateId: stateId,
              },
              paranoid: false,
            });
          }
          const cityId = cityName ? cityName.dataValues.id : 0;

          //ZONE
          let zoneName: any = null;
          if (record.zoneId) {
            const trimmedZoneName = record.zoneId.trim();
            zoneName = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedZoneName,
                typeId: 23, //Dealer Zones
              },
            });
          }
          const zoneId = zoneName ? zoneName.dataValues.id : 0;

          //DROP DEALERS
          let dropDealerIds = [];
          let dropDealerDetails = [];
          if (record.dropDealerCodes) {
            for (const dropDealerCode of record.dropDealerCodes.split(",")) {
              const trimmedDropDealerCode = dropDealerCode.trim();
              const dropDealerDetail: any = await Dealer.findOne({
                attributes: ["id"],
                where: {
                  code: trimmedDropDealerCode,
                  groupCode: record.groupCode,
                },
                paranoid: false,
              });

              if (dropDealerDetail) {
                dropDealerIds.push(dropDealerDetail.id);
              }

              dropDealerDetails.push({
                code: trimmedDropDealerCode,
                id: dropDealerDetail ? dropDealerDetail.id : null,
              });
            }
          }

          //REQUESTS FOR DEALER SAVE
          record.dealerId = dealerId;
          record.userId = userId;
          record.typeId = typeId;
          let trimmedMechanicalType = null;
          if (record.mechanicalType) {
            trimmedMechanicalType = record.mechanicalType.trim();
          }
          record.mechanicalType =
            trimmedMechanicalType &&
              trimmedMechanicalType.toLowerCase() === "yes"
              ? 1
              : 0;
          let trimmedIsExclusive = null;
          if (record.isExclusive) {
            trimmedIsExclusive = record.isExclusive.trim();
          }
          record.isExclusive =
            trimmedIsExclusive && trimmedIsExclusive.toLowerCase() === "yes"
              ? 1
              : 0;
          let trimmedBodyPartType = null;
          if (record.bodyPartType) {
            trimmedBodyPartType = record.bodyPartType.trim();
          }
          record.bodyPartType =
            trimmedBodyPartType && trimmedBodyPartType.toLowerCase() === "yes"
              ? 1
              : 0;
          record.clientId = clientId;
          let trimmedChangePassword = null;
          if (record.changePassword) {
            trimmedChangePassword = record.changePassword.trim();
          }
          record.changePassword =
            trimmedChangePassword &&
              trimmedChangePassword.toLowerCase() === "yes"
              ? 1
              : 0;
          record.stateId = stateId;
          record.cityId = cityId;
          record.zoneId = zoneId;
          record.authUserId = req.body.authUserId;
          record.createdById = req.body.authUserId;
          record.updatedById = req.body.authUserId;
          record.status =
            record.status && record.status.toLowerCase() === "active" ? 1 : 0;
          record.dropDealerIds = dropDealerIds;
          record.dropDealerCodes = dropDealerDetails;

          let trimmedAutoCancelForDelivery = null;
          if (record.autoCancelForDelivery) {
            trimmedAutoCancelForDelivery = record.autoCancelForDelivery.trim();
          }
          record.autoCancelForDelivery =
            trimmedAutoCancelForDelivery &&
              trimmedAutoCancelForDelivery.toLowerCase() === "yes"
              ? 1
              : 0;

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
              ...reArrangedDealers,
              Error: errorContent,
            });
          } else {
            if (output.message === "Dealer created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New dealer created (${newRecordsCreated} records) and existing dealer updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New dealer created (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing dealer updated (${existingRecordsUpdated} records)`
              : "No dealer created or updated";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Dealer
      const dealerFinalData = errorOutData;
      // Column Filter
      const renamedUserColumnNames = Object.keys(dealerFinalData[0]);
      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        dealerFinalData,
        renamedUserColumnNames,
        "xlsx",
        "Dealer"
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

  async getNearestDealersByLocation(req: Request, res: Response) {
    try {
      const payload = req.body;

      //VALIDATION
      const validatorRules = {
        clientId: "required|numeric",
        caseTypeId: "required|numeric",
        bdLat: "required|string",
        bdLong: "required|string",
        apiType: "string",
        dropLocationTypeId: "nullable",
        searchKey: "nullable",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let dealers: any = {};
      let whereDealer = Object();
      whereDealer.clientId = payload.clientId;
      whereDealer.lat = {
        [Op.ne]: null,
      };
      whereDealer.long = {
        [Op.ne]: null,
      };
      //Accidental
      if (payload.caseTypeId == 413) {
        whereDealer.bodyPartType = 1;
      } else {
        whereDealer.mechanicalType = 1;
      }

      //IF DROP LOCATION TYPE IS CUSTOMER PREFERRED LOCATION - THEN DEALERS WILL BE LISTED BASED ON SEARCH
      if (payload.dropLocationTypeId == 451) {
        whereDealer[Op.or] = [
          { code: { [Op.like]: `%${payload.searchKey}%` } },
          { name: { [Op.like]: `%${payload.searchKey}%` } },
          { legalName: { [Op.like]: `%${payload.searchKey}%` } },
        ];

        dealers = await Dealer.findAll({
          where: whereDealer,
          attributes: [
            "id",
            [
              Sequelize.literal("CONCAT(code, '-', legalName)"),
              "codeWithLegalName",
            ],
            "code",
            ["legalName", "name"],
            ["correspondenceAddress", "dealerLocation"],
            ["lat", "latitude"],
            ["long", "longitude"],
          ],
        });

        if (dealers.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Dealers not found",
          });
        }
      } else {
        //IF DROP LOCATION TYPE IS DEALER - THEN NEAREST DEALER FROM BD LOCATION WILL BE LISTED
        let dealerHavingQuery = `distance <= ${process.env.NEAREST_DEALER_DISTANCE}`;
        let dealerLimitQuery = Number(process.env.NEAREST_DEALER_LIMIT);

        // FOR NOTES PURPOSE - GET NEAREST FIRST DEALER
        if (payload.apiType == "notes") {
          dealerLimitQuery = 1;
        }

        const haversine = `(
          6371 * acos(
              cos(radians(${payload.bdLat}))
              * cos(radians(lat))
              * cos(radians(\`long\`) - radians(${payload.bdLong}))
              + sin(radians(${payload.bdLat})) * sin(radians(lat))
          )
        )`;

        let limitedDealers = await getNearestDealers(
          1,
          whereDealer,
          haversine,
          dealerLimitQuery,
          dealerHavingQuery
        );
        //IF NEAREST DEALER IS NOT AVAILABLE FOR THE GIVEN DISTANCE THEN GET NEAREST DEALER LIST WITHOUT DISTANCE
        if (limitedDealers.length == 0) {
          let withoutLimitDealers = await getNearestDealers(
            2,
            whereDealer,
            haversine,
            dealerLimitQuery,
            null
          );
          dealers = withoutLimitDealers;
        } else {
          dealers = limitedDealers;
        }

        if (dealers.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Dealers not found",
          });
        }

        let dealerCoordinates: any = [];
        for (let i = 0; i < dealers.length; i++) {
          const lat = dealers[i].dataValues.latitude;
          const lon = dealers[i].dataValues.longitude;
          await dealerCoordinates.push({ lat, lon });
        }

        //BREAKDOWN ORIGINS
        const breakdownOrigin = [`${payload.bdLat + "," + payload.bdLong}`];

        //BREAKDOWN NEAREST DEALERS LIST
        const breakdownNearestDealersList = dealerCoordinates.map(
          (object: any) => object.lat + "," + object.lon
        );

        const [googleDistanceData]: any = await Promise.all([
          Utils.getGoogleDistanceDuration(
            breakdownOrigin,
            breakdownNearestDealersList,
            3
          ),
        ]);

        for (let i = 0; i < dealers.length; i++) {
          const distanceElement =
            googleDistanceData[i]?.elements?.[0]?.distance;
          dealers[i].dataValues.distance = distanceElement?.value
            ? (distanceElement.value / 1000).toFixed(2) + " km" // Convert meters to km and format to 2 decimal places
            : "0 km";
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: dealers,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //DROP DEALERS LISTING IN DEALER FORM FOR DELIVERY REQUEST PURPOSE.
  getByGroupCode = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        dealerId: "numeric",
        search: "string",
        groupCode: "required|string|maxLength:60",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let dropDealerWhere: any = {};
      dropDealerWhere.groupCode = String(payload.groupCode).trim();
      if (payload.search) {
        dropDealerWhere[Op.or] = [
          { code: { [Op.like]: `%${payload.search}%` } },
          { name: { [Op.like]: `%${payload.search}%` } },
        ];
      }

      if (payload.dealerId) {
        const dealer: any = await Dealer.findOne({
          attributes: ["id", "name"],
          where: {
            id: payload.dealerId,
          },
          paranoid: false,
        });
        if (!dealer) {
          return res.status(200).json({
            success: false,
            error: "Dealer not found",
          });
        }
        dropDealerWhere.id = {
          [Op.ne]: payload.dealerId,
        };
      }

      const dropDealers: any = await Dealer.findAll({
        where: dropDealerWhere,
        attributes: ["id", "name", "code"],
      });
      if (dropDealers.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Drop dealer not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: dropDealers,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  //NOT USED NOW IF REQUIRED WE CAN USE
  getDealerDistanceForBdLocation = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        bdLat: "required|string",
        bdLong: "required|string",
        dealerId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const dealer: any = await Dealer.findOne({
        attributes: [
          "id",
          "code",
          ["legalName", "name"],
          ["correspondenceAddress", "dealerLocation"],
          ["lat", "latitude"],
          ["long", "longitude"],
        ],
        where: {
          id: payload.dealerId,
        },
      });
      if (!dealer) {
        return res.status(200).json({
          success: false,
          error: "Dealer not found",
        });
      }

      const [googleDistanceData]: any = await Promise.all([
        Utils.getGoogleDistanceDuration(
          [`${payload.bdLat + "," + payload.bdLong}`],
          [`${dealer.dataValues.latitude + "," + dealer.dataValues.longitude}`],
          2
        ),
      ]);
      dealer.dataValues.distance = googleDistanceData[0]?.elements?.[0]
        ?.distance?.value
        ? (googleDistanceData[0]?.elements?.[0]?.distance.value / 1000).toFixed(
          2
        ) + " km" // Convert meters to km and format to 2 decimal places
        : "0 km";

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: dealer,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getDealerByFinanceAdminUser = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        financeAdminUserId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const dealers: any = await Dealer.findAll({
        attributes: ["id", "code"],
        where: {
          financeAdminUserId: payload.financeAdminUserId,
        },
        paranoid: false,
      });
      if (dealers.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Dealer not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: dealers,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

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
      dealerId: "numeric",
      groupCode: "string|maxLength:60",
      code: "required|string|maxLength:60",
      name: "required|string|minLength:3|maxLength:255",
      legalName: "required|string|minLength:3|maxLength:255",
      tradeName: "required|string|minLength:3|maxLength:255",
      mobileNumber: "required|string|minLength:10|maxLength:10",
      email: "required|email",
      gstin: "required|string|minLength:15|maxLength:15",
      pan: "required|string|minLength:10|maxLength:10",
      cin: "string|minLength:21|maxLength:21",
      typeId: "required|numeric",
      clientId: "required|numeric",
      isExclusive: "required|numeric",
      mechanicalType: "required|numeric",
      bodyPartType: "required|numeric",
      rsaPersonName: "string|minLength:3|maxLength:255",
      rsaPersonNumber: "string|minLength:10|maxLength:10",
      rsaPersonAlternateNumber: "string|minLength:10|maxLength:10",
      smName: "string|minLength:3|maxLength:255",
      smNumber: "string|minLength:10|maxLength:10",
      smAlternateNumber: "string|minLength:10|maxLength:10",
      oemAsmName: "string|minLength:3|maxLength:255",
      oemAsmNumber: "string|minLength:10|maxLength:10",
      oemAsmAlternateNumber: "string|minLength:10|maxLength:10",
      autoCancelForDelivery: "required|numeric",
      addressLineOne: "required|string",
      addressLineTwo: "string",
      correspondenceAddress: "required|string",
      stateId: "required|numeric",
      cityId: "required|numeric",
      area: "required|string|minLength:3|maxLength:255",
      pincode: "required|string|minLength:6|maxLength:6",
      lat: "required|string|maxLength:60",
      long: "required|string|maxLength:60",
      zoneId: "required|numeric",
      userId: "numeric",
      userName: "required|string|minLength:3|maxLength:255",
      password: "string",
      changePassword: "numeric",
      status: "required|numeric",
      dropDealerIds: "array",
      "dropDealerIds.*": "numeric",
      financeAdminUserId: "numeric",
    };

    const errors = await Utils.validateParams(payload, v);
    if (errors) {
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

    const {
      dealerId,
      cin,
      rsaPersonName,
      rsaPersonNumber,
      rsaPersonAlternateNumber,
      smName,
      smNumber,
      smAlternateNumber,
      oemAsmName,
      oemAsmNumber,
      oemAsmAlternateNumber,
      addressLineTwo,
      pincode,
      ...inputData
    } = payload;

    // CHECK DROP DEALER IDS CONTAINS DUPLICATE VALUE
    if (
      payload.dropDealerIds &&
      payload.dropDealerIds.length > 0 &&
      Utils.hasDuplicates(payload.dropDealerIds)
    ) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Drop dealer has already taken",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Drop dealer has already taken",
        });
      }
    }

    //CUSTOM VALIDATIONS
    const type = await Config.findOne({
      where: {
        id: inputData.typeId,
        typeId: 22, //DEALER TYPES
      },
    });

    if (!type) {
      await transaction.rollback();
      if (importData !== undefined) {
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
    const state = await State.findByPk(inputData.stateId);
    if (!state) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "State not found",
          data: payload,
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
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "City not found",
        });
      }
    }
    const zone = await Config.findOne({
      where: {
        id: inputData.zoneId,
        typeId: 23, //DEALER ZONES
      },
    });
    if (!zone) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Zone not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Zone not found",
        });
      }
    }

    //GET ROLE DETAILS
    const getRoleDetail: any = await axios.get(
      `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=Dealer`
    );
    if (!getRoleDetail.data.success) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: getRoleDetail.data.error,
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: getRoleDetail.data.error,
        });
      }
    }
    const roleId = getRoleDetail.data.data.id;

    if (importData) {
      if (payload.dropDealerCodes) {
        for (const dropDealerCodeDetail of payload.dropDealerCodes) {
          if (dropDealerCodeDetail.code && !dropDealerCodeDetail.id) {
            await transaction.rollback();
            return {
              success: false,
              error: `Drop dealer ${dropDealerCodeDetail.code} not found`,
              data: payload,
            };
          }
        }
      }
    }

    if (dealerId) {
      const dealer = await Dealer.findOne({
        attributes: ["id"],
        where: {
          id: dealerId,
        },
        paranoid: false,
        transaction: transaction,
      });
      if (!dealer) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Dealer not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Dealer not found",
          });
        }
      }

      const dealerAlreadyExists = await Dealer.findOne({
        where: {
          code: inputData.code,
          id: {
            [Op.ne]: dealerId,
          },
        },
        attributes: ["id"],
        paranoid: false,
        transaction: transaction,
      });
      if (dealerAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Dealer code is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Dealer code is already taken",
          });
        }
      }
    } else {
      const dealerAlreadyExists = await Dealer.findOne({
        where: {
          code: inputData.code,
        },
        attributes: ["id"],
        paranoid: false,
        transaction: transaction,
      });
      if (dealerAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Dealer code is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Dealer code is already taken",
          });
        }
      }
    }

    // SAVE DEALER PROCESS
    let deletedAt = null;
    let deletedById = null;
    //INACTIVE
    if (inputData.status == 0) {
      deletedAt = new Date();
      deletedById = inputData.authUserId;
    }

    const data: any = {
      ...inputData,
      cin: cin ? cin : null,
      rsaPersonName: rsaPersonName ? rsaPersonName : null,
      rsaPersonNumber: rsaPersonNumber ? rsaPersonNumber : null,
      rsaPersonAlternateNumber: rsaPersonAlternateNumber
        ? rsaPersonAlternateNumber
        : null,
      smName: smName ? smName : null,
      smNumber: smNumber ? smNumber : null,
      smAlternateNumber: smAlternateNumber ? smAlternateNumber : null,
      oemAsmName: oemAsmName ? oemAsmName : null,
      oemAsmNumber: oemAsmNumber ? oemAsmNumber : null,
      oemAsmAlternateNumber: oemAsmAlternateNumber
        ? oemAsmAlternateNumber
        : null,
      addressLineTwo: addressLineTwo ? addressLineTwo : null,
      pincode: pincode ? pincode : null,
      financeAdminUserId: inputData.financeAdminUserId
        ? inputData.financeAdminUserId
        : null,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let userEntityId: any;
    let userCreatedByOrUpdatedById: any;
    let message = null;
    if (dealerId) {
      await Dealer.update(data, {
        where: {
          id: dealerId,
        },
        paranoid: false,
        transaction: transaction,
      });
      userEntityId = dealerId;
      userCreatedByOrUpdatedById = {
        updatedById: inputData.updatedById,
      };
      message = "Dealer updated successfully";
    } else {
      const newDealer = await Dealer.create(data, {
        transaction: transaction,
      });
      userEntityId = newDealer.dataValues.id;
      userCreatedByOrUpdatedById = {
        createdById: inputData.createdById,
      };
      message = "Dealer created successfully";
    }

    const userData = {
      userId: inputData.userId,
      roleId: roleId,
      userTypeId: 140, //DEALER
      entityId: userEntityId,
      code: inputData.code,
      name: inputData.name,
      mobileNumber: inputData.mobileNumber,
      email: inputData.email,
      userName: inputData.userName,
      password: inputData.password,
      address: inputData.correspondenceAddress,
      changePassword: inputData.changePassword,
      status: inputData.status,
      deletedById: deletedById,
      ...userCreatedByOrUpdatedById,
    };

    //SAVE USER ENTITY
    const saveUserEntity = await axios.post(
      `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
      userData
    );

    if (!saveUserEntity.data.success) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: saveUserEntity.data.errors
            ? saveUserEntity.data.errors.join(",")
            : saveUserEntity.data.error,
          data: payload,
        };
      } else {
        return res.status(200).json(saveUserEntity.data);
      }
    }

    //SAVE DROP DEALERS
    await DropDealer.destroy({
      where: {
        dealerId: userEntityId,
      },
      force: true,
      transaction: transaction,
    });
    if (payload.dropDealerIds && payload.dropDealerIds.length > 0) {
      const dealerDropDealerData = payload.dropDealerIds.map(
        (dropDealerId: number) => ({
          dealerId: userEntityId,
          dropDealerId: dropDealerId,
        })
      );
      await DropDealer.bulkCreate(dealerDropDealerData, {
        transaction,
      });
    }

    await transaction.commit();
    if (importData !== undefined) {
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
    if (importData !== undefined) {
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

async function getNearestDealers(
  conditionType: number,
  whereDealer: any,
  haversine: any,
  dealerLimitQuery: number,
  dealerHavingQuery: any
) {
  let dealers: any = await Dealer.findAll({
    where: whereDealer,
    attributes: [
      "id",
      [Sequelize.literal("CONCAT(code, '-', legalName)"), "codeWithLegalName"],
      "code",
      ["legalName", "name"],
      ["correspondenceAddress", "dealerLocation"],
      ["lat", "latitude"],
      ["long", "longitude"],
      [sequelize.literal(haversine), "distance"],
    ],
    order: sequelize.col("distance"),
    limit: dealerLimitQuery,
  });

  if (conditionType === 1) {
    dealers.having = sequelize.literal(dealerHavingQuery);
  }

  return dealers;
}

export const getDealer = async (id: any) => {
  try {
    return await Dealer.findOne({
      attributes: ["id", "name"],
      where: { id: id },
    });
  } catch (error: any) {
    throw error;
  }
};

export const uatDealerSeeder = async (data: any) => {
  try {
    //Get dealer role detail
    const getRoleDetail: any = await axios.get(
      `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=Dealer`
    );
    let roleId: any = null;
    if (getRoleDetail?.data?.success) {
      roleId = getRoleDetail.data.data.id;
    }

    const details: any = [];
    await data.eachRow(async (row: any, rowNumber: number) => {
      if (rowNumber !== 1) {
        let [
          ,
          groupCode,
          code,
          type,
          name,
          legalName,
          tradeName,
          mobileNumber,
          email,
          gstin,
          pan,
          cin,
          mechanicalType,
          isExclusive,
          bodyPartType,
          client,
          rsaPersonName,
          rsaPersonNumber,
          rsaPersonAlternateNumber,
          smName,
          smNumber,
          smAlternateNumber,
          oemAsmName,
          oemAsmNumber,
          oemAsmAlternateNumber,
          autoCancelForDelivery,
          userName,
          password,
          changePassword,
          addressLineOne,
          addressLineTwo,
          correspondenceAddress,
          state,
          city,
          area,
          pinCode,
          latitude,
          longitude,
          zone,
          dropDealerCodes,
          status,
        ] = row.values;

        details.push({
          groupCode: groupCode,
          code: code,
          type: type,
          name: name,
          legalName: legalName,
          tradeName: tradeName,
          mobileNumber: mobileNumber,
          email: email,
          gstin: gstin,
          pan: pan,
          cin: cin,
          mechanicalType: mechanicalType,
          isExclusive: isExclusive,
          bodyPartType: bodyPartType,
          client: client,
          rsaPersonName: rsaPersonName,
          rsaPersonNumber: rsaPersonNumber,
          rsaPersonAlternateNumber: rsaPersonAlternateNumber,
          smName: smName,
          smNumber: smNumber,
          smAlternateNumber: smAlternateNumber,
          oemAsmName: oemAsmName,
          oemAsmNumber: oemAsmNumber,
          oemAsmAlternateNumber: oemAsmAlternateNumber,
          autoCancelForDelivery: autoCancelForDelivery,
          userName: userName,
          password: password,
          changePassword: changePassword,
          addressLineOne: addressLineOne,
          addressLineTwo: addressLineTwo,
          correspondenceAddress: correspondenceAddress,
          state: state,
          city: city,
          area: area,
          pinCode: pinCode,
          latitude: latitude,
          longitude: longitude,
          zone: zone,
          dropDealerCodes: dropDealerCodes,
          status: status,
        });
      }
    });

    let createdDealerCount = 0;
    let createdUserCount = 0;
    for (const detail of details) {
      const transaction = await sequelize.transaction();
      try {
        if (
          detail.mechanicalType &&
          !["Yes", "No"].includes(detail.mechanicalType)
        ) {
          await transaction.rollback();
          console.log(
            `${detail.code} : Mechanical type value should be Yes or No.`
          );
          continue;
        }

        if (detail.isExclusive && !["Yes", "No"].includes(detail.isExclusive)) {
          await transaction.rollback();
          console.log(
            `${detail.code} : Is exclusive value should be Yes or No.`
          );
          continue;
        }

        if (
          detail.bodyPartType &&
          !["Yes", "No"].includes(detail.bodyPartType)
        ) {
          await transaction.rollback();
          console.log(
            `${detail.code} : Body part type value should be Yes or No.`
          );
          continue;
        }

        if (
          detail.autoCancelForDelivery &&
          !["Yes", "No"].includes(detail.autoCancelForDelivery)
        ) {
          await transaction.rollback();
          console.log(
            `${detail.code} : Auto cancel for delivery value should be Yes or No.`
          );
          continue;
        }

        if (
          detail.changePassword &&
          !["Yes", "No"].includes(detail.changePassword)
        ) {
          await transaction.rollback();
          console.log(
            `${detail.code} : Change password value should be Yes or No.`
          );
          continue;
        }

        if (detail.status && !["Active", "Inactive"].includes(detail.status)) {
          await transaction.rollback();
          console.log(
            `${detail.code} : Status value should be Active or Inactive.`
          );
          continue;
        }

        //If dealer already exists then omit this process
        if (detail.code) {
          const trimmedCode = String(detail.code).trim();
          const dealerAlreadyExists = await Dealer.findOne({
            attributes: ["id"],
            where: {
              code: trimmedCode,
            },
            paranoid: false,
          });

          if (dealerAlreadyExists) {
            await transaction.rollback();
            console.log(`${detail.code} : Dealer already exists.`);
            continue;
          }
        }

        //Type
        let typeId = null;
        if (detail.type) {
          const trimmedTypeName = String(detail.type).trim();
          const typeDetail = await Config.findOne({
            attributes: ["id", "name"],
            where: {
              name: trimmedTypeName,
              typeId: 22, //DEALER TYPES
            },
          });

          if (typeDetail) {
            typeId = typeDetail.dataValues.id;
          }
        }

        //Client
        let clientId = null;
        if (detail.client) {
          const trimmedClientName = String(detail.client).trim();
          const clientDetail = await Client.findOne({
            attributes: ["id", "name"],
            where: { name: trimmedClientName },
            paranoid: false,
          });

          if (clientDetail) {
            clientId = clientDetail.dataValues.id;
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
            attributes: ["id"],
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

        //Zone
        let zoneId = null;
        if (detail.zone) {
          const trimmedZoneName = String(detail.zone).trim();
          const zoneDetail = await Config.findOne({
            attributes: ["id", "name"],
            where: {
              name: trimmedZoneName,
              typeId: 23, //Dealer Zones
            },
          });

          if (zoneDetail) {
            zoneId = zoneDetail.dataValues.id;
          }
        }

        //Reassign to actual values
        detail.mechanicalType = detail.mechanicalType == "Yes" ? 1 : 0;
        detail.isExclusive = detail.isExclusive == "Yes" ? 1 : 0;
        detail.bodyPartType = detail.bodyPartType == "Yes" ? 1 : 0;
        detail.changePassword = detail.changePassword == "Yes" ? 1 : 0;
        detail.autoCancelForDelivery =
          detail.autoCancelForDelivery == "Yes" ? 1 : 0;
        detail.status = detail.status == "Active" ? 1 : 0;

        let deletedAt = null;
        let deletedById = null;
        //Inactive
        if (detail.status == 0) {
          deletedAt = new Date();
          deletedById = 484; //The admin
        }

        const createData: any = {
          groupCode: detail.groupCode ? detail.groupCode : null,
          code: detail.code ? detail.code : null,
          name: detail.name ? detail.name : null,
          legalName: detail.legalName ? detail.legalName : null,
          tradeName: detail.tradeName ? detail.tradeName : null,
          mobileNumber: detail.mobileNumber ? detail.mobileNumber : null,
          email: detail.email ? detail.email : null,
          gstin: detail.gstin ? detail.gstin : null,
          pan: detail.pan ? detail.pan : null,
          cin: detail.cin ? detail.cin : null,
          typeId: typeId,
          isExclusive: detail.isExclusive,
          clientId: clientId,
          mechanicalType: detail.mechanicalType,
          bodyPartType: detail.bodyPartType,
          rsaPersonName: detail.rsaPersonName ? detail.rsaPersonName : null,
          rsaPersonNumber: detail.rsaPersonNumber
            ? detail.rsaPersonNumber
            : null,
          rsaPersonAlternateNumber: detail.rsaPersonAlternateNumber
            ? detail.rsaPersonAlternateNumber
            : null,
          smName: detail.smName ? detail.smName : null,
          smNumber: detail.smNumber ? detail.smNumber : null,
          smAlternateNumber: detail.smAlternateNumber
            ? detail.smAlternateNumber
            : null,
          oemAsmName: detail.oemAsmName ? detail.oemAsmName : null,
          oemAsmNumber: detail.oemAsmNumber ? detail.oemAsmNumber : null,
          oemAsmAlternateNumber: detail.oemAsmAlternateNumber
            ? detail.oemAsmAlternateNumber
            : null,
          addressLineOne: detail.addressLineOne ? detail.addressLineOne : null,
          addressLineTwo: detail.addressLineTwo ? detail.addressLineTwo : null,
          correspondenceAddress: detail.correspondenceAddress
            ? detail.correspondenceAddress
            : null,
          stateId: stateId,
          cityId: cityId,
          area: detail.area ? detail.area : null,
          pincode: detail.pinCode ? detail.pinCode : null,
          lat: detail.latitude ? detail.latitude : null,
          long: detail.longitude ? detail.longitude : null,
          zoneId: zoneId,
          autoCancelForDelivery: detail.autoCancelForDelivery,
          createdById: 484, //The admin
          deletedById: deletedById,
          deletedAt: deletedAt,
        };

        const newDealer = await Dealer.create(createData, {
          transaction: transaction,
        });
        let userEntityId = newDealer.dataValues.id;
        let userCreatedByOrUpdatedById = {
          createdById: 484, //The admin
        };

        let userAddress = null;
        if (detail.correspondenceAddress) {
          userAddress = detail.correspondenceAddress;
        } else {
          if (detail.addressLineOne) {
            userAddress = detail.addressLineOne;
          }

          if (detail.addressLineTwo) {
            userAddress = userAddress
              ? userAddress + ", " + detail.addressLineTwo
              : detail.addressLineTwo;
          }
        }

        //Create user entry
        const userData = {
          userId: null,
          roleId: roleId,
          userTypeId: 140, //DEALER
          entityId: userEntityId,
          code: detail.code,
          name: detail.name,
          mobileNumber: detail.mobileNumber
            ? String(detail.mobileNumber)
            : null,
          email: detail.email ? detail.email : null,
          userName: detail.userName ? String(detail.userName) : null,
          password: detail.password,
          address: userAddress,
          changePassword: detail.changePassword,
          ignorePasswordPattern: 1,
          status: detail.status,
          deletedById: deletedById,
          ...userCreatedByOrUpdatedById,
        };

        const saveUserEntity = await axios.post(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
          userData
        );

        if (!saveUserEntity.data.success) {
          await transaction.rollback();
          let errors = saveUserEntity.data.errors
            ? saveUserEntity.data.errors.join(",")
            : saveUserEntity.data.error;
          console.log(`${detail.code} : ${errors}.`);
          continue;
        }

        createdDealerCount++;
        createdUserCount++;
        await transaction.commit();
      } catch (error: any) {
        await transaction.rollback();
        console.log(`${detail.code} : ${error.message}.`);
        continue;
      }
    }

    return {
      success: true,
      createdDealerCount,
      createdUserCount,
      message: "Synced successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

export default new DealerController();
