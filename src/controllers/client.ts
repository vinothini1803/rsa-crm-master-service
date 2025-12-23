import {
  Client,
  CallCenter,
  Config,
  State,
  City,
  Address,
  Country,
  SerialNumberCategories,
  FinancialYears,
  Service,
  Entitlement,
  ClientService,
  ClientServiceEntitlement,
  SubService,
  ClientCallCenter,
  SubServiceEntitlement,
  ClientVehicleType,
  ClientVehicleMake,
  VehicleType,
  VehicleMake,
  ClientEntitlement,
} from "../database/models/index";
import { Model, Op, Sequelize } from "sequelize";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import moment, { MomentInput } from "moment-timezone";
import axios from "axios";
import config from "../config/config.json";
import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class ClientController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, status, apiType, callCenterId } =
        req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      let clients = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }
        clients = await Client.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
          include: callCenterId
            ? [
                {
                  model: ClientCallCenter,
                  as: "callCenters",
                  attributes: [],
                  where: { callCenterId: callCenterId },
                  required: true,
                },
              ]
            : [],
        });

        if (clients.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        if (search) {
          where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            { axaptaCode: { [Op.like]: `%${search}%` } },
            { legalName: { [Op.like]: `%${search}%` } },
            { tradeName: { [Op.like]: `%${search}%` } },
            { customerTollFreeNumber: { [Op.like]: `%${search}%` } },
            { invoiceName: { [Op.like]: `%${search}%` } },
            { gstin: { [Op.like]: `%${search}%` } },
            Sequelize.literal(`businessCategory.name LIKE "%${search}%"`),
            Sequelize.literal(`serialNumberCategory.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (client.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
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
        let limitValue: number = ClientController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = ClientController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        clients = await Client.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "invoiceName",
            [Sequelize.col("businessCategory.name"), "businessCategoryName"],
            "legalName",
            "tradeName",
            "axaptaCode",
            "financialDimension",
            "gstin",
            "customerTollFreeNumber",
            "email",
            "contactNumber",
            "dialerCampaignName",
            [Sequelize.col("serialNumberCategory.shortName"), "invoiceCode"],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(client.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (client.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: Config,
              as: "businessCategory",
              attributes: [],
              required: false,
              paranoid: false,
            },
            {
              model: SerialNumberCategories,
              as: "serialNumberCategory",
              attributes: [],
              required: false,
              paranoid: false,
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (clients.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: clients,
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
      const { clientId } = req.query;
      let clientData = null;
      if (clientId) {
        const clientExists: any = await Client.findOne({
          where: {
            id: clientId,
          },
          include: [
            {
              model: SerialNumberCategories,
              as: "serialNumberCategory",
              attributes: ["shortName"],
              required: false,
              paranoid: false,
            },
            {
              model: ClientCallCenter,
              as: "callCenters",
              attributes: ["callCenterId"],
              required: false,
              paranoid: false,
            },
            {
              model: ClientVehicleType,
              as: "vehicleTypes",
              attributes: ["vehicleTypeId"],
              required: false,
              paranoid: false,
            },
            {
              model: ClientVehicleMake,
              as: "vehicleMakes",
              attributes: ["vehicleMakeId"],
              required: false,
              paranoid: false,
            },
            {
              model: ClientEntitlement,
              as: "clientEntitlements",
              attributes: ["entitlementId", "limit"],
              required: false,
            },
          ],
          paranoid: false,
        });
        if (!clientExists) {
          return res.status(200).json({
            success: false,
            error: "Client not found",
          });
        }

        let shippingAddressId = null;
        let shippingAddress = null;
        let shippingAddressCountryId = null;
        let shippingAddressStateId = null;
        let shippingAddressCityId = null;
        let shippingAddressPincode = null;

        let billingAddressId = null;
        let billingAddress = null;
        let billingAddressCountryId = null;
        let billingAddressStateId = null;
        let billingAddressCityId = null;
        let billingAddressPincode = null;

        let clientServices = null;
        let callCenterIds = null;
        if (clientExists.callCenters.length > 0) {
          callCenterIds = clientExists.callCenters.map(
            (clientCallCenter: any) => clientCallCenter.callCenterId
          );
        }

        let vehicleTypeIds = null;
        if (clientExists.vehicleTypes.length > 0) {
          vehicleTypeIds = clientExists.vehicleTypes.map(
            (clientVehicleType: any) => clientVehicleType.vehicleTypeId
          );
        }

        let vehicleMakeIds = null;
        if (clientExists.vehicleMakes.length > 0) {
          vehicleMakeIds = clientExists.vehicleMakes.map(
            (clientVehicleMake: any) => clientVehicleMake.vehicleMakeId
          );
        }

        const [
          shippingAddressData,
          billingAddressData,
          clientServiceAndSubServiceResponse,
        ]: any = await Promise.all([
          Address.findOne({
            where: {
              entityId: clientExists.dataValues.id,
              addressTypeId: 341,
              addressOfId: 350,
            },
            attributes: [
              "id",
              "address",
              "stateId",
              "cityId",
              "pincode",
              "deletedAt",
            ],
            include: [
              {
                model: State,
                attributes: ["countryId"],
                paranoid: false,
                required: false,
              },
            ],
          }),
          Address.findOne({
            where: {
              entityId: clientExists.dataValues.id,
              addressTypeId: 340,
              addressOfId: 350,
            },
            attributes: [
              "id",
              "address",
              "stateId",
              "cityId",
              "pincode",
              "deletedAt",
            ],
            include: [
              {
                model: State,
                attributes: ["countryId"],
                paranoid: false,
                required: false,
              },
            ],
          }),
          //CLIENT SERVICE AND SUB SERVICE ENTITLEMENTS
          getClientServiceAndSubServiceEntitlements("getFormData", clientId),
        ]);

        if (shippingAddressData) {
          shippingAddressId = shippingAddressData.id;
          shippingAddress = shippingAddressData.address;
          shippingAddressCountryId = shippingAddressData.state
            ? shippingAddressData.state.dataValues.countryId
            : null;
          shippingAddressStateId = shippingAddressData.stateId;
          shippingAddressCityId = shippingAddressData.cityId;
          shippingAddressPincode = shippingAddressData.pincode;
        }

        if (billingAddressData) {
          billingAddressId = billingAddressData.id;
          billingAddress = billingAddressData.address;
          billingAddressCountryId = billingAddressData.state
            ? billingAddressData.state.dataValues.countryId
            : null;
          billingAddressStateId = billingAddressData.stateId;
          billingAddressCityId = billingAddressData.cityId;
          billingAddressPincode = billingAddressData.pincode;
        }

        if (
          clientServiceAndSubServiceResponse &&
          clientServiceAndSubServiceResponse.success
        ) {
          clientServices = clientServiceAndSubServiceResponse.data;
        }

        clientData = {
          id: clientExists.dataValues.id,
          name: clientExists.dataValues.name,
          serialNumberCategoryId:
            clientExists.dataValues.deliveryRequestSerialNumberCategoryId,
          invoiceCode: clientExists.serialNumberCategory
            ? clientExists.serialNumberCategory.dataValues.shortName
            : null,
          invoiceName: clientExists.dataValues.invoiceName,
          businessCategoryId: clientExists.dataValues.businessCategoryId,
          legalName: clientExists.dataValues.legalName,
          tradeName: clientExists.dataValues.tradeName,
          axaptaCode: clientExists.dataValues.axaptaCode,
          financialDimension: clientExists.dataValues.financialDimension,
          gstin: clientExists.dataValues.gstin,
          customerTollFreeNumber:
            clientExists.dataValues.customerTollFreeNumber,
          asmTollFreeNumber: clientExists.dataValues.asmTollFreeNumber,
          nmTollFreeNumber: clientExists.dataValues.nmTollFreeNumber,
          fhTollFreeNumber: clientExists.dataValues.fhTollFreeNumber,
          aspTollFreeNumber: clientExists.dataValues.aspTollFreeNumber,
          rmTollFreeNumber: clientExists.dataValues.rmTollFreeNumber,
          didNumber: clientExists.dataValues.didNumber,
          spocUserId: clientExists.dataValues.spocUserId,
          callCenterIds: callCenterIds,
          email: clientExists.dataValues.email,
          contactNumber: clientExists.dataValues.contactNumber,
          dialerCampaignName: clientExists.dataValues.dialerCampaignName,
          billingAddressId: billingAddressId,
          billingAddress: billingAddress,
          billingAddressCountryId: billingAddressCountryId,
          billingAddressStateId: billingAddressStateId,
          billingAddressCityId: billingAddressCityId,
          billingAddressPincode: billingAddressPincode,
          shippingAddressId: shippingAddressId,
          shippingAddress: shippingAddress,
          shippingAddressCountryId: shippingAddressCountryId,
          shippingAddressStateId: shippingAddressStateId,
          shippingAddressCityId: shippingAddressCityId,
          shippingAddressPincode: shippingAddressPincode,
          clientServices: clientServices,
          vehicleTypeIds: vehicleTypeIds,
          vehicleMakeIds: vehicleMakeIds,
          // clientEntitlements: clientExists.clientEntitlements,
          entitlements: clientExists.clientEntitlements,
          status: clientExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const [
        businessCategories,
        countries,
        callCenters,
        services,
        policyTypes,
        entitlements,
        spocUserDetails,
        vehicleTypes,
        vehicleMakes,
        hasLimitEntitlements,
      ]: any = await Promise.all([
        Config.findAll({
          where: { typeId: 30 },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Country.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        CallCenter.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Service.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Config.findAll({
          where: { typeId: 40 },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Entitlement.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        axios.get(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getList}?apiType=dropdown&roleId=21`
        ),
        VehicleType.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        VehicleMake.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Entitlement.findAll({
          attributes: ["id", "name", "unitId"],
          where: {
            hasLimit: 1,
          },
          order: [["id", "asc"]],
          include: {
            model: Config,
            as: "unit",
            attributes: ["id", "name"],
          },
        }),
      ]);

      let spocUsers = [];
      if (spocUserDetails?.data?.success) {
        spocUsers = spocUserDetails.data.data;
      }

      const extras = {
        countries: countries,
        callCenters: callCenters,
        businessCategories: businessCategories,
        services: services,
        policyTypes: policyTypes,
        entitlements: entitlements,
        spocUsers: spocUsers,
        vehicleTypes: vehicleTypes,
        vehicleMakes: vehicleMakes,
        hasLimitEntitlements: hasLimitEntitlements,
      };

      const data = {
        client: clientData,
        extras: extras,
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

  getViewData = async (req: Request, res: Response) => {
    try {
      const { clientId } = req.query;
      if (!clientId) {
        return res.status(200).json({
          success: false,
          error: "Client ID is required",
        });
      }

      const [
        client,
        billingAddressData,
        shippingAddressData,
        clientServiceAndSubServiceResponse,
        clientEntitlements,
      ]: any = await Promise.all([
        Client.findOne({
          where: {
            id: clientId,
          },
          attributes: [
            "id",
            "name",
            "invoiceName",
            [Sequelize.col("businessCategory.name"), "businessCategoryName"],
            "legalName",
            "tradeName",
            "axaptaCode",
            "financialDimension",
            "gstin",
            "email",
            "contactNumber",
            "customerTollFreeNumber",
            "asmTollFreeNumber",
            "nmTollFreeNumber",
            "fhTollFreeNumber",
            "aspTollFreeNumber",
            "rmTollFreeNumber",
            "didNumber",
            "spocUserId",
            "dialerCampaignName",
            [Sequelize.col("serialNumberCategory.shortName"), "invoiceCode"],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(client.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (client.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: Config,
              as: "businessCategory",
              attributes: [],
              required: false,
              paranoid: false,
            },
            {
              model: ClientCallCenter,
              as: "callCenters",
              attributes: ["clientId"],
              required: false,
              paranoid: false,
              include: [
                {
                  model: CallCenter,
                  attributes: ["id", "name"],
                  required: false,
                  paranoid: false,
                },
              ],
            },

            {
              model: ClientVehicleType,
              as: "vehicleTypes",
              attributes: ["clientId"],
              required: false,
              paranoid: false,
              include: [
                {
                  model: VehicleType,
                  attributes: ["id", "name"],
                  required: false,
                  paranoid: false,
                },
              ],
            },

            {
              model: ClientVehicleMake,
              as: "vehicleMakes",
              attributes: ["clientId"],
              required: false,
              paranoid: false,
              include: [
                {
                  model: VehicleMake,
                  attributes: ["id", "name"],
                  required: false,
                  paranoid: false,
                },
              ],
            },

            {
              model: SerialNumberCategories,
              as: "serialNumberCategory",
              attributes: [],
              required: false,
              paranoid: false,
            },
          ],
          paranoid: false,
        }),
        Address.findOne({
          where: {
            entityId: clientId,
            addressTypeId: 340,
            addressOfId: 350,
          },
          attributes: [
            "id",
            "address",
            "stateId",
            "cityId",
            "pincode",
            "deletedAt",
          ],
          include: [
            {
              model: State,
              attributes: ["id", "countryId", "name"],
              paranoid: false,
              required: false,
              include: [
                {
                  model: Country,
                  as: "country",
                  attributes: ["id", "name"],
                  required: false,
                  paranoid: false,
                },
              ],
            },
            {
              model: City,
              attributes: ["id", "name"],
              paranoid: false,
              required: false,
            },
          ],
        }),
        Address.findOne({
          where: {
            entityId: clientId,
            addressTypeId: 341,
            addressOfId: 350,
          },
          attributes: [
            "id",
            "address",
            "stateId",
            "cityId",
            "pincode",
            "deletedAt",
          ],
          include: [
            {
              model: State,
              attributes: ["id", "countryId", "name"],
              paranoid: false,
              required: false,
              include: [
                {
                  model: Country,
                  as: "country",
                  attributes: ["id", "name"],
                  required: false,
                  paranoid: false,
                },
              ],
            },
            {
              model: City,
              attributes: ["id", "name"],
              paranoid: false,
              required: false,
            },
          ],
        }),
        //CLIENT SERVICE AND SUB SERVICE ENTITLEMENTS
        getClientServiceAndSubServiceEntitlements("view", clientId),
        ClientEntitlement.findAll({
          attributes: ["entitlementId", "limit"],
          where: {
            clientId: clientId,
          },
          include: [
            {
              model: Entitlement,
              attributes: ["id", "name", "unitId"],
              required: true,
              paranoid: false,
              include: [
                {
                  model: Config,
                  as: "unit",
                  attributes: ["id", "name"],
                  required: true,
                },
              ],
            },
          ],
        }),
      ]);

      if (!client) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      client.dataValues.callCenters = null;
      if (client.callCenters.length > 0) {
        client.dataValues.callCenters = client.callCenters
          .map(
            (clientCallCenter: any) =>
              clientCallCenter.callCenter?.dataValues?.name || null
          )
          .filter((value: any) => value !== null)
          .join(", ");
      }

      client.dataValues.vehicleTypes = null;
      if (client.vehicleTypes.length > 0) {
        client.dataValues.vehicleTypes = client.vehicleTypes
          .map(
            (clientVehicleType: any) =>
              clientVehicleType.vehicleType?.dataValues?.name || null
          )
          .filter((value: any) => value !== null)
          .join(", ");
      }

      client.dataValues.vehicleMakes = null;
      if (client.vehicleMakes.length > 0) {
        client.dataValues.vehicleMakes = client.vehicleMakes
          .map(
            (clientVehicleMake: any) =>
              clientVehicleMake.vehicleMake?.dataValues?.name || null
          )
          .filter((value: any) => value !== null)
          .join(", ");
      }

      client.dataValues.billingAddress = null;
      client.dataValues.billingAddressCountry = null;
      client.dataValues.billingAddressState = null;
      client.dataValues.billingAddressCity = null;
      client.dataValues.billingAddressPincode = null;
      if (billingAddressData) {
        client.dataValues.billingAddress = billingAddressData.address;
        client.dataValues.billingAddressCountry = billingAddressData.state
          ? billingAddressData.state.country
            ? billingAddressData.state.country.name
            : null
          : null;
        client.dataValues.billingAddressState = billingAddressData.state
          ? billingAddressData.state.name
          : null;
        client.dataValues.billingAddressCity = billingAddressData.city
          ? billingAddressData.city.name
          : null;
        client.dataValues.billingAddressPincode = billingAddressData.pincode;
      }

      client.dataValues.shippingAddress = null;
      client.dataValues.shippingAddressCountry = null;
      client.dataValues.shippingAddressState = null;
      client.dataValues.shippingAddressCity = null;
      client.dataValues.shippingAddressPincode = null;
      if (shippingAddressData) {
        client.dataValues.shippingAddress = shippingAddressData.address;
        client.dataValues.shippingAddressCountry = shippingAddressData.state
          ? shippingAddressData.state.country
            ? shippingAddressData.state.country.name
            : null
          : null;
        client.dataValues.shippingAddressState = shippingAddressData.state
          ? shippingAddressData.state.name
          : null;
        client.dataValues.shippingAddressCity = shippingAddressData.city
          ? shippingAddressData.city.name
          : null;
        client.dataValues.shippingAddressPincode = shippingAddressData.pincode;
      }

      let clientServices = null;
      if (
        clientServiceAndSubServiceResponse &&
        clientServiceAndSubServiceResponse.success
      ) {
        clientServices = clientServiceAndSubServiceResponse.data;
      }
      client.dataValues.clientServices = clientServices;

      //SPOC USER DETAIL
      client.dataValues.spocUserName = null;
      if (client.spocUserId) {
        const spocUserDetail = await axios.post(
          `${userServiceUrl}/user/${userServiceEndpoint.getUser}`,
          {
            id: client.spocUserId,
            setParanoidFalse: true,
          }
        );

        if (spocUserDetail?.data?.success) {
          client.dataValues.spocUserName = spocUserDetail.data.user.name;
        }
      }

      let clientEntitlementsArray = [];
      if (clientEntitlements?.length > 0) {
        clientEntitlementsArray = clientEntitlements.map(
          (clientEntitlement: any) => {
            return {
              entitlementId: clientEntitlement.entitlementId,
              name: clientEntitlement?.entitlement?.name || null,
              unit: clientEntitlement?.entitlement?.unit?.name || null,
              limit: clientEntitlement.limit,
            };
          }
        );
      }

      client.dataValues.clientEntitlements = clientEntitlementsArray;

      return res.status(200).json({
        success: true,
        message: "Client data fetched successfully",
        data: client,
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
      const validatorRules = {
        clientIds: "required|array",
        "clientIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { clientIds } = payload;
      if (clientIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one client",
        });
      }

      for (const clientId of clientIds) {
        const clientExists = await Client.findOne({
          where: {
            id: clientId,
          },
          paranoid: false,
        });
        if (!clientExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Client (${clientId}) not found`,
          });
        }

        await Promise.all([
          Client.destroy({
            where: {
              id: clientId,
            },
            force: true,
            transaction: transaction,
          }),
          Address.destroy({
            where: {
              entityId: clientExists.dataValues.id,
              addressOfId: 350,
              addressTypeId: {
                [Op.in]: [340, 341],
              },
            },
            force: true,
            transaction: transaction,
          }),
          SerialNumberCategories.destroy({
            where: {
              id: clientExists.dataValues.deliveryRequestSerialNumberCategoryId,
            },
            force: true,
            transaction: transaction,
          }),
          ClientCallCenter.destroy({
            where: {
              clientId: clientExists.dataValues.id,
            },
            force: true,
            transaction: transaction,
          }),
        ]);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Client deleted successfully",
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
      const validatorRules = {
        status: "required|numeric",
        clientIds: "required|array",
        "clientIds.*": "required",
      };

      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { clientIds, status, updatedById, deletedById } = payload;
      if (clientIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one client",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const clientId of clientIds) {
        const clientExists = await Client.findOne({
          where: {
            id: clientId,
          },
          paranoid: false,
        });

        if (!clientExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Client (${clientId}) not found`,
          });
        }

        await Client.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: clientId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Client status updated successfully",
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

  public async clientDataExport(req: Request, res: Response) {
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

      const clientData = await Client.findAll({
        where,
        attributes: [
          "id",
          "name",
          "deliveryRequestSerialNumberCategoryId",
          "invoiceName",
          "businessCategoryId",
          "legalName",
          "tradeName",
          "axaptaCode",
          "financialDimension",
          "gstin",
          "email",
          "contactNumber",
          "customerTollFreeNumber",
          "asmTollFreeNumber",
          "nmTollFreeNumber",
          "fhTollFreeNumber",
          "aspTollFreeNumber",
          "rmTollFreeNumber",
          "didNumber",
          "dialerCampaignName",
          "spocUserId",
          "createdAt",
          "deletedAt",
        ],
        paranoid: false,
        include: [
          {
            model: ClientCallCenter,
            as: "callCenters",
            attributes: ["id", "callCenterId"],
            paranoid: false,
          },
          {
            model: ClientVehicleType,
            as: "vehicleTypes",
            attributes: ["id", "vehicleTypeId"],
            paranoid: false,
          },
          {
            model: ClientVehicleMake,
            as: "vehicleMakes",
            attributes: ["id", "vehicleMakeId"],
            paranoid: false,
          },
        ],
      });

      if (!clientData || clientData.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //Get Final Data of Client
      const clientFinalData: any = await getClientFinalData(clientData);

      // Column Filter
      const renamedClientColumnNames = Object.keys(clientFinalData[0]);

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          clientFinalData,
          renamedClientColumnNames,
          format,
          "Clients"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(clientFinalData, renamedClientColumnNames);
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
  public async clientDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = [
      //   "Name",
      //   "Invoice Name",
      //   "Business Category",
      //   "Invoice Code",
      //   "Legal Name",
      //   "Trade Name",
      //   "Axapta Code",
      //   "Financial Dimension",
      //   "Gstin",
      //   "Call Center Names",
      //   "Email",
      //   "Contact Number",
      //   "Customer Toll Free Number",
      //   "ASM Toll Free Number",
      //   "NM Toll Free Number",
      //   "FH Toll Free Number",
      //   "ASP Toll Free Number",
      //   "RM Toll Free Number",
      //   "DID Number",
      //   "Billing Address",
      //   "Billing Country Name",
      //   "Billing State Name",
      //   "Billing City Name",
      //   "Billing Address Pincode",
      //   "Shipping Address",
      //   "Shipping Country Name",
      //   "Shipping State Name",
      //   "Shipping City Name",
      //   "Shipping Address Pincode",
      //   "SPOC User Name",
      //   "Status",
      // ];

      const importColumnsResponse = await Utils.getExcelImportColumns(1091);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1091,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      //GET ALL SPOC USER DETAILS
      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          roleIds: [21],
        }
      );
      let spocUserDetails = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        spocUserDetails = getUserDetails.data.data.roleUserDetails;
      }

      for (const data1 of inData) {
        let data2 = data1["data"];
        for (const data3 of data2) {
          importColumns.forEach((importColumn: any) => {
            if (!data3.hasOwnProperty(importColumn)) {
              data3[importColumn] = "";
            }
          });

          let reArrangedClients: any = {
            Name: data3["Name"] ? String(data3["Name"]) : null,
            "Dialer Campaign Name": data3["Dialer Campaign Name"]
              ? String(data3["Dialer Campaign Name"])
              : null,
            "Invoice Name": data3["Invoice Name"]
              ? String(data3["Invoice Name"])
              : null,
            "Business Category": data3["Business Category"]
              ? String(data3["Business Category"])
              : null,
            "Invoice Code": data3["Invoice Code"]
              ? String(data3["Invoice Code"])
              : null,
            "Legal Name": data3["Legal Name"]
              ? String(data3["Legal Name"])
              : null,
            "Trade Name": data3["Trade Name"]
              ? String(data3["Trade Name"])
              : null,
            "Axapta Code": data3["Axapta Code"]
              ? String(data3["Axapta Code"])
              : null,
            "Financial Dimension": data3["Financial Dimension"]
              ? String(data3["Financial Dimension"])
              : null,
            Gstin: data3["Gstin"] ? String(data3["Gstin"]) : null,
            "Call Center Names": data3["Call Center Names"]
              ? String(data3["Call Center Names"])
              : null,
            Email: data3["Email"] ? String(data3["Email"]) : null,
            "Contact Number": data3["Contact Number"]
              ? String(data3["Contact Number"])
              : null,
            "Customer Toll Free Number": data3["Customer Toll Free Number"]
              ? String(data3["Customer Toll Free Number"])
              : null,
            "ASM Toll Free Number": data3["ASM Toll Free Number"]
              ? String(data3["ASM Toll Free Number"])
              : null,
            "NM Toll Free Number": data3["NM Toll Free Number"]
              ? String(data3["NM Toll Free Number"])
              : null,
            "FH Toll Free Number": data3["FH Toll Free Number"]
              ? String(data3["FH Toll Free Number"])
              : null,
            "ASP Toll Free Number": data3["ASP Toll Free Number"]
              ? String(data3["ASP Toll Free Number"])
              : null,
            "RM Toll Free Number": data3["RM Toll Free Number"]
              ? String(data3["RM Toll Free Number"])
              : null,
            "DID Number": data3["DID Number"]
              ? String(data3["DID Number"])
              : null,
            "Billing Address": data3["Billing Address"]
              ? String(data3["Billing Address"])
              : null,
            "Billing Country Name": data3["Billing Country Name"]
              ? String(data3["Billing Country Name"])
              : null,
            "Billing State Name": data3["Billing State Name"]
              ? String(data3["Billing State Name"])
              : null,
            "Billing City Name": data3["Billing City Name"]
              ? String(data3["Billing City Name"])
              : null,
            "Billing Address Pincode": data3["Billing Address Pincode"]
              ? String(data3["Billing Address Pincode"])
              : null,
            "Shipping Address": data3["Shipping Address"]
              ? String(data3["Shipping Address"])
              : null,
            "Shipping Country Name": data3["Shipping Country Name"]
              ? String(data3["Shipping Country Name"])
              : null,
            "Shipping State Name": data3["Shipping State Name"]
              ? String(data3["Shipping State Name"])
              : null,
            "Shipping City Name": data3["Shipping City Name"]
              ? String(data3["Shipping City Name"])
              : null,
            "Shipping Address Pincode": data3["Shipping Address Pincode"]
              ? String(data3["Shipping Address Pincode"])
              : null,
            "SPOC User Name": data3["SPOC User Name"]
              ? String(data3["SPOC User Name"])
              : null,
            "Vehicle Type Names": data3["Vehicle Type Names"]
              ? String(data3["Vehicle Type Names"])
              : null,
            "Vehicle Make Names": data3["Vehicle Make Names"]
              ? String(data3["Vehicle Make Names"])
              : null,
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          const keyMapping: any = {
            businessCategory: "businessCategoryId",
            callCenterNames: "callCenterIds",
            aSMTollFreeNumber: "asmTollFreeNumber",
            nMTollFreeNumber: "nmTollFreeNumber",
            fHTollFreeNumber: "fhTollFreeNumber",
            aSPTollFreeNumber: "aspTollFreeNumber",
            rMTollFreeNumber: "rmTollFreeNumber",
            dIDNumber: "didNumber",
            billingCountryName: "billingAddressCountryId",
            billingStateName: "billingAddressStateId",
            billingCityName: "billingAddressCityId",
            shippingCountryName: "shippingAddressCountryId",
            shippingStateName: "shippingAddressStateId",
            shippingCityName: "shippingAddressCityId",
            sPOCUserName: "spocUserName",
          };

          for (const key in reArrangedClients) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedClients[key];
          }

          const validationErrors = [];
          if (record.gstin && !/^[A-Za-z0-9 ]+$/.test(record.gstin)) {
            validationErrors.push("Invalid gstin.");
          }

          if (
            record.contactNumber &&
            !/^[0-9]{10}$/.test(record.contactNumber)
          ) {
            validationErrors.push("Invalid contact number.");
          }

          if (
            record.customerTollFreeNumber &&
            !/^1800\d{7}$/.test(record.customerTollFreeNumber)
          ) {
            validationErrors.push("Invalid customer toll free number.");
          }

          if (
            record.asmTollFreeNumber &&
            !/^1800\d{7}$/.test(record.asmTollFreeNumber)
          ) {
            validationErrors.push("Invalid asm toll free number.");
          }

          if (
            record.nmTollFreeNumber &&
            !/^1800\d{7}$/.test(record.nmTollFreeNumber)
          ) {
            validationErrors.push("Invalid nm toll free number.");
          }

          if (
            record.fhTollFreeNumber &&
            !/^1800\d{7}$/.test(record.fhTollFreeNumber)
          ) {
            validationErrors.push("Invalid fh toll free number.");
          }

          if (
            record.aspTollFreeNumber &&
            !/^1800\d{7}$/.test(record.aspTollFreeNumber)
          ) {
            validationErrors.push("Invalid asp toll free number.");
          }

          if (
            record.rmTollFreeNumber &&
            !/^1800\d{7}$/.test(record.rmTollFreeNumber)
          ) {
            validationErrors.push("Invalid rm toll free number.");
          }

          if (record.didNumber && /[A-Za-z]/.test(record.didNumber)) {
            validationErrors.push("Invalid did number.");
          }

          if (
            record.billingAddressPincode &&
            !/^\d{6}$/.test(record.billingAddressPincode)
          ) {
            validationErrors.push("Invalid billing address pincode.");
          }

          if (
            record.shippingAddressPincode &&
            !/^\d{6}$/.test(record.shippingAddressPincode)
          ) {
            validationErrors.push("Invalid shipping address pincode.");
          }

          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          if (validationErrors.length > 0) {
            errorOutData.push({
              ...reArrangedClients,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //GET CLIENT, ADDRESS, SERIAL NUMBER CATEGORY DATA
          let clientId = null;
          let serialNumberCategoryId = null;
          let billingAddressId = null;
          let shippingAddressId = null;
          if (record.name) {
            const trimmedClientName = record.name.trim();
            const clientExists = await Client.findOne({
              where: {
                name: trimmedClientName,
              },
              attributes: ["id", "deliveryRequestSerialNumberCategoryId"],
              paranoid: false,
            });
            if (clientExists) {
              clientId = clientExists.dataValues.id;
              serialNumberCategoryId =
                clientExists.dataValues.deliveryRequestSerialNumberCategoryId;

              //BILLING ADDRESS
              const billingAddressExists = await Address.findOne({
                where: {
                  entityId: clientId,
                  addressTypeId: 340, //BILLING ADDRESS
                  addressOfId: 350, //CLIENT
                },
                attributes: ["id"],
                paranoid: false,
              });
              if (billingAddressExists) {
                billingAddressId = billingAddressExists.dataValues.id;
              }

              //SHIPPING ADDRESS
              const shippingAddressExists = await Address.findOne({
                where: {
                  entityId: clientId,
                  addressTypeId: 341, //SHIPPING ADDRESS
                  addressOfId: 350, //CLIENT
                },
                attributes: ["id"],
                paranoid: false,
              });
              if (shippingAddressExists) {
                shippingAddressId = shippingAddressExists.dataValues.id;
              }
            }
          }

          //BUSINESS CATEGORY
          let businessCategoryId = 0;
          if (record.businessCategoryId) {
            const trimmedBusinessCategory = record.businessCategoryId.trim();
            const businessCategoryExists = await Config.findOne({
              where: {
                name: trimmedBusinessCategory,
                typeId: 30,
              },
              attributes: ["id"],
            });

            if (businessCategoryExists) {
              businessCategoryId = businessCategoryExists.dataValues.id;
            }
          }

          //CALL CENTERS
          let callCenterIds = [];
          let callCenterDetails = [];
          if (record.callCenterIds) {
            for (const callCenterId of record.callCenterIds.split(",")) {
              const trimmedCallCentreName = callCenterId.trim();
              const callCentreDetail: any = await CallCenter.findOne({
                where: {
                  name: trimmedCallCentreName,
                },
                attributes: ["id"],
                paranoid: false,
              });
              if (callCentreDetail) {
                callCenterIds.push(callCentreDetail.id);
              }

              callCenterDetails.push({
                name: trimmedCallCentreName,
                id: callCentreDetail ? callCentreDetail.id : null,
              });
            }
          }

          //BILLING COUNTRY
          let billingCountryId = 0;
          if (record.billingAddressCountryId) {
            const trimmedBillingCountryName =
              record.billingAddressCountryId.trim();
            const billingCountryExists = await Country.findOne({
              where: {
                name: trimmedBillingCountryName,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (billingCountryExists) {
              billingCountryId = billingCountryExists.dataValues.id;
            }
          }

          //BILLING STATE
          let billingStateId = 0;
          if (record.billingAddressStateId && billingCountryId) {
            const trimmedBillingStateName = record.billingAddressStateId.trim();
            const billingStateExists = await State.findOne({
              where: {
                name: trimmedBillingStateName,
                countryId: billingCountryId,
              },
              attributes: ["id", "countryId"],
              paranoid: false,
            });

            if (billingStateExists) {
              billingStateId = billingStateExists.dataValues.id;
            }
          }

          //BILLING CITY
          let billingCityId = 0;
          if (record.billingAddressCityId && billingStateId) {
            const trimmedBillingCityName = record.billingAddressCityId.trim();
            const billingCityExists = await City.findOne({
              where: {
                name: trimmedBillingCityName,
                stateId: billingStateId,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (billingCityExists) {
              billingCityId = billingCityExists.dataValues.id;
            }
          }

          //SHIPPING COUNTRY
          let shippingCountryId = 0;
          if (record.shippingAddressCountryId) {
            const trimmedShippingCountryName =
              record.shippingAddressCountryId.trim();
            const shippingCountryExists = await Country.findOne({
              where: {
                name: trimmedShippingCountryName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (shippingCountryExists) {
              shippingCountryId = shippingCountryExists.dataValues.id;
            }
          }

          //SHIPPING STATE
          let shippingStateId = 0;
          if (record.shippingAddressStateId && shippingCountryId) {
            const trimmedShippingStateName =
              record.shippingAddressStateId.trim();
            const shippingStateExists = await State.findOne({
              where: {
                name: trimmedShippingStateName,
                countryId: shippingCountryId,
              },
              attributes: ["id", "countryId"],
              paranoid: false,
            });

            if (shippingStateExists) {
              shippingStateId = shippingStateExists.dataValues.id;
            }
          }

          //SHIPPING CITY
          let shippingCityId = 0;
          if (record.shippingAddressCityId && shippingStateId) {
            const trimmedShippingCityName = record.shippingAddressCityId.trim();
            const nameAlreadyExists = await City.findOne({
              where: {
                name: trimmedShippingCityName,
                stateId: shippingStateId,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (nameAlreadyExists) {
              shippingCityId = nameAlreadyExists.dataValues.id;
            }
          }

          //SPOC USER
          let spocUserId = 0;
          if (record.spocUserName) {
            const trimmedSpocUserName = record.spocUserName.trim();
            const spocUserDetail = spocUserDetails.find(
              (spocUserDetail: any) =>
                spocUserDetail.userName == trimmedSpocUserName &&
                spocUserDetail.roleId == 21
            );
            if (spocUserDetail) {
              spocUserId = spocUserDetail.id;
            }
          }

          //VEHICLE TYPES
          let vehicleTypeIds = [];
          let vehicleTypeDetails = [];
          if (record.vehicleTypeNames) {
            for (const vehicleTypeName of record.vehicleTypeNames.split(",")) {
              const trimmedVehicleTypeName = vehicleTypeName.trim();
              const vehicleTypeDetail: any = await VehicleType.findOne({
                attributes: ["id"],
                where: {
                  name: trimmedVehicleTypeName,
                },
                paranoid: false,
              });

              if (vehicleTypeDetail) {
                vehicleTypeIds.push(vehicleTypeDetail.id);
              }

              vehicleTypeDetails.push({
                name: trimmedVehicleTypeName,
                id: vehicleTypeDetail ? vehicleTypeDetail.id : null,
              });
            }
          }

          //VEHICLE MAKES
          let vehicleMakeIds = [];
          let vehicleMakeDetails = [];
          if (record.vehicleMakeNames) {
            for (const vehicleMakeName of record.vehicleMakeNames.split(",")) {
              const trimmedVehicleMakeName = vehicleMakeName.trim();
              const vehicleMakeDetail: any = await VehicleMake.findOne({
                attributes: ["id"],
                where: {
                  name: trimmedVehicleMakeName,
                },
                paranoid: false,
              });

              if (vehicleMakeDetail) {
                vehicleMakeIds.push(vehicleMakeDetail.id);
              }

              vehicleMakeDetails.push({
                name: trimmedVehicleMakeName,
                id: vehicleMakeDetail ? vehicleMakeDetail.id : null,
              });
            }
          }

          //REQUESTS FOR CLIENT SAVE
          record.clientId = clientId;
          record.businessCategoryId = businessCategoryId;
          record.callCenterIds = callCenterIds;
          record.callCenterDetails = callCenterDetails;
          record.billingAddressId = billingAddressId;
          record.billingAddressStateId = billingStateId;
          record.billingAddressCountryId = billingCountryId;
          record.billingAddressCityId = billingCityId;
          record.shippingAddressId = shippingAddressId;
          record.shippingAddressStateId = shippingStateId;
          record.shippingAddressCountryId = shippingCountryId;
          record.shippingAddressCityId = shippingCityId;
          record.serialNumberCategoryId = serialNumberCategoryId;
          record.spocUserId = spocUserId;

          record.vehicleTypeIds = vehicleTypeIds;
          record.vehicleTypeDetails = vehicleTypeDetails;

          record.vehicleMakeIds = vehicleMakeIds;
          record.vehicleMakeDetails = vehicleMakeDetails;

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
              ...reArrangedClients,
              Error: errorContent,
            });
          } else {
            if (output.message === "Client created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New client created (${newRecordsCreated} records) and existing client updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New client created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing client updated (${existingRecordsUpdated} records)`
          : "No client updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of Client
      const clientFinalData: any = errorOutData;

      // Column Filter
      const renamedClientColumnNames = Object.keys(clientFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        clientFinalData,
        renamedClientColumnNames,
        "xlsx",
        "Client"
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

  getDetail = async (req: any, res: any) => {
    try {
      const { clientId } = req.query;

      const client: any = await Client.findByPk(clientId, {
        attributes: ["id", "name"],
        paranoid: false,
      });

      if (!client) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: client,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getClientServiceEntitlementDetails = async (req: any, res: any) => {
    try {
      const { clientId, serviceId, policyTypeId, membershipTypeId } = req.body;

      const clientService: any = await ClientService.findOne({
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
        where: {
          clientId: clientId,
          serviceId: serviceId,
          policyTypeId: policyTypeId,
          membershipTypeId: membershipTypeId ? membershipTypeId : null,
        },
        include: [
          {
            model: Service,
            as: "service",
            attributes: ["id", "name"],
          },
          {
            model: Config,
            as: "policyType",
          },
        ],
      });

      if (!clientService) {
        return res
          .status(200)
          .json({ success: false, error: "Client service not found" });
      }

      const clientServiceEntitlements: any =
        await ClientServiceEntitlement.findAll({
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
          where: { clientServiceId: clientService.dataValues.id },
          include: [
            {
              model: SubService,
              as: "subService",
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
            },
            {
              model: Entitlement,
              as: "entitlement",
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
                  as: "unit",
                },
              ],
            },
          ],
        });

      if (clientServiceEntitlements.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Client service entitlement not found",
        });
      }
      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: {
          clientService,
          clientServiceEntitlements,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getClientDetail = async (req: any, res: any) => {
    try {
      const { clientId } = req.body;

      const client: any = await Client.findOne({ where: { id: clientId } });

      if (!client) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: client,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getUserClients = async (req: Request, res: Response) => {
    try {
      let payload = req.body;
      const validateData = {
        userId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      //GET USER CLIENT VIA USER SERVICE
      const getUserClients: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getUserClients}`,
        {
          userId: payload.userId,
        }
      );

      let clients: any = [];
      if (getUserClients.data.success) {
        //AGENT
        if (getUserClients.data.user.roleId == 3) {
          clients = await Client.findAll({
            where: {
              id: {
                [Op.in]: getUserClients.data.clientIds,
              },
            },
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          });
        } else {
          clients = await Client.findAll({
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: clients,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  //USED IN RSA CRM QUICK SEARCH, CALL INITIATION (CUSTOMER SERVICE MAPPING) & POLICY DETAIL ADD AND UPDATE
  getClientServiceEntitlements = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const [clientServices, clientEntitlements]: any = await Promise.all([
        ClientService.findAll({
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
          where: {
            clientId: payload.clientId,
            policyTypeId: payload.policyTypeId,
            membershipTypeId: payload.membershipTypeId || null,
          },
          include: [
            {
              model: ClientServiceEntitlement,
              as: "clientServiceEntitlements",
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
                  model: SubService,
                  as: "subService",
                  attributes: ["id", "name", "hasLimit"],
                },
                {
                  model: Entitlement,
                  as: "entitlement",
                  attributes: ["id"],
                  include: [
                    {
                      model: Config,
                      as: "unit",
                    },
                  ],
                },
              ],
            },
            {
              model: Service,
              as: "service",
              attributes: ["id", "name"],
            },
          ],
        }),
        ClientEntitlement.findAll({
          attributes: ["id", "entitlementId", "limit"],
          where: {
            clientId: payload.clientId,
          },
        }),
      ]);

      if (clientServices.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Client services not found",
        });
      }

      if (clientEntitlements.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Client entitlement not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: clientServices,
        clientEntitlements: clientEntitlements,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  public async serviceEntitlementImport(req: any, res: any) {
    try {
      const inData: any[] = req.body.jsonDataArray;
      const errorData: any = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      // let importColumns = [
      //   "Client Name",
      //   "Service Name",
      //   "Policy Type Name",
      //   "Membership Type Name",
      //   "Total Service",
      //   "Sub Service Name",
      //   "Limit",
      //   "Entitlement Name",
      // ];

      const importColumnsResponse = await Utils.getExcelImportColumns(1092);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1092,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const membershipTypesResponse: any = await axios.get(
        `${process.env.RSA_BASE_URL}/crm/allMembershipTypes`
      );

      let allMembershipTypes = [];
      if (
        membershipTypesResponse.data &&
        membershipTypesResponse.data.success
      ) {
        allMembershipTypes = membershipTypesResponse.data.membership_types;
      }

      const sheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      let loopIndex = 0;
      let sheetDetails = [];
      const serviceEntitlementDetails: any = [];
      for (const sheet of sheets) {
        importColumns.forEach((importColumn: any) => {
          if (!sheet.hasOwnProperty(importColumn)) {
            sheet[importColumn] = "";
          }
        });

        loopIndex++;
        let reArrangedServiceEntitlements: any = {
          "Client Name": sheet["Client Name"]
            ? String(sheet["Client Name"])
            : null,
          "Service Name": sheet["Service Name"]
            ? String(sheet["Service Name"])
            : null,
          "Policy Type Name": sheet["Policy Type Name"]
            ? String(sheet["Policy Type Name"])
            : null,
          "Membership Type Name": sheet["Membership Type Name"]
            ? String(sheet["Membership Type Name"])
            : null,
          "Total Service": sheet["Total Service"]
            ? String(sheet["Total Service"])
            : null,
          "Sub Service Name": sheet["Sub Service Name"]
            ? String(sheet["Sub Service Name"])
            : null,
          Limit: sheet["Limit"] ? String(sheet["Limit"]) : null,
          "Entitlement Name": sheet["Entitlement Name"]
            ? String(sheet["Entitlement Name"])
            : null,
        };

        //HEADER WITH DETAIL WHICH IS USED FOR ERROR SHEET CREATION
        sheetDetails.push({
          index: loopIndex,
          ...reArrangedServiceEntitlements,
        });

        const record: any = {};
        for (const key in reArrangedServiceEntitlements) {
          let transformedKey = key
            .replace(/\s+/g, "")
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
              index === 0 ? word.toLowerCase() : word.toUpperCase()
            );

          // Check if key has a mapping, use the mapping if available
          record[transformedKey] = reArrangedServiceEntitlements[key];
        }

        let errors = [];
        //CLIENT
        let clientId = 0;
        let sheetClientName: any = null;
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
          }

          sheetClientName = trimmedClientName;
        } else {
          errors.push("Client not found");
        }

        //SERVICE
        let serviceId = 0;
        if (record.serviceName) {
          const trimmedServiceName = record.serviceName.trim();
          const serviceExists: any = await Service.findOne({
            where: {
              name: trimmedServiceName,
            },
            attributes: ["id"],
            paranoid: false,
          });
          if (serviceExists) {
            serviceId = serviceExists.id;
          }
        } else {
          errors.push("Service not found");
        }

        //POLICY TYPE
        let policyTypeId = 0;
        if (record.policyTypeName) {
          const trimmedPolicyTypeName = record.policyTypeName.trim();
          const policyTypeExists: any = await Config.findOne({
            where: {
              name: trimmedPolicyTypeName,
              typeId: 40, //Policy Types
            },
            attributes: ["id"],
          });
          if (policyTypeExists) {
            policyTypeId = policyTypeExists.id;
          }
        } else {
          errors.push("Policy type not found");
        }

        //MEMBERSHIP TYPE GET FROM SALES PORTAL
        let membershipTypeId: any = null;
        let sheetMembershipTypeName = null;
        if (record.membershipTypeName && sheetClientName) {
          const trimmedMembershipTypeName = record.membershipTypeName.trim();
          const membershipTypeDetail = allMembershipTypes.find(
            (membershipType: any) =>
              membershipType.client_name == sheetClientName &&
              membershipType.name == trimmedMembershipTypeName
          );

          if (membershipTypeDetail) {
            membershipTypeId = membershipTypeDetail.id;
            sheetMembershipTypeName = membershipTypeDetail.name;
          }
        }

        //CLIENT SERVICE
        let clientServiceId = null;
        const clientServiceExists: any = await ClientService.findOne({
          where: {
            clientId: clientId,
            serviceId: serviceId,
            policyTypeId: policyTypeId,
            membershipTypeId: membershipTypeId ? membershipTypeId : null,
          },
          attributes: ["id"],
          paranoid: false,
        });
        if (clientServiceExists) {
          clientServiceId = clientServiceExists.id;
        }

        //SUB SERVICE
        let subServiceId = 0;
        if (record.subServiceName) {
          const trimmedSubServiceName = record.subServiceName.trim();
          const subServiceExists: any = await SubService.findOne({
            where: {
              name: trimmedSubServiceName,
              serviceId: serviceId,
            },
            attributes: ["id"],
          });
          if (subServiceExists) {
            subServiceId = subServiceExists.id;
          }
        }

        //ENTITLEMENT
        let entitlementId = null;
        let sheetEntitlementName = null;
        if (record.entitlementName) {
          const trimmedEntitlementName = record.entitlementName.trim();
          const entitlementExists: any = await Entitlement.findOne({
            where: {
              name: trimmedEntitlementName,
            },
            attributes: ["id"],
          });
          if (entitlementExists) {
            entitlementId = entitlementExists.id;
          }

          sheetEntitlementName = trimmedEntitlementName;
        }

        //CLIENT SERVICE ENTITLEMENT
        let clientServiceEntitlementId = null;
        const clientServiceEntitlementExists: any =
          await ClientServiceEntitlement.findOne({
            where: {
              clientServiceId: clientServiceId,
              subServiceId: subServiceId,
            },
            attributes: ["id"],
            paranoid: false,
          });
        if (clientServiceEntitlementExists) {
          clientServiceEntitlementId = clientServiceEntitlementExists.id;
        }

        if (errors.length > 0) {
          errorData.push({
            ...reArrangedServiceEntitlements,
            Error: errors.join(", "),
          });
          continue;
        }

        //FORM EXCEL RECORDS BASED ON CLIENT SERVICE ENTITLEMENTS
        const existingIndex = serviceEntitlementDetails.findIndex(
          (item: any) => {
            return (
              item.clientId == clientId &&
              item.serviceId == serviceId &&
              item.policyTypeId == policyTypeId &&
              item.membershipTypeId == membershipTypeId
            );
          }
        );

        const serviceEntitlementObject = {
          index: loopIndex,
          clientServiceEntitlementId: clientServiceEntitlementId,
          subServiceId: subServiceId,
          limit: record.limit,
          entitlementId: entitlementId,
          sheetEntitlementName: sheetEntitlementName,
        };

        if (existingIndex !== -1) {
          //PUSH ENTITLEMENT TO EXISTING CLIENT SERVICE DETAILS
          if (!serviceEntitlementDetails[existingIndex].subServices) {
            serviceEntitlementDetails[existingIndex].subServices = [];
          }

          serviceEntitlementDetails[existingIndex].indexes.push(loopIndex);
          serviceEntitlementDetails[existingIndex].subServices.push(
            serviceEntitlementObject
          );
        } else {
          //PUSH NEW CLIENT SERVICE WITH ENTITLEMENT DETAILS
          serviceEntitlementDetails.push({
            clientServiceId: clientServiceId,
            clientId: clientId,
            // clientName: sheetClientName,
            serviceId: serviceId,
            policyTypeId: policyTypeId,
            membershipTypeId: membershipTypeId,
            membershipTypeName: sheetMembershipTypeName,
            totalService: record.totalService,
            indexes: [loopIndex],
            subServices: [serviceEntitlementObject],
          });
        }
      }

      //FORM SERVICE ENTITLEMENTS BASED ON CLIENT
      const clientBaseServiceEntitlements: any = [];
      for (const serviceEntitlementDetail of serviceEntitlementDetails) {
        const existingClientService = clientBaseServiceEntitlements.find(
          (item: any) => item.clientId === serviceEntitlementDetail.clientId
        );

        if (existingClientService) {
          existingClientService.services.push({
            ...serviceEntitlementDetail,
          });
        } else {
          clientBaseServiceEntitlements.push({
            clientId: serviceEntitlementDetail.clientId,
            services: [
              {
                ...serviceEntitlementDetail,
              },
            ],
          });
        }
      }

      for (const clientBaseServiceEntitlement of clientBaseServiceEntitlements) {
        let apiResponse: any = await saveClientServiceAndSubServices(
          "import",
          clientBaseServiceEntitlement.clientId,
          clientBaseServiceEntitlement.services,
          ""
        );

        if (apiResponse && apiResponse.success) {
          //ERROR INDEXES
          let errorIndexes: any = [];
          if (apiResponse.importErrors.length > 0) {
            for (const importError of apiResponse.importErrors) {
              errorIndexes.push(...importError.indexes);

              //CLIENT SERVICE ENTITLEMENT DATA ERROR
              if (importError.index) {
                for (const index of importError.indexes) {
                  const sheetDetail = sheetDetails.find(
                    (item: any) => item.index == index
                  );

                  errorData.push({
                    ...sheetDetail,
                    Error: index == importError.index ? importError.error : "",
                  });
                }
              } else if (importError.indexes) {
                //CLIENT SERVICE DATA ERROR
                for (const index of importError.indexes) {
                  const sheetDetail = sheetDetails.find(
                    (item: any) => item.index == index
                  );
                  errorData.push({
                    ...sheetDetail,
                    Error: importError.error,
                  });
                }
              }
            }
          }

          //OMIT ERROR INDEXES FROM RECORDS AND GET SUCCESS INDEXES
          const filteredSuccessDetails =
            clientBaseServiceEntitlement.services.filter((item: any) => {
              return !item.indexes.some((index: any) =>
                errorIndexes.includes(index)
              );
            });

          for (const filteredSuccessDetail of filteredSuccessDetails) {
            if (filteredSuccessDetail.clientServiceId) {
              existingRecordsUpdated =
                existingRecordsUpdated +
                filteredSuccessDetail.subServices.length;
            } else {
              newRecordsCreated =
                newRecordsCreated + filteredSuccessDetail.subServices.length;
            }
          }
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New client service entitlement created (${newRecordsCreated} records) and existing client service entitlement updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New client service entitlement created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing client service entitlement updated (${existingRecordsUpdated} records)`
          : "No client service entitlement created or updated";

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
        "ClientServiceEntitlements"
      );
      Utils.setExcelHeaders(res, "xlsx");

      //Respond
      return res.status(200).json({
        success: true,
        message: successMessage,
        errorReportBuffer: buffer,
      });
    } catch (error: any) {
      // console.log(error);
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async serviceEntitlementExport(req: any, res: any) {
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

      const clientServiceEntitlements: any =
        await ClientServiceEntitlement.findAll({
          where,
          attributes: [
            "id",
            "subServiceId",
            "limit",
            "entitlementId",
            "createdAt",
          ],
          paranoid: false,
          include: [
            {
              model: ClientService,
              as: "clientService",
              attributes: [
                "id",
                "clientId",
                "serviceId",
                "policyTypeId",
                "membershipTypeId",
                "totalService",
              ],
              paranoid: false,
            },
          ],
        });
      if (
        !clientServiceEntitlements ||
        clientServiceEntitlements.length === 0
      ) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      //GET ALL MEMBERSHIP TYPES FROM SALES PORTAL
      const membershipTypesResponse: any = await axios.get(
        `${process.env.RSA_BASE_URL}/crm/allMembershipTypes`
      );

      let allMembershipTypes = [];
      if (
        membershipTypesResponse.data &&
        membershipTypesResponse.data.success
      ) {
        allMembershipTypes = membershipTypesResponse.data.membership_types;
      }

      let clientServiceEntitlementsArray: any[] = [];
      for (const clientServiceEntitlement of clientServiceEntitlements) {
        let membershipTypeName = null;
        if (clientServiceEntitlement.clientService.membershipTypeId) {
          const membershipTypeDetail = allMembershipTypes.find(
            (membershipType: any) =>
              membershipType.id ==
              clientServiceEntitlement.clientService.membershipTypeId
          );

          if (membershipTypeDetail) {
            membershipTypeName = membershipTypeDetail.name;
          }
        }

        const [client, service, policyType, subService, entitlement]: any =
          await Promise.all([
            Client.findOne({
              attributes: ["id", "name"],
              where: {
                id: clientServiceEntitlement.clientService.clientId,
              },
              paranoid: false,
            }),
            Service.findOne({
              attributes: ["id", "name"],
              where: {
                id: clientServiceEntitlement.clientService.serviceId,
              },
              paranoid: false,
            }),
            Config.findOne({
              attributes: ["id", "name"],
              where: {
                id: clientServiceEntitlement.clientService.policyTypeId,
              },
              paranoid: false,
            }),
            SubService.findOne({
              attributes: ["id", "name"],
              where: {
                id: clientServiceEntitlement.subServiceId,
              },
              paranoid: false,
            }),
            Entitlement.findOne({
              attributes: ["id", "name"],
              where: {
                id: clientServiceEntitlement.entitlementId,
              },
              paranoid: false,
            }),
          ]);

        clientServiceEntitlementsArray.push({
          "Client Name": client ? client.name : "",
          "Service Name": service ? service.name : "",
          "Policy Type Name": policyType ? policyType.name : "",
          "Membership Type Name": membershipTypeName,
          "Total Service": clientServiceEntitlement.clientService.totalService,
          "Sub Service Name": subService ? subService.name : "",
          Limit: clientServiceEntitlement.limit,
          "Entitlement Name": entitlement ? entitlement.name : "",
          "Created At": moment
            .tz(clientServiceEntitlement.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
        });
      }

      // Column Filter;
      const clientServiceEntitlementColumnNames = clientServiceEntitlementsArray
        ? Object.keys(clientServiceEntitlementsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          clientServiceEntitlementsArray,
          clientServiceEntitlementColumnNames,
          format,
          "ClientServiceEntitlements"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          clientServiceEntitlementsArray,
          clientServiceEntitlementColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Client service entitlement export successfully`,
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

  getClientDetailByDid = async (req: any, res: any) => {
    try {
      const { did } = req.body;

      const client: any = await Client.findOne({ where: { didNumber: did } });

      if (!client) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: client,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public async entitlementImport(req: any, res: any) {
    try {
      const inData: any[] = req.body.jsonDataArray;
      let errorData: any[] = [];

      const importColumnsResponse = await Utils.getExcelImportColumns(1125);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1125,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const sheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      let entitlements: any = [];
      for (const sheet of sheets) {
        importColumns.forEach((importColumn: any) => {
          if (!sheet.hasOwnProperty(importColumn)) {
            sheet[importColumn] = "";
          }
        });

        const trimmedClientName = sheet["Client Name"]
          ? String(sheet["Client Name"]).trim()
          : null;
        const trimmedEntitlementName = sheet["Entitlement Name"]
          ? String(sheet["Entitlement Name"]).trim()
          : null;
        const trimmedLimit = sheet["Limit"]
          ? String(sheet["Limit"]).trim()
          : null;

        const validationErrors = [];
        if (!trimmedClientName) {
          validationErrors.push("Client name is required");
        }

        if (!trimmedEntitlementName) {
          validationErrors.push("Entitlement name is required");
        }

        if (!trimmedLimit) {
          validationErrors.push("Limit is required");
        }

        if (validationErrors.length > 0) {
          errorData.push({
            ...sheet,
            Error: validationErrors.join(", "),
          });
          continue;
        }

        //Client
        const client: any = await Client.findOne({
          attributes: ["id"],
          where: { name: trimmedClientName },
          paranoid: false,
        });

        if (!client) {
          errorData.push({
            ...sheet,
            Error: "Client not found",
          });
          continue;
        }

        //Entitlement
        let entitlement: any = await Entitlement.findOne({
          attributes: ["id"],
          where: {
            name: trimmedEntitlementName,
            hasLimit: 1,
          },
          paranoid: false,
        });

        if (!entitlement) {
          errorData.push({
            ...sheet,
            Error: "Entitlement not found",
          });
          continue;
        }

        const record: any = {};
        record.clientId = client.id;
        record.entitlementId = entitlement.id;
        record.limit = trimmedLimit;
        entitlements.push(record);
      }

      let groupBy: any = (array: any, key: any) => {
        return array.reduce((result: any, currentItem: any) => {
          const groupKey = currentItem[key];
          if (!result[groupKey]) {
            result[groupKey] = [];
          }
          result[groupKey].push(currentItem);
          return result;
        }, {});
      };

      const groupedEntitlements = groupBy(entitlements, "clientId");
      let result: any;
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      for (let clientId in groupedEntitlements) {
        result = await saveEntitlements(
          groupedEntitlements[clientId],
          clientId,
          null,
          "import"
        );

        if (result && result.success) {
          newRecordsCreated += result.newRecordsCreated;
          existingRecordsUpdated += result.existingRecordsUpdated;
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New client entitlement created successfully (${newRecordsCreated} records) and existing client entitlement updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New client entitlement created successfully (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing client entitlement updated (${existingRecordsUpdated} records)`
          : "No client entitlement created or updated";

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
        "User Skills"
      );

      //Set Header;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

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

  public async entitlementExport(req: any, res: any) {
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

      const clientEntitlements: any = await ClientEntitlement.findAll({
        where,
        attributes: ["id", "entitlementId", "limit", "createdAt"],
        include: [
          {
            model: Client,
            attributes: ["id", "name"],
            paranoid: false,
          },
          {
            model: Entitlement,
            attributes: ["id", "name", "unitId"],
            paranoid: false,
            include: [
              {
                model: Config,
                as: "unit",
                attributes: ["id", "name"],
              },
            ],
          },
        ],
        paranoid: false,
      });
      if (!clientEntitlements || clientEntitlements.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      const clientEntitlementsArray: any[] = clientEntitlements.map(
        (clientEntitlement: any) => {
          return {
            "Client Name": clientEntitlement?.client?.name || "",
            "Entitlement Name": clientEntitlement?.entitlement?.name || "",
            Unit: clientEntitlement?.entitlement?.unit?.name || "",
            Limit: clientEntitlement.limit,
            "Created At": moment
              .tz(clientEntitlement.createdAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A"),
          };
        }
      );

      const clientEntitlementColumnNames = clientEntitlementsArray
        ? Object.keys(clientEntitlementsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          clientEntitlementsArray,
          clientEntitlementColumnNames,
          format,
          "ClientEntitlements"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          clientEntitlementsArray,
          clientEntitlementColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Client entitlement export successfully`,
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
    if (importData !== undefined) {
      payload = importData;
    } else {
      payload = req.body;
    }
    //VALIDATIONS
    const validatorRules = {
      clientId: "numeric",
      serialNumberCategoryId: "nullable",
      invoiceCode: "required|string|maxLength:60",
      name: "required|string|minLength:3|maxLength:255",
      invoiceName: "required|string|maxLength:191",
      businessCategoryId: "required|numeric",
      legalName: "required|string|maxLength:191",
      tradeName: "required|string|maxLength:191",
      axaptaCode: "required|string|maxLength:60",
      financialDimension: "required|string|maxLength:161",
      // gstin: "required|string|maxLength:60",
      gstin: "required|string|minLength:15|maxLength:15",
      // callCenterIds: "required|array",
      // "callCenterIds.*": "numeric",
      email: "nullable|email|maxLength:255",
      contactNumber: "nullable|string|minLength:10|maxLength:10",
      customerTollFreeNumber: "string|maxLength:11",
      asmTollFreeNumber: "string|maxLength:11",
      nmTollFreeNumber: "string|maxLength:11",
      fhTollFreeNumber: "string|maxLength:11",
      aspTollFreeNumber: "string|maxLength:11",
      rmTollFreeNumber: "string|maxLength:11",
      didNumber: "string|maxLength:12",
      dialerCampaignName: "string|maxLength:199",
      billingAddressId: "nullable",
      billingAddress: "required|string",
      billingAddressCountryId: "required|numeric",
      billingAddressStateId: "required|numeric",
      billingAddressCityId: "required|numeric",
      billingAddressPincode: "required|string",
      shippingAddressId: "nullable",
      shippingAddress: "required|string",
      shippingAddressCountryId: "required|numeric",
      shippingAddressStateId: "required|numeric",
      shippingAddressCityId: "required|numeric",
      shippingAddressPincode: "required|string",
      spocUserId: "nullable",
      status: "required|numeric",
    };

    const errors = await Utils.validateParams(payload, validatorRules);
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

    // Check if businessCategoryId is provided
    const businessCategoryId = payload.businessCategoryId;
    // if (businessCategoryId) {
    const businessCategoryExists = await Config.findOne({
      where: {
        id: businessCategoryId,
      },
    });
    if (!businessCategoryExists) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Business category not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Business category not found",
        });
      }
    }
    // }

    if (!payload.callCenterIds || payload.callCenterIds.length == 0) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Call center not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Call center not found",
        });
      }
    }

    // CHECK CALL CENTER IDS CONTAINS DUPLICATE VALUE
    if (
      payload.callCenterIds &&
      payload.callCenterIds.length > 0 &&
      Utils.hasDuplicates(payload.callCenterIds)
    ) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Call Center has already taken",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Call Center has already taken",
        });
      }
    }

    if (!payload.vehicleTypeIds || payload.vehicleTypeIds.length == 0) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Vehicle type not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Vehicle type not found",
        });
      }
    }

    // CHECK VEHICLE TYPE IDS CONTAINS DUPLICATE VALUE
    if (
      payload.vehicleTypeIds &&
      payload.vehicleTypeIds.length > 0 &&
      Utils.hasDuplicates(payload.vehicleTypeIds)
    ) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Vehicle type has already taken",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Vehicle type has already taken",
        });
      }
    }

    if (!payload.vehicleMakeIds || payload.vehicleMakeIds.length == 0) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Vehicle make not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Vehicle make not found",
        });
      }
    }

    // CHECK VEHICLE MAKE IDS CONTAINS DUPLICATE VALUE
    if (
      payload.vehicleMakeIds &&
      payload.vehicleMakeIds.length > 0 &&
      Utils.hasDuplicates(payload.vehicleMakeIds)
    ) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Vehicle make has already taken",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Vehicle make has already taken",
        });
      }
    }

    if (importData) {
      for (const callCenterDetail of payload.callCenterDetails) {
        if (callCenterDetail.name && !callCenterDetail.id) {
          await transaction.rollback();
          return {
            success: false,
            error: `Call center ${callCenterDetail.name} not found`,
            data: payload,
          };
        }
      }

      if (payload.spocUserName && !payload.spocUserId) {
        await transaction.rollback();
        return {
          success: false,
          error: `SPOC user not found`,
          data: payload,
        };
      }

      for (const vehicleTypeDetail of payload.vehicleTypeDetails) {
        if (vehicleTypeDetail.name && !vehicleTypeDetail.id) {
          await transaction.rollback();
          return {
            success: false,
            error: `Vehicle type ${vehicleTypeDetail.name} not found`,
            data: payload,
          };
        }
      }

      for (const vehicleMakeDetail of payload.vehicleMakeDetails) {
        if (vehicleMakeDetail.name && !vehicleMakeDetail.id) {
          await transaction.rollback();
          return {
            success: false,
            error: `Vehicle make ${vehicleMakeDetail.name} not found`,
            data: payload,
          };
        }
      }
    }

    const [
      billingCountry,
      billingState,
      billingCity,
      shippingCountry,
      shippingState,
      shippingCity,
    ]: any = await Promise.all([
      Country.findOne({
        attributes: ["id"],
        where: {
          id: payload.billingAddressCountryId,
        },
        paranoid: false,
      }),
      State.findOne({
        attributes: ["id"],
        where: {
          id: payload.billingAddressStateId,
        },
        paranoid: false,
      }),
      City.findOne({
        attributes: ["id"],
        where: {
          id: payload.billingAddressCityId,
        },
        paranoid: false,
      }),
      Country.findOne({
        attributes: ["id"],
        where: {
          id: payload.shippingAddressCountryId,
        },
        paranoid: false,
      }),
      State.findOne({
        attributes: ["id"],
        where: {
          id: payload.shippingAddressStateId,
        },
        paranoid: false,
      }),
      City.findOne({
        attributes: ["id"],
        where: {
          id: payload.shippingAddressCityId,
        },
        paranoid: false,
      }),
    ]);

    if (!billingCountry) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Billing country not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Billing country not found",
        });
      }
    }

    if (!billingState) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Billing state not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Billing state not found",
        });
      }
    }

    if (!billingCity) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Billing city not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Billing city not found",
        });
      }
    }

    if (!shippingCountry) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Shipping country not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Shipping country not found",
        });
      }
    }

    if (!shippingState) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Shipping state not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Shipping state not found",
        });
      }
    }

    if (!shippingCity) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Shipping city not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Shipping city not found",
        });
      }
    }

    const {
      clientId,
      name,
      invoiceCode,
      serialNumberCategoryId,
      ...inputData
    } = payload;
    const clientName = name.trim();
    const serialNumberCategoryName = "Delivery Request";
    const serialNumberCategoryShortName = invoiceCode.trim();
    if (clientId) {
      const client = await Client.findOne({
        where: {
          id: clientId,
        },
        paranoid: false,
      });
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

      const clientAlreadyExists = await Client.findOne({
        where: {
          name: clientName,
          id: {
            [Op.ne]: clientId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (clientAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Client name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Client name is already taken",
          });
        }
      }

      const serialNumberCategory = await SerialNumberCategories.findOne({
        where: {
          id: serialNumberCategoryId,
        },
        paranoid: false,
      });
      if (!serialNumberCategory) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Serial number category not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Serial number category not found",
          });
        }
      }

      const serialNumberCategoryExists = await SerialNumberCategories.findOne({
        where: {
          name: serialNumberCategoryName,
          shortName: serialNumberCategoryShortName,
          id: {
            [Op.ne]: serialNumberCategoryId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (serialNumberCategoryExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Invoice code is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Invoice code is already taken",
          });
        }
      }
    } else {
      const clientAlreadyExists: any = await Client.findOne({
        where: {
          name: clientName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (clientAlreadyExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Client name is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Client name is already taken",
          });
        }
      }

      const serialNumberCategoryExists = await SerialNumberCategories.findOne({
        where: {
          name: serialNumberCategoryName,
          shortName: serialNumberCategoryShortName,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (serialNumberCategoryExists) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "Invoice code is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Invoice code is already taken",
          });
        }
      }
    }

    const currentFinancialYear = Utils.getCurrentFinancialYear();
    const financialYear = await FinancialYears.findOne({
      where: { from: currentFinancialYear },
      attributes: ["id", "code"],
    });
    if (!financialYear) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Financial year not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Financial year not found",
        });
      }
    }

    let generateSerialNumberResponse = await Utils.generateClientSerialNumber(
      serialNumberCategoryId,
      serialNumberCategoryName,
      serialNumberCategoryShortName,
      financialYear.dataValues.id,
      financialYear.dataValues.code,
      inputData.authUserId,
      transaction
    );
    if (!generateSerialNumberResponse.success) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: generateSerialNumberResponse.error,
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: generateSerialNumberResponse.error,
        });
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
      name: clientName,
      deletedById: deletedById,
      deletedAt: deletedAt,
      deliveryRequestSerialNumberCategoryId:
        generateSerialNumberResponse.serialNumberCategoryId,
    };

    let message = null;
    let entityId: any = null;
    if (clientId) {
      await Client.update(data, {
        where: {
          id: clientId,
        },
        paranoid: false,
        transaction: transaction,
      });
      entityId = clientId;
      message = "Client updated successfully";
    } else {
      const createdClient: any = await Client.create(data, {
        transaction: transaction,
      });
      entityId = createdClient.dataValues.id;
      message = "Client created successfully";
    }
    const billingAddress = {
      id: inputData.billingAddressId,
      addressTypeId: 340,
      addressOfId: 350,
      entityId: entityId,
      address: inputData.billingAddress,
      stateId: inputData.billingAddressStateId,
      cityId: inputData.billingAddressCityId,
      pincode: inputData.billingAddressPincode,
    };

    const shippingAddress = {
      id: inputData.shippingAddressId,
      addressTypeId: 341,
      addressOfId: 350,
      entityId: entityId,
      address: inputData.shippingAddress,
      stateId: inputData.shippingAddressStateId,
      cityId: inputData.shippingAddressCityId,
      pincode: inputData.shippingAddressPincode,
    };

    await saveAddress(billingAddress, transaction);
    await saveAddress(shippingAddress, transaction);

    //CLIENT SERVICE AND SUB SERVICE ENTITLEMENTS SAVE
    if (inputData.clientServices && inputData.clientServices.length > 0) {
      let clientServiceAndSubServiceResponse =
        await saveClientServiceAndSubServices(
          "form",
          entityId,
          inputData.clientServices,
          transaction
        );
      if (
        clientServiceAndSubServiceResponse &&
        !clientServiceAndSubServiceResponse.success
      ) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: clientServiceAndSubServiceResponse.error,
        });
      }
    }

    //SAVE CALL CENTERS
    await ClientCallCenter.destroy({
      where: {
        clientId: entityId,
      },
      force: true,
      transaction: transaction,
    });
    if (inputData.callCenterIds && inputData.callCenterIds.length > 0) {
      const callCenterData = inputData.callCenterIds.map(
        (callCenterId: number) => ({
          clientId: entityId,
          callCenterId: callCenterId,
        })
      );
      await ClientCallCenter.bulkCreate(callCenterData, {
        transaction,
      });
    }

    //SAVE VEHICLE TYPES
    await ClientVehicleType.destroy({
      where: {
        clientId: entityId,
      },
      force: true,
      transaction: transaction,
    });
    if (inputData.vehicleTypeIds && inputData.vehicleTypeIds.length > 0) {
      const vehicleTypeData = inputData.vehicleTypeIds.map(
        (vehicleTypeId: number) => ({
          clientId: entityId,
          vehicleTypeId: vehicleTypeId,
        })
      );
      await ClientVehicleType.bulkCreate(vehicleTypeData, {
        transaction,
      });
    }

    //SAVE VEHICLE MAKES
    await ClientVehicleMake.destroy({
      where: {
        clientId: entityId,
      },
      force: true,
      transaction: transaction,
    });
    if (inputData.vehicleMakeIds && inputData.vehicleMakeIds.length > 0) {
      const vehicleMakeData = inputData.vehicleMakeIds.map(
        (vehicleMakeId: number) => ({
          clientId: entityId,
          vehicleMakeId: vehicleMakeId,
        })
      );
      await ClientVehicleMake.bulkCreate(vehicleMakeData, {
        transaction,
      });
    }

    //CLIENT ENTITLEMENTS SAVE
    const clientEntitlementResponse = await saveEntitlements(
      inputData.entitlements,
      entityId,
      transaction,
      "form"
    );
    if (clientEntitlementResponse && !clientEntitlementResponse.success) {
      await transaction.rollback();
      return res.status(200).json({
        success: false,
        error: clientEntitlementResponse.error,
      });
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

async function saveAddress(addressInfo: any, transaction: any) {
  try {
    if (addressInfo.id) {
      await Address.update(addressInfo, {
        where: {
          id: addressInfo.id,
        },
        paranoid: false,
        transaction: transaction,
      });
    } else {
      await Address.create(addressInfo, {
        transaction: transaction,
      });
    }
  } catch (error: any) {
    throw error;
  }
}

//Data Column and Data key, value rearrange (Final Data)
async function getClientFinalData(clientData: any) {
  //GET CLIENT SPOC USER AND CLIENT CALL CENTER DETAILS
  const userIds = new Set();
  const callCenterIds = new Set();

  const vehicleTypeIds = new Set();
  const vehicleMakeIds = new Set();
  for (const client of clientData) {
    if (client.spocUserId) {
      userIds.add(client.spocUserId);
    }

    for (const callCenter of client.callCenters) {
      callCenterIds.add(callCenter.callCenterId);
    }

    for (const vehicleType of client.vehicleTypes) {
      vehicleTypeIds.add(vehicleType.vehicleTypeId);
    }

    for (const vehicleMake of client.vehicleMakes) {
      vehicleMakeIds.add(vehicleMake.vehicleMakeId);
    }
  }

  const uniqueUserIdsArray = [...userIds];
  let userDetails: any = [];
  if (uniqueUserIdsArray && uniqueUserIdsArray.length > 0) {
    const getUserDetails: any = await axios.post(
      `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
      {
        userIds: uniqueUserIdsArray,
      }
    );

    if (getUserDetails.data && getUserDetails.data.success) {
      userDetails = getUserDetails.data.data.userDetails;
    }
  }

  const uniqueCallCenterIdsArray = [...callCenterIds];
  let callCenterDetails: any = [];
  if (uniqueCallCenterIdsArray && uniqueCallCenterIdsArray.length > 0) {
    callCenterDetails = await CallCenter.findAll({
      where: {
        id: uniqueCallCenterIdsArray,
      },
      attributes: ["id", "name"],
      paranoid: false,
    });
  }

  const uniqueVehicleTypeIdsArray = [...vehicleTypeIds];
  let vehicleTypeDetails: any = [];
  if (uniqueVehicleTypeIdsArray && uniqueVehicleTypeIdsArray.length > 0) {
    vehicleTypeDetails = await VehicleType.findAll({
      where: {
        id: uniqueVehicleTypeIdsArray,
      },
      attributes: ["id", "name"],
      paranoid: false,
    });
  }

  const uniqueVehicleMakeIdsArray = [...vehicleMakeIds];
  let vehicleMakeDetails: any = [];
  if (uniqueVehicleMakeIdsArray && uniqueVehicleMakeIdsArray.length > 0) {
    vehicleMakeDetails = await VehicleMake.findAll({
      where: {
        id: uniqueVehicleMakeIdsArray,
      },
      attributes: ["id", "name"],
      paranoid: false,
    });
  }

  const transformedData = await Promise.all(
    clientData.map(async (clientData: any) => {
      const [businessCategory, deliveryRequestSerialNumberCategory]: any =
        await Promise.all([
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: clientData.dataValues.businessCategoryId },
          }),
          SerialNumberCategories.findOne({
            attributes: ["id", "shortName"],
            where: {
              id: clientData.dataValues.deliveryRequestSerialNumberCategoryId,
            },
            paranoid: false,
          }),
        ]);

      const getEntityAddress = async (addressTypeId: number) => {
        const address = await Address.findOne({
          where: {
            entityId: clientData.dataValues.id,
            addressTypeId: addressTypeId,
            addressOfId: 350,
          },
          paranoid: false,
        });

        let state = null;
        let city = null;
        let country = null;
        if (address) {
          state = await State.findOne({
            attributes: ["id", "countryId", "name"],
            where: { id: address.dataValues.stateId },
            paranoid: false,
          });

          city = await City.findOne({
            attributes: ["id", "name"],
            where: { id: address.dataValues.cityId },
            paranoid: false,
          });

          if (state) {
            country = await Country.findOne({
              attributes: ["id", "name"],
              where: { id: state.dataValues.countryId },
              paranoid: false,
            });
          }
        }

        return {
          address: address ? address.dataValues.address : null,
          countryName: country ? country.dataValues.name : null,
          stateName: state ? state.dataValues.name : null,
          cityName: city ? city.dataValues.name : null,
          pincode: address ? address.dataValues.pincode : null,
        };
      };

      const billingAddress = await getEntityAddress(340);
      const shippingAddress = await getEntityAddress(341);

      const callCenterNames = [];
      for (const callCenter of clientData.callCenters) {
        const callCenterData = callCenterDetails.find(
          (callCenterDetail: any) =>
            callCenterDetail.id == callCenter.callCenterId
        );
        if (callCenterData) {
          callCenterNames.push(callCenterData.dataValues.name);
        }
      }

      let spocUserDetail = null;
      if (clientData.dataValues.spocUserId) {
        spocUserDetail = userDetails.find(
          (userDetail: any) => userDetail.id == clientData.dataValues.spocUserId
        );
      }

      const vehicleTypeNames = [];
      for (const vehicleType of clientData.vehicleTypes) {
        const vehicleTypeData = vehicleTypeDetails.find(
          (vehicleTypeDetail: any) =>
            vehicleTypeDetail.id == vehicleType.vehicleTypeId
        );
        if (vehicleTypeData) {
          vehicleTypeNames.push(vehicleTypeData.dataValues.name);
        }
      }

      const vehicleMakeNames = [];
      for (const vehicleMake of clientData.vehicleMakes) {
        const vehicleMakeData = vehicleMakeDetails.find(
          (vehicleMakeDetail: any) =>
            vehicleMakeDetail.id == vehicleMake.vehicleMakeId
        );
        if (vehicleMakeData) {
          vehicleMakeNames.push(vehicleMakeData.dataValues.name);
        }
      }

      return {
        Name: clientData.dataValues.name,
        Email: clientData.dataValues.email,
        "Contact Number": clientData.dataValues.contactNumber,
        "Axapta Code": clientData.dataValues.axaptaCode,
        "Legal Name": clientData.dataValues.legalName,
        "Trade Name": clientData.dataValues.tradeName,
        "Invoice Code": deliveryRequestSerialNumberCategory
          ? deliveryRequestSerialNumberCategory.dataValues.shortName
          : null,
        "Financial Dimension": clientData.dataValues.financialDimension,
        "Invoice Name": clientData.dataValues.invoiceName,
        GSTIN: clientData.dataValues.gstin,
        "Customer Toll Free Number":
          clientData.dataValues.customerTollFreeNumber,
        "ASM Toll Free Number": clientData.dataValues.asmTollFreeNumber,
        "NM Toll Free Number": clientData.dataValues.nmTollFreeNumber,
        "FH Toll Free Number": clientData.dataValues.fhTollFreeNumber,
        "ASP Toll Free Number": clientData.dataValues.aspTollFreeNumber,
        "RM Toll Free Number": clientData.dataValues.rmTollFreeNumber,
        "DID Number": clientData.dataValues.didNumber,
        "Dialer Campaign Name": clientData.dataValues.dialerCampaignName,
        "Call Center Names": callCenterNames.join(", "),
        "TVS SPOC User Name": spocUserDetail ? spocUserDetail.name : null,
        "Business Category": businessCategory
          ? businessCategory.dataValues.name
          : null,
        "Vehicle Type Names": vehicleTypeNames.join(", "),
        "Vehicle Make Names": vehicleMakeNames.join(", "),
        "Billing Address": billingAddress.address,
        "Billing Country Name": billingAddress.countryName,
        "Billing State Name": billingAddress.stateName,
        "Billing City Name": billingAddress.cityName,
        "Billing Address Pincode": billingAddress.pincode,
        "Shipping Address": shippingAddress.address,
        "Shipping Country Name": shippingAddress.countryName,
        "Shipping State Name": shippingAddress.stateName,
        "Shipping City Name": shippingAddress.cityName,
        "Shipping Address Pincode": shippingAddress.pincode,
        "Created At": moment
          .tz(clientData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: clientData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );

  return transformedData;
}

// async function saveClientServiceAndSubServices(
//   from: string,
//   clientId: number,
//   clientServices: any,
//   transaction: any
// ) {
//   if (from == "import") {
//     transaction = await sequelize.transaction();
//   }

//   if (!clientId) {
//     return {
//       success: false,
//       error: "Client not found",
//     };
//   }

//   const existingClientServices = await ClientService.findAll({
//     where: { clientId: clientId },
//     attributes: ["id"],
//     paranoid: false,
//     transaction,
//   });
//   if (existingClientServices.length > 0) {
//     for (const existingClientService of existingClientServices) {
//       let removeExistingClientService = false;
//       if (clientServices.length > 0) {
//         const existingClientServiceExists = clientServices.find(
//           (givenClientService: any) =>
//             givenClientService.clientServiceId ==
//             existingClientService.dataValues.id
//         );

//         //NOT EXIST THEN DELETE THE EXISTING CLIENT SERVICE
//         if (!existingClientServiceExists) {
//           removeExistingClientService = true;
//         }
//       } else {
//         removeExistingClientService = true;
//       }

//       if (removeExistingClientService) {
//         await ClientService.destroy({
//           where: {
//             id: existingClientService.dataValues.id,
//           },
//           force: true,
//           transaction: transaction,
//         });
//       }
//     }
//   }

//   let clientServiceIndex = 0;
//   for (const clientService of clientServices) {
//     clientServiceIndex++;
//     const clientServiceValidator = new Validator(clientService, {
//       clientServiceId: "nullable|numeric",
//       serviceId: "required|numeric",
//       policyTypeId: "required|numeric",
//       membershipTypeId: "nullable|numeric",
//       membershipTypeName: "nullable|string",
//       totalService: "required|numeric",
//     });

//     const clientServiceMatched = await clientServiceValidator.check();
//     if (!clientServiceMatched) {
//       const clientServiceErrors: any = [];
//       Object.keys(clientService).forEach((clientServiceKey) => {
//         if (clientServiceValidator.errors[clientServiceKey]) {
//           clientServiceErrors.push(
//             `Service (${clientServiceIndex}): ${clientServiceValidator.errors[clientServiceKey].message}`
//           );
//         }
//       });

//       await transaction.rollback();
//       return {
//         success: false,
//         error: clientServiceErrors,
//       };
//     }

//     if (clientService.subServices.length == 0) {
//       await transaction.rollback();
//       return {
//         success: false,
//         error: `Service (${clientServiceIndex}): sub service entitlement is required`,
//       };
//     }

//     const totalLimit = clientService.subServices.reduce(
//       (total: number, subService: any) => {
//         return total + (subService.limit || 0);
//       },
//       0
//     );
//     if (totalLimit > clientService.totalService) {
//       await transaction.rollback();
//       return {
//         success: false,
//         error: `Service (${clientServiceIndex}): sub service total limits should be less than or equal to total service`,
//       };
//     }

//     const subServiceWithoutLimitExists = clientService.subServices.some(
//       (subServiceRecord: any) => {
//         return !subServiceRecord.limit;
//       }
//     );
//     if (
//       subServiceWithoutLimitExists &&
//       totalLimit == clientService.totalService
//     ) {
//       await transaction.rollback();
//       return {
//         success: false,
//         error: `Service (${clientServiceIndex}): you have allocated all total service limit to specific sub service, Kindly split it.`,
//       };
//     }

//     const { clientServiceId, ...clientServiceInputData } = clientService;

//     const service = await Service.findOne({
//       attributes: ["id", "name"],
//       where: {
//         id: clientServiceInputData.serviceId,
//       },
//       transaction,
//     });
//     if (!service) {
//       await transaction.rollback();
//       return {
//         success: false,
//         error: `Service (${clientServiceIndex}): service not found`,
//       };
//     }

//     const policyType = await Config.findOne({
//       where: {
//         id: clientServiceInputData.policyTypeId,
//       },
//       transaction,
//     });
//     if (!policyType) {
//       await transaction.rollback();
//       return {
//         success: false,
//         error: `Service (${clientServiceIndex}): policy type not found`,
//       };
//     }

//     if (clientServiceId) {
//       //UPDATE
//       const checkClientServiceAlreadyExists = await ClientService.findOne({
//         attributes: ["id"],
//         where: {
//           clientId: clientId,
//           serviceId: clientServiceInputData.serviceId,
//           policyTypeId: clientServiceInputData.policyTypeId,
//           membershipTypeId: clientServiceInputData.membershipTypeId || null,
//           id: {
//             [Op.ne]: clientServiceId,
//           },
//         },
//         paranoid: false,
//         transaction: transaction,
//       });
//       if (checkClientServiceAlreadyExists) {
//         await transaction.rollback();
//         return {
//           success: false,
//           error: `Service (${clientServiceIndex}): is already taken`,
//         };
//       }
//     } else {
//       //NEW
//       const checkClientServiceAlreadyExists = await ClientService.findOne({
//         attributes: ["id"],
//         where: {
//           clientId: clientId,
//           serviceId: clientServiceInputData.serviceId,
//           policyTypeId: clientServiceInputData.policyTypeId,
//           membershipTypeId: clientServiceInputData.membershipTypeId || null,
//         },
//         paranoid: false,
//         transaction: transaction,
//       });

//       if (checkClientServiceAlreadyExists) {
//         await transaction.rollback();
//         return {
//           success: false,
//           error: `Service (${clientServiceIndex}): is already taken`,
//         };
//       }
//     }

//     const clientServiceData: any = {
//       clientId: clientId,
//       serviceId: clientServiceInputData.serviceId,
//       policyTypeId: clientServiceInputData.policyTypeId,
//       membershipTypeId: clientServiceInputData.membershipTypeId || null,
//       membershipTypeName: clientServiceInputData.membershipTypeName || null,
//       totalService: clientServiceInputData.totalService,
//     };

//     let clientServicePrimaryId = null;
//     if (clientServiceId) {
//       await ClientService.update(clientServiceData, {
//         where: {
//           id: clientServiceId,
//         },
//         paranoid: false,
//         transaction: transaction,
//       });
//       clientServicePrimaryId = clientServiceId;
//     } else {
//       const newClientService = await ClientService.create(clientServiceData, {
//         transaction: transaction,
//       });
//       clientServicePrimaryId = newClientService.dataValues.id;
//     }

//     //SUB SERVICE ENTITLEMENT
//     const existingClientSubServices = await ClientServiceEntitlement.findAll({
//       where: { clientServiceId: clientServicePrimaryId },
//       attributes: ["id"],
//       paranoid: false,
//       transaction,
//     });
//     if (existingClientSubServices.length > 0) {
//       for (const existingClientSubService of existingClientSubServices) {
//         let removeExistingClientSubService = false;
//         if (clientService.subServices && clientService.subServices.length > 0) {
//           const existingClientSubServiceExists = clientService.subServices.find(
//             (givenClientSubService: any) =>
//               givenClientSubService.clientServiceEntitlementId ==
//               existingClientSubService.dataValues.id
//           );

//           //NOT EXIST THEN DELETE THE EXISTING CLIENT SUB SERVICE
//           if (!existingClientSubServiceExists) {
//             removeExistingClientSubService = true;
//           }
//         } else {
//           removeExistingClientSubService = true;
//         }

//         if (removeExistingClientSubService) {
//           await ClientServiceEntitlement.destroy({
//             where: {
//               id: existingClientSubService.dataValues.id,
//             },
//             force: true,
//             transaction: transaction,
//           });
//         }
//       }
//     }

//     let subServiceIndex = 0;
//     for (const subService of clientService.subServices) {
//       subServiceIndex++;
//       const subServiceValidator = new Validator(subService, {
//         clientServiceEntitlementId: "nullable|numeric",
//         subServiceId: "required|numeric",
//         limit: "nullable|numeric",
//         entitlementId: "nullable|numeric",
//       });
//       const subServiceMatched = await subServiceValidator.check();
//       if (!subServiceMatched) {
//         const subServiceErrors: any = [];
//         Object.keys(subService).forEach((subServiceKey) => {
//           if (subServiceValidator.errors[subServiceKey]) {
//             subServiceErrors.push(
//               `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): ${subServiceValidator.errors[subServiceKey].message}`
//             );
//           }
//         });

//         await transaction.rollback();
//         return {
//           success: false,
//           error: subServiceErrors,
//         };
//       }

//       const { clientServiceEntitlementId, ...subServiceInputData } = subService;

//       const subServiceMasterData = await SubService.findOne({
//         attributes: ["id", "name", "serviceId"],
//         where: {
//           id: subServiceInputData.subServiceId,
//         },
//         transaction,
//       });
//       if (!subServiceMasterData) {
//         await transaction.rollback();
//         return {
//           success: false,
//           error: `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): sub service not found`,
//         };
//       }

//       if (subServiceInputData.entitlementId) {
//         const entitlement = await Entitlement.findOne({
//           attributes: ["id", "name", "limit", "unitId"],
//           where: {
//             id: subServiceInputData.entitlementId,
//           },
//           transaction,
//         });
//         if (!entitlement) {
//           await transaction.rollback();
//           return {
//             success: false,
//             error: `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): entitlement not found`,
//           };
//         }
//       }

//       if (clientServiceEntitlementId) {
//         const checkSubServiceAlreadyExists =
//           await ClientServiceEntitlement.findOne({
//             attributes: ["id"],
//             where: {
//               clientServiceId: clientServicePrimaryId,
//               subServiceId: subServiceInputData.subServiceId,
//               id: {
//                 [Op.ne]: clientServiceEntitlementId,
//               },
//             },
//             paranoid: false,
//             transaction: transaction,
//           });
//         if (checkSubServiceAlreadyExists) {
//           await transaction.rollback();
//           return {
//             success: false,
//             error: `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): is already taken`,
//           };
//         }
//       } else {
//         const checkSubServiceAlreadyExists =
//           await ClientServiceEntitlement.findOne({
//             attributes: ["id"],
//             where: {
//               clientServiceId: clientServicePrimaryId,
//               subServiceId: subServiceInputData.subServiceId,
//             },
//             paranoid: false,
//             transaction: transaction,
//           });
//         if (checkSubServiceAlreadyExists) {
//           await transaction.rollback();
//           return {
//             success: false,
//             error: `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): is already taken`,
//           };
//         }
//       }

//       const subServiceData: any = {
//         clientServiceId: clientServicePrimaryId,
//         ...subServiceInputData,
//       };
//       if (clientServiceEntitlementId) {
//         await ClientServiceEntitlement.update(subServiceData, {
//           where: {
//             id: clientServiceEntitlementId,
//           },
//           paranoid: false,
//           transaction: transaction,
//         });
//       } else {
//         await ClientServiceEntitlement.create(subServiceData, {
//           transaction: transaction,
//         });
//       }
//     }
//   }

//   return {
//     success: true,
//     message: "Client service and sub service entitlements saved successfully",
//   };
// }

async function saveClientServiceAndSubServices(
  from: string,
  clientId: number,
  clientServices: any,
  transaction: any
) {
  const importErrors = [];
  if (from == "import") {
    transaction = await sequelize.transaction();
  }

  if (from != "import") {
    if (!clientId) {
      return {
        success: false,
        error: "Client not found",
      };
    }
  }

  const existingClientServices = await ClientService.findAll({
    where: { clientId: clientId },
    attributes: ["id"],
    paranoid: false,
    transaction,
  });
  if (existingClientServices.length > 0) {
    for (const existingClientService of existingClientServices) {
      let removeExistingClientService = false;
      if (clientServices.length > 0) {
        const existingClientServiceExists = clientServices.find(
          (givenClientService: any) =>
            givenClientService.clientServiceId ==
            existingClientService.dataValues.id
        );

        //NOT EXIST THEN DELETE THE EXISTING CLIENT SERVICE
        if (!existingClientServiceExists) {
          removeExistingClientService = true;
        }
      } else {
        removeExistingClientService = true;
      }

      if (removeExistingClientService) {
        await ClientService.destroy({
          where: {
            id: existingClientService.dataValues.id,
          },
          force: true,
          transaction: transaction,
        });
      }
    }
  }

  let clientServiceIndex = 0;
  for (const clientService of clientServices) {
    clientServiceIndex++;
    const clientServiceValidator = new Validator(clientService, {
      clientServiceId: "nullable|numeric",
      serviceId: "required|numeric",
      policyTypeId: "required|numeric",
      membershipTypeId: "nullable|numeric",
      membershipTypeName: "nullable|string",
      totalService: "required|numeric",
    });

    const clientServiceMatched = await clientServiceValidator.check();
    if (!clientServiceMatched) {
      const clientServiceErrors: any = [];
      Object.keys(clientService).forEach((clientServiceKey) => {
        if (clientServiceValidator.errors[clientServiceKey]) {
          // clientServiceErrors.push(
          //   `Service (${clientServiceIndex}): ${clientServiceValidator.errors[clientServiceKey].message}`
          // );

          if (from == "import") {
            clientServiceErrors.push(
              clientServiceValidator.errors[clientServiceKey].message
            );
          } else {
            clientServiceErrors.push(
              `Service (${clientServiceIndex}): ${clientServiceValidator.errors[clientServiceKey].message}`
            );
          }
        }
      });

      if (from == "import") {
        importErrors.push({
          indexes: clientService.indexes,
          error: clientServiceErrors,
        });
        continue;
      } else {
        return {
          success: false,
          error: clientServiceErrors,
        };
      }
    }

    //CLIENT VALIDATION FOR IMPORT
    if (from == "import" && !clientService.clientId) {
      importErrors.push({
        indexes: clientService.indexes,
        error: "Client not found",
      });
      continue;
    }

    if (clientService.subServices.length == 0) {
      if (from == "import") {
        importErrors.push({
          indexes: clientService.indexes,
          error: `Sub service entitlement is required`,
        });
        continue;
      } else {
        return {
          success: false,
          error: `Service (${clientServiceIndex}): sub service entitlement is required`,
        };
      }
    }

    const totalLimit = clientService.subServices.reduce(
      (acc: number, subService: any) => {
        if (subService.limit) {
          return acc + parseInt(subService.limit);
        }
        return acc;
      },
      0
    );

    if (totalLimit > clientService.totalService) {
      if (from == "import") {
        importErrors.push({
          indexes: clientService.indexes,
          error: `Sub service total limits should be less than or equal to total service`,
        });
        continue;
      } else {
        return {
          success: false,
          error: `Service (${clientServiceIndex}): sub service total limits should be less than or equal to total service`,
        };
      }
    }

    const subServiceWithoutLimitExists = clientService.subServices.some(
      (subServiceRecord: any) => {
        return !subServiceRecord.limit;
      }
    );

    if (
      subServiceWithoutLimitExists &&
      totalLimit == clientService.totalService
    ) {
      if (from == "import") {
        importErrors.push({
          indexes: clientService.indexes,
          error: `You have allocated all total service limit to specific sub service, Kindly find and split it.`,
        });
        continue;
      } else {
        return {
          success: false,
          error: `Service (${clientServiceIndex}): you have allocated all total service limit to specific sub service, Kindly split it.`,
        };
      }
    }

    const { clientServiceId, ...clientServiceInputData } = clientService;

    const service = await Service.findOne({
      attributes: ["id", "name"],
      where: {
        id: clientServiceInputData.serviceId,
      },
      transaction,
    });
    if (!service) {
      if (from == "import") {
        importErrors.push({
          indexes: clientService.indexes,
          error: `Service not found`,
        });
        continue;
      } else {
        return {
          success: false,
          error: `Service (${clientServiceIndex}): service not found`,
        };
      }
    }

    const policyType = await Config.findOne({
      where: {
        id: clientServiceInputData.policyTypeId,
      },
      transaction,
    });
    if (!policyType) {
      if (from == "import") {
        importErrors.push({
          indexes: clientService.indexes,
          error: `Policy type not found`,
        });
        continue;
      } else {
        return {
          success: false,
          error: `Service (${clientServiceIndex}): policy type not found`,
        };
      }
    }

    //MEMBERSHIP TYPE VALIDATION FOR IMPORT
    if (
      from == "import" &&
      clientServiceInputData.membershipTypeName &&
      !clientServiceInputData.membershipTypeId
    ) {
      importErrors.push({
        indexes: clientService.indexes,
        error: "Membership type name is required",
      });
      continue;
    }

    if (clientServiceId) {
      //UPDATE
      const checkClientServiceAlreadyExists = await ClientService.findOne({
        attributes: ["id"],
        where: {
          clientId: clientId,
          serviceId: clientServiceInputData.serviceId,
          policyTypeId: clientServiceInputData.policyTypeId,
          membershipTypeId: clientServiceInputData.membershipTypeId || null,
          id: {
            [Op.ne]: clientServiceId,
          },
        },
        paranoid: false,
        transaction: transaction,
      });
      if (checkClientServiceAlreadyExists) {
        if (from == "import") {
          importErrors.push({
            indexes: clientService.indexes,
            error: `Service entitlement is already taken.`,
          });
          continue;
        } else {
          return {
            success: false,
            error: `Service (${clientServiceIndex}): is already taken`,
          };
        }
      }
    } else {
      //NEW
      const checkClientServiceAlreadyExists = await ClientService.findOne({
        attributes: ["id"],
        where: {
          clientId: clientId,
          serviceId: clientServiceInputData.serviceId,
          policyTypeId: clientServiceInputData.policyTypeId,
          membershipTypeId: clientServiceInputData.membershipTypeId || null,
        },
        paranoid: false,
        transaction: transaction,
      });

      if (checkClientServiceAlreadyExists) {
        if (from == "import") {
          importErrors.push({
            indexes: clientService.indexes,
            error: `Service entitlement is already taken.`,
          });
          continue;
        } else {
          return {
            success: false,
            error: `Service (${clientServiceIndex}): is already taken`,
          };
        }
      }
    }

    const clientServiceData: any = {
      clientId: clientId,
      serviceId: clientServiceInputData.serviceId,
      policyTypeId: clientServiceInputData.policyTypeId,
      membershipTypeId: clientServiceInputData.membershipTypeId || null,
      membershipTypeName: clientServiceInputData.membershipTypeName || null,
      totalService: clientServiceInputData.totalService,
    };

    let clientServicePrimaryId = null;
    if (clientServiceId) {
      await ClientService.update(clientServiceData, {
        where: {
          id: clientServiceId,
        },
        paranoid: false,
        transaction: transaction,
      });
      clientServicePrimaryId = clientServiceId;
    } else {
      const newClientService = await ClientService.create(clientServiceData, {
        transaction: transaction,
      });
      clientServicePrimaryId = newClientService.dataValues.id;
    }

    //SUB SERVICE ENTITLEMENT
    const existingClientSubServices = await ClientServiceEntitlement.findAll({
      where: { clientServiceId: clientServicePrimaryId },
      attributes: ["id"],
      paranoid: false,
      transaction,
    });
    if (existingClientSubServices.length > 0) {
      for (const existingClientSubService of existingClientSubServices) {
        let removeExistingClientSubService = false;
        if (clientService.subServices && clientService.subServices.length > 0) {
          const existingClientSubServiceExists = clientService.subServices.find(
            (givenClientSubService: any) =>
              givenClientSubService.clientServiceEntitlementId ==
              existingClientSubService.dataValues.id
          );

          //NOT EXIST THEN DELETE THE EXISTING CLIENT SUB SERVICE
          if (!existingClientSubServiceExists) {
            removeExistingClientSubService = true;
          }
        } else {
          removeExistingClientSubService = true;
        }

        if (removeExistingClientSubService) {
          await ClientServiceEntitlement.destroy({
            where: {
              id: existingClientSubService.dataValues.id,
            },
            force: true,
            transaction: transaction,
          });
        }
      }
    }

    let subServiceIndex = 0;
    for (const subService of clientService.subServices) {
      subServiceIndex++;
      const subServiceValidator = new Validator(subService, {
        clientServiceEntitlementId: "nullable|numeric",
        subServiceId: "required|numeric",
        limit: "nullable|numeric",
        entitlementId: "nullable|numeric",
      });
      const subServiceMatched = await subServiceValidator.check();
      if (!subServiceMatched) {
        const subServiceErrors: any = [];
        Object.keys(subService).forEach((subServiceKey) => {
          if (subServiceValidator.errors[subServiceKey]) {
            // subServiceErrors.push(
            //   `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): ${subServiceValidator.errors[subServiceKey].message}`
            // );

            if (from == "import") {
              subServiceErrors.push(
                subServiceValidator.errors[subServiceKey].message
              );
            } else {
              subServiceErrors.push(
                `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): ${subServiceValidator.errors[subServiceKey].message}`
              );
            }
          }
        });

        if (from == "import") {
          importErrors.push({
            index: subService.index,
            indexes: clientService.indexes,
            error: subServiceErrors,
          });
          continue;
        } else {
          return {
            success: false,
            error: subServiceErrors,
          };
        }
      }

      const { clientServiceEntitlementId, ...subServiceInputData } = subService;

      const subServiceMasterData = await SubService.findOne({
        attributes: ["id", "name", "serviceId"],
        where: {
          id: subServiceInputData.subServiceId,
        },
        transaction,
      });
      if (!subServiceMasterData) {
        if (from == "import") {
          importErrors.push({
            index: subService.index,
            indexes: clientService.indexes,
            error: `Sub service not found`,
          });
          continue;
        } else {
          return {
            success: false,
            error: `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): sub service not found`,
          };
        }
      }

      //ENTITLEMENT VALIDATION FOR IMPORT
      if (
        from == "import" &&
        subServiceInputData.sheetEntitlementName &&
        !subServiceInputData.entitlementId
      ) {
        importErrors.push({
          index: subService.index,
          indexes: clientService.indexes,
          error: "Entitlement not found",
        });
        continue;
      }

      if (subServiceInputData.entitlementId) {
        const subServiceEntitlementExists = await SubServiceEntitlement.findOne(
          {
            attributes: ["id"],
            where: {
              subServiceId: subServiceInputData.subServiceId,
              entitlementId: subServiceInputData.entitlementId,
            },
          }
        );
        if (!subServiceEntitlementExists) {
          if (from == "import") {
            importErrors.push({
              index: subService.index,
              indexes: clientService.indexes,
              error: `Entitlement not allowed for this sub service`,
            });
            continue;
          } else {
            return {
              success: false,
              error: `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): Entitlement not allowed for this sub service`,
            };
          }
        }

        const entitlement = await Entitlement.findOne({
          // attributes: ["id", "name", "limit", "unitId"],
          attributes: ["id", "name", "unitId"],
          where: {
            id: subServiceInputData.entitlementId,
          },
          transaction,
        });
        if (!entitlement) {
          if (from == "import") {
            importErrors.push({
              index: subService.index,
              indexes: clientService.indexes,
              error: `Entitlement not found`,
            });
            continue;
          } else {
            return {
              success: false,
              error: `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): entitlement not found`,
            };
          }
        }
      }

      if (clientServiceEntitlementId) {
        const checkSubServiceAlreadyExists =
          await ClientServiceEntitlement.findOne({
            attributes: ["id"],
            where: {
              clientServiceId: clientServicePrimaryId,
              subServiceId: subServiceInputData.subServiceId,
              id: {
                [Op.ne]: clientServiceEntitlementId,
              },
            },
            paranoid: false,
            transaction: transaction,
          });
        if (checkSubServiceAlreadyExists) {
          if (from == "import") {
            importErrors.push({
              index: subService.index,
              indexes: clientService.indexes,
              error: `Service entitlement is already taken`,
            });
            continue;
          } else {
            return {
              success: false,
              error: `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): is already taken`,
            };
          }
        }
      } else {
        const checkSubServiceAlreadyExists =
          await ClientServiceEntitlement.findOne({
            attributes: ["id"],
            where: {
              clientServiceId: clientServicePrimaryId,
              subServiceId: subServiceInputData.subServiceId,
            },
            paranoid: false,
            transaction: transaction,
          });
        if (checkSubServiceAlreadyExists) {
          if (from == "import") {
            importErrors.push({
              index: subService.index,
              indexes: clientService.indexes,
              error: `Service entitlement is already taken`,
            });
            continue;
          } else {
            return {
              success: false,
              error: `Service (${clientServiceIndex}): and the sub service (${subServiceIndex}): is already taken`,
            };
          }
        }
      }

      const subServiceData: any = {
        clientServiceId: clientServicePrimaryId,
        ...subServiceInputData,
      };

      if (clientServiceEntitlementId) {
        await ClientServiceEntitlement.update(subServiceData, {
          where: {
            id: clientServiceEntitlementId,
          },
          paranoid: false,
          transaction: transaction,
        });
      } else {
        await ClientServiceEntitlement.create(subServiceData, {
          transaction: transaction,
        });
      }
    }
  }

  if (from == "import") {
    await transaction.commit();
  }

  return {
    success: true,
    message:
      "Client service and sub service entitlements processed successfully",
    importErrors: importErrors,
  };
}

async function getClientServiceAndSubServiceEntitlements(
  from: string,
  clientId: any
) {
  let clientServiceDetails = await ClientService.findAll({
    where: {
      clientId: clientId,
    },
    attributes: [
      "id",
      "clientId",
      "serviceId",
      [Sequelize.col("service.name"), "serviceName"],
      "policyTypeId",
      [Sequelize.col("policyType.name"), "policyTypeName"],
      "membershipTypeId",
      // "membershipTypeName",
      "totalService",
    ],
    include: [
      {
        model: Service,
        as: "service",
        attributes: [],
        required: false,
        paranoid: false,
      },
      {
        model: Config,
        as: "policyType",
        attributes: [],
        required: false,
        paranoid: false,
      },
    ],
    paranoid: false,
    order: [["id", "asc"]],
  });

  const clientServices: any = [];
  for (const clientServiceDetail of clientServiceDetails) {
    let membershipTypeName = null;
    if (from == "view") {
      const membershipTypeResponse = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/get/membershipType`,
        { id: clientServiceDetail.dataValues.membershipTypeId }
      );
      if (membershipTypeResponse && membershipTypeResponse.data.success) {
        membershipTypeName = membershipTypeResponse.data.membership_type.name;
      }
    }

    let clientServiceEntitlements = await ClientServiceEntitlement.findAll({
      where: {
        clientServiceId: clientServiceDetail.dataValues.id,
      },
      attributes: [
        [
          Sequelize.col("clientServiceEntitlement.id"),
          "clientServiceEntitlementId",
        ],
        "subServiceId",
        [Sequelize.col("subService.name"), "subServiceName"],
        "limit",
        "entitlementId",
        [Sequelize.col("entitlement.name"), "entitlementName"],
      ],
      include: [
        {
          model: SubService,
          as: "subService",
          attributes: [],
          required: false,
          paranoid: false,
        },
        {
          model: Entitlement,
          as: "entitlement",
          attributes: [],
          required: false,
          paranoid: false,
        },
      ],
      paranoid: false,
    });

    clientServices.push({
      clientServiceId: clientServiceDetail.dataValues.id,
      serviceId: clientServiceDetail.dataValues.serviceId,
      serviceName: clientServiceDetail.dataValues.serviceName,
      policyTypeId: clientServiceDetail.dataValues.policyTypeId,
      policyTypeName: clientServiceDetail.dataValues.policyTypeName,
      membershipTypeId: clientServiceDetail.dataValues.membershipTypeId,
      membershipTypeName: membershipTypeName,
      totalService: clientServiceDetail.dataValues.totalService,
      subServices: clientServiceEntitlements,
    });
  }
  return {
    success: true,
    data: clientServices,
  };
}

async function saveEntitlements(
  entitlements: any,
  clientId: any,
  transaction: any,
  from: any
) {
  if (from == "import") {
    transaction = await sequelize.transaction();
  }

  try {
    let newRecordsCreated: any = 0;
    let existingRecordsUpdated: any = 0;

    let existingClientEntitlements: any = await ClientEntitlement.findAll({
      where: { clientId: clientId },
      transaction: transaction,
    });

    // CHECK EXISTING CLIENT ENTITLEMENT EXIST IN THE INPUT ENTITLEMENT
    // IF NOT EXIST THEN REMOVE IT
    if (existingClientEntitlements && existingClientEntitlements.length > 0) {
      for (let existingClientEntitlement of existingClientEntitlements) {
        let entitlementExists: any = entitlements.find(
          (entitlement: any) =>
            entitlement.entitlementId ===
            existingClientEntitlement.entitlementId
        );
        if (!entitlementExists) {
          await ClientEntitlement.destroy({
            where: {
              clientId: clientId,
              entitlementId: existingClientEntitlement.entitlementId,
            },
            force: true,
            transaction: transaction,
          });
        }
      }
    }

    for (let entitlement of entitlements) {
      const clientEntitlementExists: any = await ClientEntitlement.findOne({
        where: {
          clientId: clientId,
          entitlementId: entitlement.entitlementId,
        },
        transaction: transaction,
      });

      if (clientEntitlementExists) {
        await ClientEntitlement.update(
          {
            limit: entitlement.limit,
          },
          {
            where: { id: clientEntitlementExists.id },
            transaction: transaction,
          }
        );

        existingRecordsUpdated += 1;
      } else {
        await ClientEntitlement.create(
          {
            clientId: clientId,
            entitlementId: entitlement.entitlementId,
            limit: entitlement.limit,
          },
          { transaction: transaction }
        );

        newRecordsCreated += 1;
      }
    }
    if (from == "import") {
      await transaction.commit();
    }

    return {
      success: true,
      newRecordsCreated: newRecordsCreated,
      existingRecordsUpdated: existingRecordsUpdated,
    };
  } catch (error: any) {
    if (from == "import") {
      await transaction.rollback();
    }

    return {
      success: false,
      error: error?.message,
    };
  }
}

export default new ClientController();
