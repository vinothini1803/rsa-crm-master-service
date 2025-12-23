import {
  Asp,
  AspMechanic,
  OwnPatrolVehicle,
  OwnPatrolVehicleHelper,
  ServiceOrganisation,
  VehicleMake,
  VehicleModel,
  VehicleType,
} from "../database/models/index";
import serviceOrganisation, {
  getAllServiceOrganisation,
  getServiceOrganisation,
} from "./serviceOrganisation";
import { getAllVehicleType, getVehicleType } from "./vehicleType";
import { getAsp } from "./asp";
import Utils from "../lib/utils";
import config from "../config/config.json";
import sequelize from "../database/connection";
import { Op, Sequelize } from "sequelize";
import axios from "axios";
import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

export const getOwnPatrolVehicleList = async (query: any) => {
  try {
    return await OwnPatrolVehicle.findAll(query);
  } catch (error: any) {
    throw error;
  }
};

export const getOwnPatrolVehicleByVehicleRegistration = async (number: any) => {
  try {
    return await OwnPatrolVehicle.findOne({
      where: { vehicleRegistrationNumber: number },
    });
  } catch (error: any) {
    throw error;
  }
};

export const getOwnPatrolVehicleById = async (id: any) => {
  try {
    let ownPatrolVehicle: any = await OwnPatrolVehicle.findOne({
      where: { id: id },
    });
    return ownPatrolVehicle ? ownPatrolVehicle : false;
  } catch (error: any) {
    throw error;
  }
};

class OwnPatrolVehicleController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;

  constructor() { }

  getList = async (req: any, res: any) => {
    try {
      let {
        limit,
        offset,
        apiType,
        search,
        vehicleTypeId,
        aspId,
        serviceOrganisationId,
        status,
      } = req.query;

      const where: any = {};
      if (vehicleTypeId) {
        where.vehicleTypeId = vehicleTypeId;
      }
      if (aspId) {
        where.aspId = aspId;
      }
      if (serviceOrganisationId) {
        where.serviceOrganisationId = serviceOrganisationId;
      }

      let ownPatrolVehicles: any;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [
            { vehicleRegistrationNumber: { [Op.like]: `%${search}%` } },
          ];
        }

        ownPatrolVehicles = await OwnPatrolVehicle.findAll({
          where,
          attributes: ["id", "vehicleRegistrationNumber"],
          order: [["id", "asc"]],
        });

        if (ownPatrolVehicles.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        // LIST API
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
            { vehicleRegistrationNumber: { [Op.like]: `%${search}%` } },
            { gpsDeviceId: { [Op.like]: `%${search}%` } },
            Sequelize.literal(`vehicleType.name LIKE "%${search}%"`),
            Sequelize.literal(`vehicleMake.name LIKE "%${search}%"`),
            Sequelize.literal(`vehicleModel.name LIKE "%${search}%"`),
            Sequelize.literal(`asp.code LIKE "%${search}%"`),
            Sequelize.literal(`asp.name LIKE "%${search}%"`),
            Sequelize.literal(`serviceOrganisation.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (ownPatrolVehicle.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = OwnPatrolVehicleController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = OwnPatrolVehicleController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        ownPatrolVehicles = await OwnPatrolVehicle.findAndCountAll({
          where,
          attributes: [
            "id",
            "vehicleRegistrationNumber",
            "gpsDeviceId",
            "lastGpsCaptured",
            [
              Sequelize.literal("( SELECT vehicleType.name)"),
              "vehicleTypeName",
            ],
            [
              Sequelize.literal("( SELECT vehicleMake.name)"),
              "vehicleMakeName",
            ],
            [
              Sequelize.literal("( SELECT vehicleModel.name)"),
              "vehicleModelName",
            ],
            [Sequelize.literal("( SELECT asp.code)"), "aspCode"],
            [Sequelize.literal("( SELECT asp.name)"), "aspName"],
            [Sequelize.literal("( SELECT asp.lastLatitude)"), "lastLatitude"],
            [Sequelize.literal("( SELECT asp.lastLongitude)"), "lastLongitude"],
            [
              Sequelize.literal("( SELECT serviceOrganisation.name)"),
              "serviceOrganisationName",
            ],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(ownPatrolVehicle.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (ownPatrolVehicle.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: VehicleType,
              as: "vehicleType",
              required: false,
              attributes: ["id", "name"],
              paranoid: false,
            },
            {
              model: ServiceOrganisation,
              as: "serviceOrganisation",
              required: false,
              attributes: ["id", "name"],
              paranoid: false,
            },
            {
              model: Asp,
              as: "asp",
              required: false,
              attributes: ["id", "code", "name", "lastLatitude", "lastLongitude"],
              paranoid: false,
            },
            {
              model: VehicleMake,
              as: "vehicleMake",
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
            {
              model: VehicleModel,
              as: "vehicleModel",
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });
        if (ownPatrolVehicles.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: ownPatrolVehicles,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  // public async save(req: any, res: any) {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     let payload = req.body;
  //     const v = {
  //       id: "numeric",
  //       vehicleRegistrationNumber: "required|string|maxLength:20",
  //       vehicleTypeId: "required|numeric",
  //       aspId: "required|numeric",
  //       gpsDeviceId: "string|maxLength:191",
  //       serviceOrganisationId: "required|numeric",
  //       status: "required|numeric",
  //     };
  //     const errors = await Utils.validateParams(payload, v);
  //     if (errors) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         errors: errors,
  //       });
  //     }

  //     const { id, ...inputData } = payload;
  //     let promiseArray: any = [];
  //     promiseArray.push(
  //       getServiceOrganisation(inputData.serviceOrganisationId)
  //     );
  //     promiseArray.push(getAsp(inputData.aspId));
  //     promiseArray.push(getVehicleType(inputData.vehicleTypeId));

  //     let [serviceOrganisation, asp, vehicleType] = await Promise.all(
  //       promiseArray
  //     );
  //     if (!serviceOrganisation) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "Service organization not found",
  //       });
  //     }

  //     if (!asp) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "ASP not found",
  //       });
  //     }

  //     if (!vehicleType) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "Vehicle type not found",
  //       });
  //     }

  //     let aspCheckWhere: any = {};
  //     if (id) {
  //       //UPDATE
  //       const ownPatrolVehicle = await OwnPatrolVehicle.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: id,
  //         },
  //         paranoid: false,
  //       });
  //       if (!ownPatrolVehicle) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "COCO vehicle not found",
  //         });
  //       }

  //       const ownPatrolVehicleAlreadyExists = await OwnPatrolVehicle.findOne({
  //         where: {
  //           vehicleRegistrationNumber: inputData.vehicleRegistrationNumber,
  //           id: {
  //             [Op.ne]: id,
  //           },
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (ownPatrolVehicleAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "COCO vehicle is already taken",
  //         });
  //       }

  //       aspCheckWhere = {
  //         aspId: inputData.aspId,
  //         id: {
  //           [Op.ne]: id,
  //         },
  //       };
  //     } else {
  //       //ADD
  //       const ownPatrolVehicleAlreadyExists = await OwnPatrolVehicle.findOne({
  //         where: {
  //           vehicleRegistrationNumber: inputData.vehicleRegistrationNumber,
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (ownPatrolVehicleAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "COCO vehicle is already taken",
  //         });
  //       }

  //       aspCheckWhere = {
  //         aspId: inputData.aspId,
  //       };
  //     }

  //     const ownPatrolVehicleAspExists = await OwnPatrolVehicle.findOne({
  //       where: aspCheckWhere,
  //       attributes: ["id"],
  //       paranoid: false,
  //     });
  //     if (ownPatrolVehicleAspExists) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "ASP is already taken for another COCO vehicle",
  //       });
  //     }

  //     let deletedAt = null;
  //     let deletedById = null;
  //     //INACTIVE
  //     if (inputData.status == 0) {
  //       deletedAt = new Date();
  //       deletedById = inputData.authUserId;
  //     }

  //     const ownPatrolData: any = {
  //       ...inputData,
  //       deletedById: deletedById,
  //       deletedAt: deletedAt,
  //     };

  //     let message = null;
  //     let savedOwnPatrolVehicleId = null;
  //     if (id) {
  //       //UPDATE
  //       if (inputData.status == 1) {
  //         //ACTIVE
  //         ownPatrolData.inActiveReason = null;
  //         ownPatrolData.inActiveFromDate = null;
  //         ownPatrolData.inActiveToDate = null;
  //         ownPatrolData.isActiveReminderSent = 0;
  //       }

  //       await OwnPatrolVehicle.update(ownPatrolData, {
  //         where: {
  //           id: id,
  //         },
  //         paranoid: false,
  //         transaction: transaction,
  //       });
  //       message = "COCO vehicle updated successfully";
  //       savedOwnPatrolVehicleId = id;
  //     } else {
  //       //ADD
  //       const newOwnPatrolVehicle = await OwnPatrolVehicle.create(
  //         ownPatrolData,
  //         {
  //           transaction: transaction,
  //         }
  //       );
  //       message = "COCO vehicle created successfully";
  //       savedOwnPatrolVehicleId = newOwnPatrolVehicle.dataValues.id;
  //     }

  //     const cocoAspHaveMechanic = await cocoAspHaveMechanicFn(
  //       inputData.aspId,
  //       false
  //     );
  //     const cocoVehicleHelperIsInShift = await cocoVehicleHelperIsInShiftFn(
  //       savedOwnPatrolVehicleId
  //     );

  //     //IF COCO ASP HAVE MECHANICS OR VEHICLE HELPER IS IN SHIFT THEN COCO VEHICLE INACTIVE IS NOT POSSIBLE
  //     if (
  //       ((cocoAspHaveMechanic &&
  //         cocoAspHaveMechanic.aspMechanics &&
  //         cocoAspHaveMechanic.aspMechanics.length > 0) ||
  //         cocoVehicleHelperIsInShift) &&
  //       inputData.status == 0
  //     ) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: `It’s not possible to inactive the COCO vehicle at the moment because the technician / helper is on shift`,
  //       });
  //     }

  //     //UPDATE COCO ASP AND ASP USER STATUS
  //     if (cocoAspHaveMechanic) {
  //       await Asp.update(
  //         {
  //           updatedById: inputData.updatedById,
  //           deletedById,
  //           deletedAt,
  //         },
  //         {
  //           where: {
  //             id: inputData.aspId,
  //           },
  //           paranoid: false,
  //           transaction: transaction,
  //         }
  //       );

  //DISABLE ASP ENTITY STATUS SINCE COCO ASP HAS NO LOGIN
  //       const aspEntityUpdateStatusResponse: any =
  //         await aspEntityUpdateStatusFn(
  //           [inputData.aspId],
  //           inputData.status,
  //           inputData.updatedById,
  //           deletedById
  //         );
  //       if (!aspEntityUpdateStatusResponse.success) {
  //         await transaction.rollback();
  //         return res.status(200).json(aspEntityUpdateStatusResponse);
  //       }
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
  //       error: error?.message,
  //     });
  //   }
  // }

  public async getFormData(req: any, res: any) {
    try {
      const { ownPatrolVehicleId } = req.query;
      let ownPatrolVehicleData = null;
      if (ownPatrolVehicleId) {
        const ownPatrolVehicleExists: any = await OwnPatrolVehicle.findOne({
          attributes: [
            "id",
            "vehicleRegistrationNumber",
            "vehicleTypeId",
            "vehicleMakeId",
            "vehicleModelId",
            "aspId",
            "gpsDeviceId",
            "serviceOrganisationId",
            "deletedAt",
          ],
          include: [
            {
              model: VehicleType,
              as: "vehicleType",
              attributes: ["id", "name"],
              paranoid: false,
            },
            {
              model: ServiceOrganisation,
              as: "serviceOrganisation",
              attributes: ["id", "name"],
              paranoid: false,
            },
            {
              model: Asp,
              as: "asp",
              attributes: ["id", "code", "name"],
              paranoid: false,
            },
            {
              model: VehicleMake,
              as: "vehicleMake",
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
            {
              model: VehicleModel,
              as: "vehicleModel",
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
          ],
          where: {
            id: ownPatrolVehicleId,
          },
          paranoid: false,
        });
        if (!ownPatrolVehicleExists) {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle not found",
          });
        }

        ownPatrolVehicleData = {
          id: ownPatrolVehicleId,
          vehicleRegistrationNumber:
            ownPatrolVehicleExists.dataValues.vehicleRegistrationNumber,
          vehicleTypeId: ownPatrolVehicleExists.dataValues.vehicleTypeId,
          aspId: ownPatrolVehicleExists.dataValues.aspId,
          gpsDeviceId: ownPatrolVehicleExists.dataValues.gpsDeviceId,
          serviceOrganisationId:
            ownPatrolVehicleExists.dataValues.serviceOrganisationId,
          status: ownPatrolVehicleExists.dataValues.deletedAt ? 0 : 1,
          vehicleType: ownPatrolVehicleExists.vehicleType
            ? ownPatrolVehicleExists.vehicleType
            : null,
          serviceOrganisation: ownPatrolVehicleExists.serviceOrganisation
            ? ownPatrolVehicleExists.serviceOrganisation
            : null,
          asp: ownPatrolVehicleExists.asp ? ownPatrolVehicleExists.asp : null,
          vehicleMakeId: ownPatrolVehicleExists.dataValues.vehicleMakeId,
          vehicleMake: ownPatrolVehicleExists.vehicleMake
            ? ownPatrolVehicleExists.vehicleMake
            : null,
          vehicleModelId: ownPatrolVehicleExists.dataValues.vehicleModelId,
          vehicleModel: ownPatrolVehicleExists.vehicleModel
            ? ownPatrolVehicleExists.vehicleModel
            : null,
        };
      }

      let [vehicleTypes, serviceOrganisations, vehicleMakes] =
        await Promise.all([
          getAllVehicleType(),
          getAllServiceOrganisation(),
          VehicleMake.findAll({
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          }),
        ]);

      const data = {
        extras: {
          vehicleTypes,
          serviceOrganisations,
          vehicleMakes,
        },
        ownPatrolVehicle: ownPatrolVehicleData,
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
  }

  public updateStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = {
        ownPatrolVehicleIds: "required|array",
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
      const { ownPatrolVehicleIds, status, updatedById, deletedById } = payload;
      if (ownPatrolVehicleIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least COCO vehicle",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      let cocoAspIds = [];
      for (const ownPatrolVehicleId of ownPatrolVehicleIds) {
        const ownPatrolVehicleExists = await OwnPatrolVehicle.findOne({
          attributes: ["id", "aspId"],
          where: {
            id: ownPatrolVehicleId,
          },
          paranoid: false,
        });
        if (!ownPatrolVehicleExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `COCO vehicle ID - (${ownPatrolVehicleId}) not found`,
          });
        }

        const cocoAspHaveMechanic = await cocoAspHaveMechanicFn(
          ownPatrolVehicleExists.dataValues.aspId,
          false
        );
        const cocoVehicleHelperIsInShift = await cocoVehicleHelperIsInShiftFn(
          ownPatrolVehicleId
        );

        //IF COCO ASP HAVE MECHANICS OR COCO VEHICLE HELPER IS IN SHIFT THEN COCO VEHICLE INACTIVE IS NOT POSSIBLE
        if (
          ((cocoAspHaveMechanic &&
            cocoAspHaveMechanic.aspMechanics &&
            cocoAspHaveMechanic.aspMechanics.length > 0) ||
            cocoVehicleHelperIsInShift) &&
          status == 0
        ) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `COCO vehicle ID - (${ownPatrolVehicleId}), It’s not possible to inactive the COCO vehicle at the moment because the technician / helper is on shift`,
          });
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

        await OwnPatrolVehicle.update(ownPatrolVehicleUpdate, {
          where: { id: ownPatrolVehicleId },
          paranoid: false,
          transaction: transaction,
        });

        if (cocoAspHaveMechanic) {
          await Asp.update(
            {
              updatedById,
              deletedById,
              deletedAt,
            },
            {
              where: {
                id: ownPatrolVehicleExists.dataValues.aspId,
              },
              paranoid: false,
              transaction: transaction,
            }
          );
          cocoAspIds.push(ownPatrolVehicleExists.dataValues.aspId);
        }
      }

      //DISABLE ASP ENTITY STATUS SINCE COCO ASP HAS NO LOGIN
      //UPDATE COCO ASP USER STATUS
      // if (cocoAspIds && cocoAspIds.length > 0) {
      //   const aspEntityUpdateStatusResponse: any =
      //     await aspEntityUpdateStatusFn(
      //       cocoAspIds,
      //       status,
      //       updatedById,
      //       deletedById
      //     );
      //   if (!aspEntityUpdateStatusResponse.success) {
      //     await transaction.rollback();
      //     return res.status(200).json(aspEntityUpdateStatusResponse);
      //   }
      // }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "COCO vehicle status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  public delete = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = {
        ownPatrolVehicleIds: "required|array",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { ownPatrolVehicleIds } = payload;
      if (ownPatrolVehicleIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one COCO vehicle",
        });
      }

      for (const ownPatrolVehicleId of ownPatrolVehicleIds) {
        const ownPatrolVehicleExists = await OwnPatrolVehicle.findOne({
          attributes: ["id", "aspId"],
          where: {
            id: ownPatrolVehicleId,
          },
          paranoid: false,
        });
        if (!ownPatrolVehicleExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `COCO vehicle ID - (${ownPatrolVehicleId}) not found`,
          });
        }

        const cocoAspHaveMechanic = await cocoAspHaveMechanicFn(
          ownPatrolVehicleExists.dataValues.aspId,
          true
        );
        const cocoVehicleHelperIsInShift = await cocoVehicleHelperIsInShiftFn(
          ownPatrolVehicleId
        );

        //IF COCO ASP HAVE MECHANICS OR VEHICLE HELPER IS IN SHIFT THEN COCO VEHICLE DELETE IS NOT POSSIBLE
        if (cocoAspHaveMechanic || cocoVehicleHelperIsInShift) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `COCO vehicle ID - (${ownPatrolVehicleId}), It’s not possible to delete the COCO vehicle at the moment because the technician / helper is on shift`,
          });
        }

        await OwnPatrolVehicle.destroy({
          where: {
            id: ownPatrolVehicleId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "COCO vehicle deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  public getByIds = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const validateData = {
        ids: "required|array",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const ownPatrolVehicleDetails = await OwnPatrolVehicle.findAll({
        attributes: ["id", "vehicleRegistrationNumber"],
        where: {
          id: {
            [Op.in]: payload.ids,
          },
        },
        paranoid: false,
      });
      if (ownPatrolVehicleDetails.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Own patrol vehicle not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: ownPatrolVehicleDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  // USED FOR MAP VIEW FILTERS
  public getAspIdsByServiceOrganisationIds = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const validateData = {
        serviceOrganisationIds: "required|array",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const ownPatrolVehicles = await OwnPatrolVehicle.findAll({
        attributes: ["aspId"],
        where: {
          serviceOrganisationId: {
            [Op.in]: payload.serviceOrganisationIds,
          },
        },
        paranoid: false,
      });

      if (ownPatrolVehicles.length == 0) {
        return res.status(200).json({
          success: false,
          error: "No COCO vehicles found for the given service organisations",
        });
      }

      // Extract unique ASP IDs
      const aspIdSet = new Set<number>();
      ownPatrolVehicles.forEach((vehicle: any) => {
        if (vehicle.aspId) {
          aspIdSet.add(vehicle.aspId);
        }
      });

      const aspIds = Array.from(aspIdSet);

      if (aspIds.length == 0) {
        return res.status(200).json({
          success: false,
          error: "No ASP IDs found for the given service organisations",
        });
      }

      return res.status(200).json({
        success: true,
        data: aspIds,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getViewData = async (req: any, res: any) => {
    try {
      const { ownPatrolVehicleId } = req.query;
      if (!ownPatrolVehicleId) {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle ID is required",
        });
      }
      const ownPatrolVehicle: any = await OwnPatrolVehicle.findOne({
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById"],
        },
        where: {
          id: ownPatrolVehicleId,
        },
        include: [
          {
            model: VehicleType,
            as: "vehicleType",
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
          {
            model: Asp,
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
          {
            model: ServiceOrganisation,
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
          {
            model: VehicleMake,
            as: "vehicleMake",
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
          {
            model: VehicleModel,
            as: "vehicleModel",
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
        ],
        paranoid: false,
      });

      if (!ownPatrolVehicle) {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle not found",
        });
      }

      const data = {
        ...ownPatrolVehicle.dataValues,

        status: ownPatrolVehicle.dataValues.deletedAt ? "Inactive" : "Active",
      };

      return res.status(200).json({
        success: true,
        message: "COCO vehicle data fetch successfully",
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  saveAndUpdate = async (req: any, res: any) => {
    return save(req, res);
  };

  public async import(req: any, res: any) {
    try {
      const inData: any[] = req.body.jsonDataArray;
      const ownPatrolVehicleErrorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      // let importColumns = [
      //   "Vehicle Registration Number",
      //   "Vehicle Type Name",
      //   "ASP Code",
      //   "GPS Device Id",
      //   "Service Organisation Name",
      //   "Status",
      // ];
      const importColumnsResponse = await Utils.getExcelImportColumns(1096);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1096,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const ownPatrolVehicleSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const ownPatrolVehicleSheet of ownPatrolVehicleSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!ownPatrolVehicleSheet.hasOwnProperty(importColumn)) {
            ownPatrolVehicleSheet[importColumn] = "";
          }
        });

        let reArrangedOwnPatrolVehicles: any = {
          "Vehicle Registration Number": ownPatrolVehicleSheet[
            "Vehicle Registration Number"
          ]
            ? String(ownPatrolVehicleSheet["Vehicle Registration Number"])
            : null,
          "Vehicle Type Name": ownPatrolVehicleSheet["Vehicle Type Name"]
            ? String(ownPatrolVehicleSheet["Vehicle Type Name"])
            : null,
          "Vehicle Make Name": ownPatrolVehicleSheet["Vehicle Make Name"]
            ? String(ownPatrolVehicleSheet["Vehicle Make Name"])
            : null,
          "Vehicle Model Name": ownPatrolVehicleSheet["Vehicle Model Name"]
            ? String(ownPatrolVehicleSheet["Vehicle Model Name"])
            : null,
          "ASP Code": ownPatrolVehicleSheet["ASP Code"]
            ? String(ownPatrolVehicleSheet["ASP Code"])
            : null,
          "GPS Device Id": ownPatrolVehicleSheet["GPS Device Id"]
            ? String(ownPatrolVehicleSheet["GPS Device Id"])
            : null,
          "Service Organisation Name": ownPatrolVehicleSheet[
            "Service Organisation Name"
          ]
            ? String(ownPatrolVehicleSheet["Service Organisation Name"])
            : null,
          Status: ownPatrolVehicleSheet["Status"]
            ? String(ownPatrolVehicleSheet["Status"])
            : null,
        };

        if (ownPatrolVehicleSheet["Vehicle Registration Number"]) {
          const record: any = {};
          const keyMapping: any = {
            vehicleTypeName: "vehicleTypeId",
            aSPCode: "aspId",
            gPSDeviceId: "gpsDeviceId",
            serviceOrganisationName: "serviceOrganisationId",
          };

          for (const key in reArrangedOwnPatrolVehicles) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedOwnPatrolVehicles[key];
          }

          const validationErrors = [];
          if (
            record.vehicleRegistrationNumber &&
            !/^(?:[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}|[0-9]{2}BH[0-9]{4}[A-Z]{2})$/i.test(record.vehicleRegistrationNumber.trim())
          ) {
            validationErrors.push("Invalid Vehicle Registration Number");
          }

          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          if (validationErrors.length > 0) {
            ownPatrolVehicleErrorData.push({
              ...reArrangedOwnPatrolVehicles,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //OWN PATROL VEHICLE
          let ownPatrolVehicleId = null;
          if (record.vehicleRegistrationNumber) {
            const trimmedVehicleRegistrationNumber =
              record.vehicleRegistrationNumber.trim();
            const ownPatrolVehicleExists = await OwnPatrolVehicle.findOne({
              where: {
                vehicleRegistrationNumber: trimmedVehicleRegistrationNumber,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (ownPatrolVehicleExists) {
              ownPatrolVehicleId = ownPatrolVehicleExists.dataValues.id;
            }
          }

          //VEHICLE TYPE
          let vehicleTypeId = 0;
          if (record.vehicleTypeId) {
            const trimmedVehicleTypeName = record.vehicleTypeId.trim();
            const vehicleType = await VehicleType.findOne({
              attributes: ["id"],
              where: {
                name: trimmedVehicleTypeName,
              },
              paranoid: false,
            });
            if (vehicleType) {
              vehicleTypeId = vehicleType.dataValues.id;
            }
          }

          //ASP
          let aspId = 0;
          if (record.aspId) {
            const trimmedAspCode = record.aspId.trim();
            const asp = await Asp.findOne({
              attributes: ["id"],
              where: {
                code: trimmedAspCode,
              },
              paranoid: false,
            });
            if (asp) {
              aspId = asp.dataValues.id;
            }
          }

          //SERVICE ORGANISATION
          let serviceOrganisationId = 0;
          if (record.serviceOrganisationId) {
            const trimmedServiceOrganisationName =
              record.serviceOrganisationId.trim();
            const serviceOrganisation = await ServiceOrganisation.findOne({
              attributes: ["id"],
              where: {
                name: trimmedServiceOrganisationName,
              },
              paranoid: false,
            });
            if (serviceOrganisation) {
              serviceOrganisationId = serviceOrganisation.dataValues.id;
            }
          }

          //VEHICLE MAKE
          let vehicleMakeId = null;
          if (record.vehicleMakeName) {
            const trimmedVehicleMakeName = record.vehicleMakeName.trim();
            const vehicleMake = await VehicleMake.findOne({
              attributes: ["id"],
              where: {
                name: trimmedVehicleMakeName,
              },
              paranoid: false,
            });
            if (vehicleMake) {
              vehicleMakeId = vehicleMake.dataValues.id;
            }
          }

          //VEHICLE MODEL
          let vehicleModelId = null;
          if (vehicleMakeId && record.vehicleModelName) {
            const trimmedVehicleModelName = record.vehicleModelName.trim();
            const vehicleModel = await VehicleModel.findOne({
              attributes: ["id"],
              where: {
                vehicleMakeId: vehicleMakeId,
                name: trimmedVehicleModelName,
              },
              paranoid: false,
            });
            if (vehicleModel) {
              vehicleModelId = vehicleModel.dataValues.id;
            }
          }

          record.id = ownPatrolVehicleId;
          record.vehicleTypeId = vehicleTypeId;
          record.vehicleMakeId = vehicleMakeId;
          record.vehicleModelId = vehicleModelId;
          record.aspId = aspId;
          record.serviceOrganisationId = serviceOrganisationId;
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
            ownPatrolVehicleErrorData.push({
              ...reArrangedOwnPatrolVehicles,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "COCO vehicle created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          ownPatrolVehicleErrorData.push({
            ...reArrangedOwnPatrolVehicles,
            Error: "Vehicle registration number is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New coco vehicle created successfully (${newRecordsCreated} records) and existing coco vehicle updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New coco vehicle created successfully (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing coco vehicle updated (${existingRecordsUpdated} records)`
              : "No coco vehicle created or updated";

      if (ownPatrolVehicleErrorData.length === 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Error Buffer Generation;
      importColumns.push("Error");

      const buffer = generateXLSXAndXLSExport(
        ownPatrolVehicleErrorData,
        importColumns,
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

      const ownPatrolVehicles: any = await OwnPatrolVehicle.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        include: [
          {
            model: VehicleType,
            as: "vehicleType",
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
          {
            model: Asp,
            attributes: ["id", "code", "name"],
            required: false,
            paranoid: false,
          },
          {
            model: ServiceOrganisation,
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
          {
            model: VehicleMake,
            as: "vehicleMake",
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
          {
            model: VehicleModel,
            as: "vehicleModel",
            attributes: ["id", "name"],
            required: false,
            paranoid: false,
          },
        ],
        paranoid: false,
      });
      if (!ownPatrolVehicles || ownPatrolVehicles.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let ownPatrolVehicleDetailsArray: any[] = [];
      for (const ownPatrolVehicle of ownPatrolVehicles) {
        // const [vehicleType, asp, serviceOrganisation] = await Promise.all([
        //   VehicleType.findOne({
        //     attributes: ["id", "name"],
        //     where: { id: ownPatrolVehicle.dataValues.vehicleTypeId },
        //     paranoid: false,
        //   }),
        //   Asp.findOne({
        //     attributes: ["id", "code", "name"],
        //     where: { id: ownPatrolVehicle.dataValues.aspId },
        //     paranoid: false,
        //   }),
        //   ServiceOrganisation.findOne({
        //     attributes: ["id", "name"],
        //     where: { id: ownPatrolVehicle.dataValues.serviceOrganisationId },
        //     paranoid: false,
        //   }),
        // ]);

        const ownPatrolVehicleDetails = {
          "Vehicle Registration Number":
            ownPatrolVehicle.dataValues.vehicleRegistrationNumber,
          "Vehicle Type Name": ownPatrolVehicle?.vehicleType?.name || null,
          "Vehicle Make Name": ownPatrolVehicle?.vehicleMake?.name || null,
          "Vehicle Model Name": ownPatrolVehicle?.vehicleModel?.name || null,
          "ASP Code": ownPatrolVehicle?.asp?.code || null,
          "GPS Device Id": ownPatrolVehicle.dataValues.gpsDeviceId,
          "Service Organisation Name":
            ownPatrolVehicle?.serviceOrganisation?.name || null,
          "Created At": moment
            .tz(ownPatrolVehicle.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: ownPatrolVehicle.dataValues.deletedAt ? "Inactive" : "Active",
        };
        ownPatrolVehicleDetailsArray.push(ownPatrolVehicleDetails);
      }

      // Column Filter;
      const ownPatrolVehicleColumnNames = ownPatrolVehicleDetailsArray
        ? Object.keys(ownPatrolVehicleDetailsArray[0])
        : [];

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          ownPatrolVehicleDetailsArray,
          ownPatrolVehicleColumnNames,
          format,
          "Own Patrol Vehicle Details"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          ownPatrolVehicleDetailsArray,
          ownPatrolVehicleColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `COCO vehicle data export successfully`,
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

const cocoAspHaveMechanicFn: any = async (
  aspId: any,
  aspMechanicRequired: any
) => {
  try {
    return await Asp.findOne({
      where: {
        id: aspId,
        isOwnPatrol: 1,
      },
      attributes: ["id"],
      paranoid: false,
      include: {
        model: AspMechanic,
        attributes: ["id"],
        required: aspMechanicRequired,
        paranoid: false,
      },
    });
  } catch (error: any) {
    throw error;
  }
};

const cocoVehicleHelperIsInShiftFn: any = async (ownPatrolVehicleId: any) => {
  try {
    return await OwnPatrolVehicleHelper.findOne({
      attributes: ["id"],
      where: {
        ownPatrolVehicleId: ownPatrolVehicleId,
      },
      paranoid: false,
    });
  } catch (error: any) {
    throw error;
  }
};

const aspEntityUpdateStatusFn: any = async (
  aspEntityIds: any,
  aspEntityStatus: any,
  updatedById: any,
  deletedById: any
) => {
  try {
    const getAllAspEntityUsers: any = await axios.post(
      `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
      {
        userTypeId: 142, //ASP
        entityIds: aspEntityIds,
      }
    );
    if (!getAllAspEntityUsers.data.success) {
      return getAllAspEntityUsers.data;
    }
    const entityAspUserIds = getAllAspEntityUsers.data.data.map(
      (entityUser: any) => entityUser.id
    );

    //UPDATE ASP STATUS IN USER
    const entityAspUserUpdateStatus: any = await axios.put(
      `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.updateStatus}`,
      {
        userIds: entityAspUserIds,
        status: aspEntityStatus,
        updatedById,
        deletedById,
      }
    );
    if (!entityAspUserUpdateStatus.data.success) {
      return entityAspUserUpdateStatus.data;
    }

    return {
      success: true,
    };
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

    //VALIDATIONS
    const v = {
      id: "numeric",
      vehicleRegistrationNumber: "required|string|maxLength:20",
      vehicleTypeId: "required|numeric",
      vehicleMakeId: "nullable",
      vehicleModelId: "nullable",
      aspId: "required|numeric",
      gpsDeviceId: "string|maxLength:191",
      serviceOrganisationId: "required|numeric",
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

    // Custom validation for vehicle registration number pattern
    const vehicleNumberRegex = /^(?:[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}|[0-9]{2}BH[0-9]{4}[A-Z]{2})$/i;
    if (payload.vehicleRegistrationNumber && !vehicleNumberRegex.test(payload.vehicleRegistrationNumber.trim())) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          errors: ["Please enter a valid Vehicle Registration Number"],
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          errors: ["Please enter a valid Vehicle Registration Number"],
        });
      }
    }

    const { id, ...inputData } = payload;
    let promiseArray: any = [];
    promiseArray.push(getServiceOrganisation(inputData.serviceOrganisationId));
    promiseArray.push(getAsp(inputData.aspId));
    promiseArray.push(getVehicleType(inputData.vehicleTypeId));

    let [serviceOrganisation, asp, vehicleType] = await Promise.all(
      promiseArray
    );
    if (!serviceOrganisation) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          error: "Service organization not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Service organization not found",
        });
      }
    }

    if (!asp) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          error: "ASP not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }
    }

    if (!vehicleType) {
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

    //MANAGER DETAIL VALIDATION
    if (importData) {
      if (inputData.vehicleMakeName && !inputData.vehicleMakeId) {
        await transaction.rollback();
        return {
          success: false,
          error: "Vehicle make not found",
          data: payload,
        };
      }

      if (inputData.vehicleModelName && !inputData.vehicleModelId) {
        await transaction.rollback();
        return {
          success: false,
          error: "Vehicle model not found",
          data: payload,
        };
      }
    }

    let aspCheckWhere: any = {};
    if (id) {
      //UPDATE
      const ownPatrolVehicle = await OwnPatrolVehicle.findOne({
        attributes: ["id"],
        where: {
          id: id,
        },
        paranoid: false,
      });
      if (!ownPatrolVehicle) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "COCO vehicle not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle not found",
          });
        }
      }

      const ownPatrolVehicleAlreadyExists = await OwnPatrolVehicle.findOne({
        where: {
          vehicleRegistrationNumber: inputData.vehicleRegistrationNumber,
          id: {
            [Op.ne]: id,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (ownPatrolVehicleAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "COCO vehicle is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle is already taken",
          });
        }
      }

      aspCheckWhere = {
        aspId: inputData.aspId,
        id: {
          [Op.ne]: id,
        },
      };
    } else {
      //ADD
      const ownPatrolVehicleAlreadyExists = await OwnPatrolVehicle.findOne({
        where: {
          vehicleRegistrationNumber: inputData.vehicleRegistrationNumber,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (ownPatrolVehicleAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "COCO vehicle is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle is already taken",
          });
        }
      }

      aspCheckWhere = {
        aspId: inputData.aspId,
      };
    }

    const ownPatrolVehicleAspExists = await OwnPatrolVehicle.findOne({
      where: aspCheckWhere,
      attributes: ["id"],
      paranoid: false,
    });
    if (ownPatrolVehicleAspExists) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          error: "ASP is already taken for another COCO vehicle",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "ASP is already taken for another COCO vehicle",
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

    const ownPatrolData: any = {
      ...inputData,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    let savedOwnPatrolVehicleId = null;
    if (id) {
      //UPDATE
      if (inputData.status == 1) {
        //ACTIVE
        ownPatrolData.inActiveReason = null;
        ownPatrolData.inActiveFromDate = null;
        ownPatrolData.inActiveToDate = null;
        ownPatrolData.isActiveReminderSent = 0;
      }

      await OwnPatrolVehicle.update(ownPatrolData, {
        where: {
          id: id,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "COCO vehicle updated successfully";
      savedOwnPatrolVehicleId = id;
    } else {
      //ADD
      const newOwnPatrolVehicle = await OwnPatrolVehicle.create(ownPatrolData, {
        transaction: transaction,
      });
      message = "COCO vehicle created successfully";
      savedOwnPatrolVehicleId = newOwnPatrolVehicle.dataValues.id;
    }

    const cocoAspHaveMechanic = await cocoAspHaveMechanicFn(
      inputData.aspId,
      false
    );
    const cocoVehicleHelperIsInShift = await cocoVehicleHelperIsInShiftFn(
      savedOwnPatrolVehicleId
    );

    //IF COCO ASP HAVE MECHANICS OR VEHICLE HELPER IS IN SHIFT THEN COCO VEHICLE INACTIVE IS NOT POSSIBLE
    if (
      ((cocoAspHaveMechanic &&
        cocoAspHaveMechanic.aspMechanics &&
        cocoAspHaveMechanic.aspMechanics.length > 0) ||
        cocoVehicleHelperIsInShift) &&
      inputData.status == 0
    ) {
      await transaction.rollback();

      if (importData) {
        return {
          success: false,
          error:
            "It’s not possible to inactive the COCO vehicle at the moment because the technician / helper is on shift",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error:
            "It’s not possible to inactive the COCO vehicle at the moment because the technician / helper is on shift",
        });
      }
    }

    //UPDATE COCO ASP AND ASP USER STATUS
    if (cocoAspHaveMechanic) {
      await Asp.update(
        {
          updatedById: inputData.updatedById,
          deletedById,
          deletedAt,
        },
        {
          where: {
            id: inputData.aspId,
          },
          paranoid: false,
          transaction: transaction,
        }
      );

      //DISABLE ASP ENTITY STATUS SINCE COCO ASP HAS NO LOGIN
      // const aspEntityUpdateStatusResponse: any = await aspEntityUpdateStatusFn(
      //   [inputData.aspId],
      //   inputData.status,
      //   inputData.updatedById,
      //   deletedById
      // );
      // if (!aspEntityUpdateStatusResponse.success) {
      //   await transaction.rollback();

      //   if (importData) {
      //     return {
      //       ...aspEntityUpdateStatusResponse,
      //       data: payload,
      //     };
      //   } else {
      //     return res.status(200).json(aspEntityUpdateStatusResponse);
      //   }
      // }
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

export default new OwnPatrolVehicleController();
