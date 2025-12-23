import { Op, Sequelize } from "sequelize";
import axios from "axios";
import moment, { MomentInput } from "moment-timezone";
import {
  Asp,
  AspMechanic,
  AspMechanicSubService,
  City,
  Config,
  OwnPatrolVehicle,
  OwnPatrolVehicleTechnicianLogs,
  Service,
  State,
  SubService,
  OwnPatrolVehicleNewTechnicians,
  AspSubService,
} from "../database/models/index";
import config from "../config/config.json";
import sequelize from "../database/connection";
import { getValidBody } from "../middleware/validation.middleware";
import Utils from "../lib/utils";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (Case Service);
const caseServiceUrl = `${config.caseService.host}:${config.caseService.port}/${config.caseService.version}/${config.caseService.serviceAccess.case}`;
const endpoint = config.caseService.endpoint;

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

export const checkAspMechanicExists = async (code: any) => {
  try {
    let aspMechanic = await AspMechanic.findOne({ where: { code: code } });
    return aspMechanic ? aspMechanic : false;
  } catch (error: any) {
    throw error;
  }
};

export const getAspMechanic = async (id: any) => {
  try {
    return await AspMechanic.findOne({
      attributes: [
        "id",
        "aspTypeId",
        "aspId",
        "name",
        "code",
        "email",
        "contactNumber",
        "alternateContactNumber",
        "latitude",
        "longitude",
        "performanceId",
        "priorityId",
        "address",
        "cityId",
        "locationCapturedViaId",
        "dynamicTypeId",
        "cocoVehicleId",
        "deletedAt",
      ],
      where: { id: id },
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
        {
          model: Config,
          as: "aspType",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: AspMechanicSubService,
          as: "aspMechanicSubServices",
          attributes: ["id", "subServiceId"],
          required: false,
        },
        {
          model: City,
          as: "city",
          attributes: ["id", "name", "stateId"],
          required: false,
          paranoid: false,
        },
        {
          model: Asp,
          attributes: ["id", "code", "name"],
          required: false,
          paranoid: false,
        },
      ],
      paranoid: false,
    });
  } catch (error: any) {
    throw error;
  }
};

class AspMechanicController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;

  constructor() { }

  public async getList(req: any, res: any) {
    try {
      const { aspId, serviceScheduledDate } = req.query;
      let ownPatrolAsp: any = null;
      const where: any = {};
      if (aspId !== undefined) {
        where.aspId = aspId;

        ownPatrolAsp = await Asp.findOne({
          attributes: ["id"],
          where: {
            id: aspId,
            isOwnPatrol: 1,
          },
          include: [
            {
              model: OwnPatrolVehicle,
              attributes: ["id"],
              required: false,
              include: [
                {
                  model: OwnPatrolVehicleTechnicianLogs,
                  attributes: ["id", "aspMechanicId"],
                  required: false,
                },
              ],
            },
            {
              model: OwnPatrolVehicleNewTechnicians,
              as: "newTechnicians",
              attributes: ["id", "aspMechanicId"],
              required: false,
            },
          ],
        });
      }

      let aspMechanics: any;
      aspMechanics = await AspMechanic.findAll({
        where,
        attributes: [
          "id",
          "aspTypeId",
          "name",
          "code",
          "contactNumber",
          "workStatusId",
        ],
      });

      // IF THERE IS NO COCO MECHANIC CURRENTLY AVAILABLE FOR THE COCO ASP, THEN GET THE LAST ATTENDED (5) COCO MECHANICS IF EXISTS.
      // if (
      //   ownPatrolAsp &&
      //   aspMechanics.length === 0 &&
      //   ownPatrolAsp.ownPatrolVehicle &&
      //   ownPatrolAsp.ownPatrolVehicle.ownPatrolVehicleTechnicianLogs &&
      //   ownPatrolAsp.ownPatrolVehicle.ownPatrolVehicleTechnicianLogs.length > 0
      // ) {
      //   aspMechanics = await getLastAttendedCocoTechnicians(
      //     ownPatrolAsp.ownPatrolVehicle.ownPatrolVehicleTechnicianLogs
      //   );
      // }

      //IF ASP IS OWN PATROL THEN GET NEW COCO TECHNICIANS IF EXISTS
      // if (
      //   ownPatrolAsp &&
      //   ownPatrolAsp.newTechnicians &&
      //   ownPatrolAsp.newTechnicians.length > 0
      // ) {
      //   const newCocoTechnicians = await getNewCocoTechnicians(
      //     aspMechanics,
      //     ownPatrolAsp.newTechnicians
      //   );

      //   if (newCocoTechnicians.length > 0) {
      //     //IF IN SHIFT OR LAST ATTENDED TECHNICIANS ARE NOT EMPTY THEN INCLUDE EXISTING ASP MECHANICS AND ADD NEW COCO TECHNICIANS
      //     if (aspMechanics.length > 0) {
      //       aspMechanics = [...aspMechanics, ...newCocoTechnicians];
      //     } else {
      //       //IF IN SHIFT OR LAST ATTENDED TECHNICIANS ARE EMPTY THEN ADD NEW COCO TECHNICIANS
      //       aspMechanics = newCocoTechnicians;
      //     }
      //   }
      // }

      //IF OWN PATROL ASP THEN GET COCO VEHICLE MATCHED MECHANICS
      if (ownPatrolAsp && ownPatrolAsp.ownPatrolVehicle) {
        const vehicleMatchedMechanics = await AspMechanic.findAll({
          where: {
            cocoVehicleId: ownPatrolAsp.ownPatrolVehicle.id,
            aspTypeId: 771, // COCO
          },
          attributes: [
            "id",
            "aspTypeId",
            "name",
            "code",
            "contactNumber",
            "alternateContactNumber",
            "workStatusId",
          ],
        });

        aspMechanics = [
          ...aspMechanics,
          ...vehicleMatchedMechanics,
        ];
      }

      //GET ASP MECHANIC IN PROGRESS ACTIVITIES
      if (aspMechanics && aspMechanics.length > 0) {
        const aspMechanicIds = aspMechanics
          .map((aspMechanic: any) => aspMechanic?.dataValues?.id || aspMechanic?.id)
          .filter((id: any) => id != null); // Filter out any null/undefined IDs

        if (aspMechanicIds.length > 0) {
          const aspMechanicInProgressResponse = await Utils.aspMechanicInProgressActivities(aspMechanicIds);
          if (aspMechanicInProgressResponse.success && Array.isArray(aspMechanicInProgressResponse.data)) {
            for (const aspMechanic of aspMechanics) {
              const aspMechanicId = aspMechanic?.dataValues?.id || aspMechanic?.id;
              if (aspMechanicId) {
                const aspMechanicInProgressActivity = aspMechanicInProgressResponse.data.find(
                  (activity: any) => activity.aspMechanicId === aspMechanicId
                );
                if (aspMechanicInProgressActivity) {
                  if (aspMechanic.dataValues) {
                    aspMechanic.dataValues.assignedCount = aspMechanicInProgressActivity.assignedCount || 0;
                  } else {
                    aspMechanic.assignedCount = aspMechanicInProgressActivity.assignedCount || 0;
                  }
                }
              }
            }
          }
        }
      }

      if (aspMechanics.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      for (const aspMechanic of aspMechanics) {
        aspMechanic.dataValues.workStatusId = await getWorkStatusId(
          aspMechanic,
          serviceScheduledDate
        );
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: aspMechanics,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //USED FOR DELIVERY REQUEST PURPOSE && OWN PATROL PROCESS (LOGIN RESPONSE - TO ENABLE ATTENDANCE) PURPOSE
  public async getDetails(req: any, res: any) {
    try {
      const { aspMechanicId, setParanoidFalse } = req.query;
      const paranoid = setParanoidFalse == "true" ? false : true;

      const aspMechanic = await AspMechanic.findByPk(aspMechanicId, {
        paranoid: paranoid,
      });
      if (!aspMechanic) {
        return res.status(200).json({
          success: false,
          error: "ASP mechanic not found",
        });
      } else {
        return res.status(200).json({
          success: true,
          message: "ASP mechanic found",
          data: aspMechanic,
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // public async save(req: any, res: any) {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     let payload = getValidBody(req);
  //     const [
  //       aspType,
  //       performance,
  //       priority,
  //       city,
  //       getAspMechanicRoleDetail,
  //     ]: any = await Promise.all([
  //       Config.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: payload.aspTypeId,
  //           typeId: 57, //ASP Types
  //         },
  //       }),
  //       Config.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: payload.performanceId,
  //           typeId: 24, //ASP Performance
  //         },
  //       }),
  //       Config.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: payload.priorityId,
  //           typeId: 25, //ASP Priority
  //         },
  //       }),
  //       City.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: payload.cityId,
  //         },
  //       }),
  //       //GET ASP MECHANIC ROLE DETAIL
  //       axios.get(
  //         `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=ASP Mechanic`
  //       ),
  //     ]);

  //     if (!aspType) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "ASP type not found",
  //       });
  //     }

  //     if (!performance) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "Performance not found",
  //       });
  //     }

  //     if (!priority) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "Priority not found",
  //       });
  //     }

  //     if (!city) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "City not found",
  //       });
  //     }

  //     if (!getAspMechanicRoleDetail.data.success) {
  //       await transaction.rollback();
  //       return res.status(200).json(getAspMechanicRoleDetail.data);
  //     }

  //     if (payload.locationCapturedViaId) {
  //       const locationCapturedVia = await Config.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: payload.locationCapturedViaId,
  //           typeId: 58, //Location Capture Via Types
  //         },
  //       });
  //       if (!locationCapturedVia) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "Location captured via not found",
  //         });
  //       }
  //     }

  //     if (payload.dynamicTypeId) {
  //       const dynamicType = await Config.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: payload.dynamicTypeId,
  //           typeId: 59, //Dynamic Types
  //         },
  //       });
  //       if (!dynamicType) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "Dynamic type not found",
  //         });
  //       }
  //     }

  //     const aspMechanicRoleId = getAspMechanicRoleDetail.data.data.id;

  //     let existingAspMechanicData = null;
  //     if (payload.aspMechanicId) {
  //       //UPDATE
  //       const aspMechanic = await AspMechanic.findOne({
  //         attributes: ["id", "aspTypeId"],
  //         where: {
  //           id: payload.aspMechanicId,
  //         },
  //         paranoid: false,
  //       });
  //       if (!aspMechanic) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "ASP mechanic not found",
  //         });
  //       }

  //       let aspMechanicAlreadyExists = await AspMechanic.findOne({
  //         where: {
  //           code: payload.code,
  //           id: {
  //             [Op.ne]: payload.aspMechanicId,
  //           },
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (aspMechanicAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "ASP mechanic code is already taken",
  //         });
  //       }
  //       existingAspMechanicData = aspMechanic;
  //     } else {
  //       //ADD
  //       let aspMechanicAlreadyExists = await AspMechanic.findOne({
  //         where: {
  //           code: payload.code,
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (aspMechanicAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "ASP mechanic code is already taken",
  //         });
  //       }
  //     }

  //     //INACTIVE IS NOT POSSIBLE IF EXISTING TYPE IS COCO AND TECHNICIAN IS ON SHIFT
  //     if (
  //       payload.aspMechanicId &&
  //       existingAspMechanicData &&
  //       existingAspMechanicData.dataValues.aspTypeId == 771 &&
  //       payload.status == 0
  //     ) {
  //       const cocoAspMechanicInShift: any = await AspMechanic.findOne({
  //         where: {
  //           id: payload.aspMechanicId,
  //           aspId: {
  //             [Op.not]: null,
  //           },
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (cocoAspMechanicInShift) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error:
  //             "It’s not possible to inactive the technician at the moment because the technician is on shift",
  //         });
  //       }
  //     }

  //     //CHANGE ASP TYPE IS NOT POSSIBLE IF EXISTING TYPE IS COCO AND CURRENT IS THIRD PARY AND TECHNICIAN IS ON SHIFT
  //     if (
  //       payload.aspMechanicId &&
  //       existingAspMechanicData &&
  //       existingAspMechanicData.dataValues.aspTypeId == 771 &&
  //       payload.aspTypeId == 772
  //     ) {
  //       const cocoAspMechanicInShift: any = await AspMechanic.findOne({
  //         where: {
  //           id: payload.aspMechanicId,
  //           aspId: {
  //             [Op.not]: null,
  //           },
  //         },
  //         attributes: ["id"],
  //         paranoid: false,
  //       });
  //       if (cocoAspMechanicInShift) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error:
  //             "It’s not possible to change 'ASP Type' status at the moment because the technician is on shift",
  //         });
  //       }
  //     }

  //     let deletedAt = null;
  //     let deletedById = null;
  //     //INACTIVE
  //     if (payload.status == 0) {
  //       deletedAt = new Date();
  //       deletedById = payload.authUserId;
  //     }

  //     const aspMechanicData: any = {
  //       aspTypeId: payload.aspTypeId,
  //       locationCapturedViaId: payload.locationCapturedViaId,
  //       dynamicTypeId: payload.dynamicTypeId ? payload.dynamicTypeId : null,
  //       aspId: payload.aspId ? payload.aspId : null,
  //       name: payload.name,
  //       code: payload.code,
  //       email: payload.email ? payload.email : null,
  //       contactNumber: payload.contactNumber,
  //       alternateContactNumber: payload.alternateContactNumber
  //         ? payload.alternateContactNumber
  //         : null,
  //       performanceId: payload.performanceId,
  //       priorityId: payload.priorityId,
  //       address: payload.address,
  //       cityId: payload.cityId,
  //       latitude: payload.latitude ? payload.latitude : null,
  //       longitude: payload.longitude ? payload.longitude : null,
  //       deletedById: deletedById,
  //       deletedAt: deletedAt,
  //     };

  //     if (payload.createdById) {
  //       aspMechanicData.createdById = payload.createdById;
  //     }
  //     if (payload.updatedById) {
  //       aspMechanicData.updatedById = payload.updatedById;
  //     }

  //     let userEntityId: number;
  //     let savedAspMechanicId: number;
  //     let userCreatedByOrUpdatedById: any;
  //     let message = null;
  //     if (payload.aspMechanicId) {
  //       //UPDATE
  //       await AspMechanic.update(aspMechanicData, {
  //         where: {
  //           id: payload.aspMechanicId,
  //         },
  //         paranoid: false,
  //         transaction: transaction,
  //       });
  //       userEntityId = payload.aspMechanicId;
  //       savedAspMechanicId = payload.aspMechanicId;
  //       userCreatedByOrUpdatedById = {
  //         updatedById: payload.authUserId,
  //       };
  //       message = "ASP mechanic updated successfully";
  //     } else {
  //       //ADD
  //       const newAspMechanic = await AspMechanic.create(aspMechanicData, {
  //         transaction: transaction,
  //       });

  //       userEntityId = newAspMechanic.dataValues.id;
  //       savedAspMechanicId = newAspMechanic.dataValues.id;
  //       userCreatedByOrUpdatedById = {
  //         createdById: payload.authUserId,
  //       };
  //       message = "ASP mechanic created successfully";
  //     }

  //     //PROCESS ASP MECHANIC SUB SERVICES
  //     if (payload.subServiceIds.length > 0) {
  //       await AspMechanicSubService.destroy({
  //         where: {
  //           aspMechanicId: savedAspMechanicId,
  //         },
  //         force: true,
  //         transaction: transaction,
  //       });

  //       const aspMechanicSubServiceData = payload.subServiceIds.map(
  //         (subServiceId: number) => ({
  //           aspMechanicId: savedAspMechanicId,
  //           subServiceId: subServiceId,
  //         })
  //       );
  //       await AspMechanicSubService.bulkCreate(aspMechanicSubServiceData, {
  //         transaction,
  //       });
  //     }

  //     const aspMechanicUserData = {
  //       userId: payload.userId,
  //       roleId: aspMechanicRoleId,
  //       userTypeId: 143, //ASP MECHANIC
  //       entityId: userEntityId,
  //       code: payload.code,
  //       name: payload.name,
  //       mobileNumber: payload.contactNumber,
  //       email: payload.email,
  //       userName: payload.userName,
  //       password: payload.password,
  //       address: payload.address,
  //       changePassword: payload.changePassword,
  //       status: payload.status,
  //       deletedById: deletedById,
  //       ...userCreatedByOrUpdatedById,
  //     };

  //     //SAVE USER ENTITY
  //     const saveAspMechanicUserEntity = await axios.post(
  //       `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
  //       aspMechanicUserData
  //     );
  //     if (!saveAspMechanicUserEntity.data.success) {
  //       await transaction.rollback();
  //       return res.status(200).json(saveAspMechanicUserEntity.data);
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

  public async createNewCocoTechnician(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      let payload = getValidBody(req);

      const [city, getAspMechanicRoleDetail, aspMechanicAlreadyExists]: any =
        await Promise.all([
          City.findOne({
            attributes: ["id"],
            where: {
              id: payload.cityId,
            },
          }),
          //GET ASP MECHANIC ROLE DETAIL
          axios.get(
            `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=ASP Mechanic`
          ),
          AspMechanic.findOne({
            where: {
              code: payload.code,
            },
            attributes: ["id"],
            paranoid: false,
          }),
        ]);

      if (!city) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "City not found",
        });
      }

      if (!getAspMechanicRoleDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json(getAspMechanicRoleDetail.data);
      }

      if (aspMechanicAlreadyExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Code is already taken",
        });
      }

      const aspMechanicData: any = {
        aspTypeId: 771, //COCO
        locationCapturedViaId: 781, //STATIONARY
        name: payload.name,
        code: payload.code,
        contactNumber: payload.contactNumber,
        performanceId: 265, //POOR
        priorityId: 279, //10
        address: payload.address,
        cityId: payload.cityId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        createdById: payload.createdById,
      };

      //ADD
      const newAspMechanic = await AspMechanic.create(aspMechanicData, {
        transaction: transaction,
      });

      //PROCESS ASP MECHANIC SUB SERVICES
      if (payload.subServiceIds.length > 0) {
        await AspMechanicSubService.destroy({
          where: {
            aspMechanicId: newAspMechanic.dataValues.id,
          },
          force: true,
          transaction: transaction,
        });

        const aspMechanicSubServiceData = payload.subServiceIds.map(
          (subServiceId: number) => ({
            aspMechanicId: newAspMechanic.dataValues.id,
            subServiceId: subServiceId,
          })
        );
        await AspMechanicSubService.bulkCreate(aspMechanicSubServiceData, {
          transaction,
        });
      }

      const aspMechanicUserData = {
        userId: null,
        roleId: getAspMechanicRoleDetail.data.data.id,
        userTypeId: 143, //ASP MECHANIC
        entityId: newAspMechanic.dataValues.id,
        code: payload.code,
        name: payload.name,
        mobileNumber: payload.contactNumber,
        email: null,
        userName: payload.contactNumber,
        password: payload.contactNumber,
        address: payload.address,
        changePassword: 0,
        status: 1, //ACTIVE
        createdById: payload.authUserId,
        deletedById: null,
        ignorePasswordPattern: 1, //YES
      };

      //SAVE USER ENTITY
      const saveAspMechanicUserEntity = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
        aspMechanicUserData
      );
      if (!saveAspMechanicUserEntity.data.success) {
        await transaction.rollback();
        return res.status(200).json(saveAspMechanicUserEntity.data);
      }

      //ADD OWN PATROL VEHICLE NEW TECHNICIANS
      await OwnPatrolVehicleNewTechnicians.create(
        {
          aspId: payload.aspId,
          aspMechanicId: newAspMechanic.dataValues.id,
          createdById: payload.authUserId,
        },
        {
          transaction,
        }
      );

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "COCO Technician created successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async saveAspsDriver(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;

      //VALIDATIONS
      const v = {
        aspId: "required|integer",
        aspMechanicId: "integer",
        name: "required|string|minLength:3|maxLength:255",
        contactNumber: "required|string|minLength:10|maxLength:10",
        userId: "integer",
        changePassword: "integer",
        status: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [aspExists, getAspMechanicRoleDetail]: any = await Promise.all([
        Asp.findOne({
          where: {
            id: payload.aspId,
          },
          attributes: [
            "id",
            "performanceId",
            "priorityId",
            "isOwnPatrol",
            "latitude",
            "longitude",
            "addressLineOne",
            "addressLineTwo",
            "cityId",
            "hasMechanic",
          ],
          include: [
            {
              model: AspSubService,
              as: "subServices",
              attributes: ["id", "subServiceId"],
              required: false,
            },
          ],
          paranoid: false,
        }),
        //GET ASP MECHANIC ROLE DETAIL
        axios.get(
          `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=ASP Mechanic`
        ),
      ]);

      if (!aspExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      if (aspExists?.dataValues.isOwnPatrol == 1) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "As a COCO ASP, you are not allowed to add a technician.",
        });
      }

      if (
        !aspExists?.dataValues.hasMechanic ||
        aspExists?.dataValues.hasMechanic == 0
      ) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "You are not allowed to add a technician.",
        });
      }

      if (!getAspMechanicRoleDetail.data.success) {
        await transaction.rollback();
        return res.status(200).json(getAspMechanicRoleDetail.data);
      }

      let aspMechanicWhereClause = {};
      let aspMechanicUserEntityWhereClause = {};
      if (payload.aspMechanicId) {
        //UPDATE
        const aspMechanic = await AspMechanic.findOne({
          attributes: ["id"],
          where: {
            id: payload.aspMechanicId,
          },
          paranoid: false,
        });
        if (!aspMechanic) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "Technician not found",
          });
        }

        //INACTIVE
        if (payload.status == 0) {
          //GET ASP MECHANIC OVERALL SCHEDULED ACTIVITIES
          const getAspMechanicOverallScheduledActivities = await axios.post(
            `${caseServiceUrl}/${endpoint.case.getAspMechanicOverallScheduledActivities}`,
            {
              aspMechanicId: payload.aspMechanicId,
            }
          );
          if (
            getAspMechanicOverallScheduledActivities.data.success &&
            getAspMechanicOverallScheduledActivities.data.data.length > 0
          ) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error:
                "The technician is busy handling cases, so inactive is not allowed.",
            });
          }
        }

        aspMechanicWhereClause = {
          code: payload.contactNumber,
          id: {
            [Op.ne]: payload.aspMechanicId,
          },
        };
        aspMechanicUserEntityWhereClause = {
          userName: payload.contactNumber,
          entityId: {
            [Op.ne]: payload.aspMechanicId,
          },
        };
      } else {
        //ADD
        aspMechanicWhereClause = {
          code: payload.contactNumber,
        };
        aspMechanicUserEntityWhereClause = {
          userName: payload.contactNumber,
        };
      }

      const [
        aspMechanicAlreadyExists,
        aspMechanicUserEntityAlreadyExists,
      ]: any = await Promise.all([
        AspMechanic.findOne({
          where: aspMechanicWhereClause,
          attributes: ["id"],
          paranoid: false,
        }),
        axios.post(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUserByWherClause}`,
          aspMechanicUserEntityWhereClause
        ),
      ]);

      if (aspMechanicAlreadyExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Technician mobile number is already taken",
        });
      }

      if (aspMechanicUserEntityAlreadyExists?.data?.success) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Technician mobile number is already taken",
        });
      }

      let deletedAt = null;
      let deletedById = null;
      //INACTIVE
      if (payload.status == 0) {
        deletedAt = new Date();
        deletedById = payload.authUserId;
      }

      let address = aspExists.addressLineOne;
      if (aspExists.addressLineTwo) {
        address = `${address}, ${aspExists.addressLineTwo}`;
      }

      const aspMechanicRoleId = getAspMechanicRoleDetail.data.data.id;

      const aspMechanicData: any = {
        aspTypeId: 772, //THIRD PARTY
        aspId: payload.aspId,
        name: payload.name,
        code: payload.contactNumber,
        contactNumber: payload.contactNumber,
        performanceId: aspExists.performanceId,
        priorityId: aspExists.priorityId,
        address: address,
        cityId: aspExists.cityId,
        latitude: aspExists.latitude,
        longitude: aspExists.longitude,
        deletedById: deletedById,
        deletedAt: deletedAt,
      };

      if (payload.createdById) {
        aspMechanicData.createdById = payload.createdById;
      }
      if (payload.updatedById) {
        aspMechanicData.updatedById = payload.updatedById;
      }

      let userEntityId: number;
      let savedAspMechanicId: number;
      let userCreatedByOrUpdatedById: any;
      let message = null;
      if (payload.aspMechanicId) {
        //UPDATE
        await AspMechanic.update(aspMechanicData, {
          where: {
            id: payload.aspMechanicId,
          },
          paranoid: false,
          transaction: transaction,
        });
        userEntityId = payload.aspMechanicId;
        savedAspMechanicId = payload.aspMechanicId;
        userCreatedByOrUpdatedById = {
          updatedById: payload.authUserId,
        };
        message = "Technician updated successfully";
      } else {
        //ADD
        const newAspMechanic = await AspMechanic.create(aspMechanicData, {
          transaction: transaction,
        });

        userEntityId = newAspMechanic.dataValues.id;
        savedAspMechanicId = newAspMechanic.dataValues.id;
        userCreatedByOrUpdatedById = {
          createdById: payload.authUserId,
        };
        message = "Technician created successfully";
      }

      //PROCESS ASP MECHANIC SUB SERVICES
      payload.subServiceIds =
        aspExists.dataValues.subServices?.map(
          (aspSubService: any) => aspSubService.dataValues.subServiceId
        ) || [];

      if (payload.subServiceIds.length > 0) {
        await AspMechanicSubService.destroy({
          where: {
            aspMechanicId: savedAspMechanicId,
          },
          force: true,
          transaction: transaction,
        });

        const aspMechanicSubServiceData = payload.subServiceIds.map(
          (subServiceId: number) => ({
            aspMechanicId: savedAspMechanicId,
            subServiceId: subServiceId,
          })
        );
        await AspMechanicSubService.bulkCreate(aspMechanicSubServiceData, {
          transaction,
        });
      }

      const aspMechanicUserData = {
        userId: payload.userId,
        roleId: aspMechanicRoleId,
        userTypeId: 143, //ASP MECHANIC
        entityId: userEntityId,
        code: payload.contactNumber,
        name: payload.name,
        mobileNumber: payload.contactNumber,
        email: null,
        userName: payload.contactNumber,
        password: payload.contactNumber,
        address: address,
        ignorePasswordPattern: 1,
        changePassword: payload.changePassword,
        status: payload.status,
        deletedById: deletedById,
        ...userCreatedByOrUpdatedById,
      };

      //SAVE USER ENTITY
      const saveAspMechanicUserEntity = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
        aspMechanicUserData
      );
      if (!saveAspMechanicUserEntity.data.success) {
        await transaction.rollback();
        return res.status(200).json(saveAspMechanicUserEntity.data);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: message,
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async getAllAspMechanics(req: any, res: any) {
    try {
      let {
        limit,
        offset,
        apiType,
        search,
        status,
        aspTypeId,
        aspId,
        performanceId,
        priorityId,
        cityId,
        locationCapturedViaId,
        dynamicTypeId,
        financeAdminAspId,
        routeOrigin,
      } = req.query;

      const where: any = {};
      if (aspTypeId) {
        where.aspTypeId = aspTypeId;
      }
      if (aspId) {
        where.aspId = aspId;
      }
      if (performanceId) {
        where.performanceId = performanceId;
      }
      if (priorityId) {
        where.priorityId = priorityId;
      }
      if (cityId) {
        where.cityId = cityId;
      }
      if (locationCapturedViaId) {
        where.locationCapturedViaId = locationCapturedViaId;
      }
      if (dynamicTypeId) {
        where.dynamicTypeId = dynamicTypeId;
      }
      if (financeAdminAspId) {
        let aspIds = [];
        aspIds.push(financeAdminAspId);

        const subAsps = await Asp.findAll({
          attributes: ["id"],
          where: {
            financeAdminId: financeAdminAspId,
          },
          paranoid: false,
        });

        if (subAsps.length > 0) {
          subAsps.map((asp: any) => {
            aspIds.push(asp.id);
          });
        }
        where.aspId = {
          [Op.in]: aspIds,
        };
      }

      let aspMechanics: any;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
          ];
        }

        aspMechanics = await AspMechanic.findAll({
          where,
          attributes: ["id", "name", "code"],
          order: [["id", "asc"]],
        });

        if (aspMechanics.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else if (apiType == "aspsDriver") {

        if (routeOrigin && routeOrigin == "buddyApp" && aspId) {
          let aspIds = [];
          aspIds.push(aspId);

          const subAsps = await Asp.findAll({
            attributes: ["id"],
            where: {
              financeAdminId: aspId,
            },
            paranoid: false,
          });

          if (subAsps.length > 0) {
            subAsps.map((asp: any) => {
              aspIds.push(asp.id);
            });
          }
          where.aspId = {
            [Op.in]: aspIds,
          };
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
            { contactNumber: { [Op.like]: `%${search}%` } },
            Sequelize.literal(`asp.code LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (aspMechanic.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = AspMechanicController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = AspMechanicController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        aspMechanics = await AspMechanic.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "code",
            "contactNumber",
            [Sequelize.literal("( SELECT asp.code)"), "aspCode"],
            [
              Sequelize.literal("( SELECT asp.workshopName)"),
              "aspWorkshopName",
            ],
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
              model: Asp,
              attributes: ["id", "name"],
              required: false,
            },
          ],
          order: [["id", "asc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (aspMechanics.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
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
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
            { contactNumber: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { address: { [Op.like]: `%${search}%` } },
            Sequelize.literal(`aspType.name LIKE "%${search}%"`),
            Sequelize.literal(`asp.name LIKE "%${search}%"`),
            Sequelize.literal(`asp.code LIKE "%${search}%"`),
            Sequelize.literal(`performance.name LIKE "%${search}%"`),
            Sequelize.literal(`priority.name LIKE "%${search}%"`),
            Sequelize.literal(`city.name LIKE "%${search}%"`),
            Sequelize.literal(`locationCapturedVia.name LIKE "%${search}%"`),
            Sequelize.literal(`dynamicType.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (aspMechanic.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = AspMechanicController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = AspMechanicController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        aspMechanics = await AspMechanic.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "code",
            "contactNumber",
            "email",
            "address",
            [Sequelize.literal("( SELECT aspType.name)"), "aspTypeName"],
            [Sequelize.literal("( SELECT asp.name)"), "aspName"],
            [Sequelize.literal("( SELECT asp.code)"), "aspCode"],
            [
              Sequelize.literal("( SELECT performance.name)"),
              "performanceName",
            ],
            [Sequelize.literal("( SELECT priority.name)"), "priorityName"],
            [Sequelize.literal("( SELECT city.name)"), "cityName"],
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
              model: Asp,
              attributes: ["id", "name", "code"],
              required: false,
              paranoid: false,
            },
            {
              model: Config,
              as: "aspType",
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
              model: City,
              as: "city",
              required: false,
              attributes: ["id", "name"],
              paranoid: false,
            },
            {
              model: Config,
              as: "locationCapturedVia",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: Config,
              as: "dynamicType",
              attributes: ["id", "name"],
              required: false,
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });
        if (aspMechanics.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: aspMechanics,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async getOneAspMechanic(req: any, res: any) {
    try {
      let payload = getValidBody(req);
      const { aspMechanicId } = payload;
      const aspMechanic: any = await getAspMechanic(aspMechanicId);

      if (!aspMechanic) {
        return res.status(200).json({
          success: false,
          error: "ASP mechanic not found",
        });
      } else {
        if (aspMechanic.aspMechanicSubServices.length > 0) {
          const aspMechanicSubServiceIds =
            aspMechanic.aspMechanicSubServices.map(
              (aspMechanicSubService: any) => aspMechanicSubService.subServiceId
            );
          const subServices = await SubService.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: aspMechanicSubServiceIds,
              },
            },
            paranoid: false,
          });
          for (const aspMechanicSubService of aspMechanic.aspMechanicSubServices) {
            const subServiceRecord = subServices.find(
              (subService: any) =>
                subService.id === aspMechanicSubService.subServiceId
            );
            aspMechanicSubService.dataValues.subServiceName = subServiceRecord
              ? subServiceRecord.dataValues.name
              : null;
          }
        }

        aspMechanic.dataValues.status = aspMechanic.dataValues.deletedAt
          ? "Inactive"
          : "Active";
        return res.status(200).json({
          success: true,
          message: "ASP mechanic found",
          data: aspMechanic,
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async getFormData(req: any, res: any) {
    try {
      const { aspMechanicId } = req.query;
      let aspMechanicData = null;
      if (aspMechanicId) {
        const aspMechanicExists: any = await getAspMechanic(aspMechanicId);
        if (!aspMechanicExists) {
          return res.status(200).json({
            success: false,
            error: "ASP mechanic not found",
          });
        }

        //GET ASP MECHANIC USER DETAILS
        const getEntityUser: any = await axios.get(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=143&entityId=${aspMechanicId}`
        );
        if (!getEntityUser.data.success) {
          return res.status(200).json({
            success: false,
            error: getEntityUser.data.error,
          });
        }

        aspMechanicData = aspMechanicExists.dataValues;
        aspMechanicData.status = aspMechanicExists.dataValues.deletedAt ? 0 : 1;
        const userData = getEntityUser.data.data;
        aspMechanicData.userId = userData.id;
        aspMechanicData.userName = userData.userName;
      }

      //EXTRAS
      let [
        aspType,
        performance,
        priority,
        locationCapturedVia,
        dynamicType,
        states,
        subServices,
        cocoVehicles,
        services,
      ] = await Promise.all([
        Config.findAll({
          attributes: ["id", "name"],
          where: { typeId: 57 },
          order: [["id", "asc"]],
        }),
        Config.findAll({
          attributes: ["id", "name"],
          where: { typeId: 24 },
          order: [["id", "asc"]],
        }),
        Config.findAll({
          attributes: ["id", "name"],
          where: { typeId: 25 },
          order: [["id", "asc"]],
        }),
        Config.findAll({
          attributes: ["id", "name"],
          where: { typeId: 58 },
          order: [["id", "asc"]],
        }),
        Config.findAll({
          attributes: ["id", "name"],
          where: { typeId: 59 },
          order: [["id", "asc"]],
        }),
        State.findAll({
          attributes: ["id", "name"],
          where: { countryId: 1 },
          order: [["id", "asc"]],
        }),
        SubService.findAll({
          attributes: ["id", "name"],
          include: {
            model: Service,
            attributes: ["id", "name"],
            required: true,
          },
          order: [["id", "asc"]],
        }),
        OwnPatrolVehicle.findAll({
          attributes: ["id", "vehicleRegistrationNumber"],
          order: [["id", "asc"]],
        }),
        Service.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
      ]);

      const data = {
        extras: {
          aspType,
          performance,
          priority,
          locationCapturedVia,
          dynamicType,
          states,
          services,
          subServices,
          cocoVehicles,
        },
        aspMechanicData,
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
      let payload = getValidBody(req);
      const { aspMechanicIds, status, updatedById, deletedById } = payload;

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const aspMechanicId of aspMechanicIds) {
        const aspMechanicExists = await AspMechanic.findOne({
          attributes: ["id", "aspTypeId", "aspId"],
          where: {
            id: aspMechanicId,
          },
          paranoid: false,
        });
        if (!aspMechanicExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `ASP mechanic - (${aspMechanicId}) not found`,
          });
        }

        //IF COCO TECHNICIAN IS IN SHIFT THEN INACTIVE IS NOT POSSIBLE
        if (
          aspMechanicExists.dataValues.aspTypeId == 771 &&
          aspMechanicExists.dataValues.aspId &&
          status == 0
        ) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `ASP mechanic - (${aspMechanicId}) It’s not possible to inactive the technician at the moment because the technician is on shift`,
          });
        }

        await AspMechanic.update(
          { updatedById, deletedById, deletedAt },
          {
            where: { id: aspMechanicId },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

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
        return res.status(200).json(entityAspMechanicUserUpdateStatus.data);
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ASP mechanic status updated successfully",
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
      let payload = getValidBody(req);
      const { aspMechanicIds } = payload;
      for (const aspMechanicId of aspMechanicIds) {
        const aspMechanicExists = await AspMechanic.findOne({
          attributes: ["id", "aspTypeId", "aspId"],
          where: {
            id: aspMechanicId,
          },
          paranoid: false,
        });
        if (!aspMechanicExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `ASP mechanic - (${aspMechanicId}) not found`,
          });
        }

        //IF COCO TECHNICIAN IS IN SHIFT THEN DELETE IS NOT POSSIBLE
        if (
          aspMechanicExists.dataValues.aspTypeId == 771 &&
          aspMechanicExists.dataValues.aspId
        ) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `ASP mechanic - (${aspMechanicId}) It’s not possible to delete the technician at the moment because the technician is on shift`,
          });
        }

        await AspMechanic.destroy({
          where: {
            id: aspMechanicId,
          },
          force: true,
          transaction: transaction,
        });
      }

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

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ASP mechanic deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getById = async (req: any, res: any) => {
    try {
      let payload = getValidBody(req);
      const aspMechanic = await AspMechanic.findOne({
        attributes: ["id", "name", "aspTypeId", "workStatusId"],
        where: { id: payload.aspMechanicId },
      });
      if (!aspMechanic) {
        return res.status(200).json({
          success: false,
          error: "ASP mechanic not found",
        });
      }
      return res.status(200).json({
        success: true,
        data: aspMechanic,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getWorkStatus = async (req: any, res: any) => {
    try {
      const workStatus = await Config.findAll({
        attributes: ["id", "name"],
        where: { typeId: 2 }, //ASP MECHANIC WORK STATUSES
        order: [["id", "asc"]],
      });

      return res.status(200).json({
        success: true,
        data: workStatus,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  updateWorkStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      let payload = getValidBody(req);
      const { aspMechanicId, workStatusId, updatedById } = payload;

      const [aspMechanicExists, workStatusExists]: any = await Promise.all([
        AspMechanic.findOne({
          attributes: ["id", "aspTypeId", "aspId"],
          where: {
            id: aspMechanicId,
            aspTypeId: 771, //COCO
          },
          paranoid: false,
        }),
        Config.findOne({
          attributes: ["id", "name"],
          where: {
            typeId: 2, //ASP MECHANIC WORK STATUS
            id: workStatusId,
          },
        }),
      ]);

      if (!aspMechanicExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `ASP mechanic not found`,
        });
      }

      if (!workStatusExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `Work status not found`,
        });
      }

      await AspMechanic.update(
        { workStatusId, updatedById },
        {
          where: { id: aspMechanicId },
          paranoid: false,
          transaction: transaction,
        }
      );

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "ASP mechanic work status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
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
      const aspMechanicErrorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      // let importColumns = [
      //   "ASP Type",
      //   "ASP Code",
      //   "Name",
      //   "Code",
      //   "Email",
      //   "Contact Number",
      //   "Alternate Contact Number",
      //   "Latitude",
      //   "Longitude",
      //   "Performance",
      //   "Priority",
      //   "Address",
      //   "State",
      //   "City",
      //   "Location Capture Via",
      //   "Dynamic Type",
      //   "Sub Services",
      //   "Username",
      //   "Password",
      //   "Change Password",
      //   "Status",
      // ];

      const importColumnsResponse = await Utils.getExcelImportColumns(1095);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1095,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      //GET all asp mechanic user details
      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          roleIds: [5],
        }
      );
      let aspMechanicUserDetails = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        aspMechanicUserDetails = getUserDetails.data.data.roleUserDetails;
      }

      const aspMechanicSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const aspMechanicSheet of aspMechanicSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!aspMechanicSheet.hasOwnProperty(importColumn)) {
            aspMechanicSheet[importColumn] = "";
          }
        });

        let reArrangedAspMechanics: any = {
          "ASP Type": aspMechanicSheet["ASP Type"]
            ? String(aspMechanicSheet["ASP Type"])
            : null,
          "ASP Code": aspMechanicSheet["ASP Code"]
            ? String(aspMechanicSheet["ASP Code"])
            : null,
          Name: aspMechanicSheet["Name"]
            ? String(aspMechanicSheet["Name"])
            : null,
          Code: aspMechanicSheet["Code"]
            ? String(aspMechanicSheet["Code"])
            : null,
          Email: aspMechanicSheet["Email"]
            ? String(aspMechanicSheet["Email"])
            : null,
          "Contact Number": aspMechanicSheet["Contact Number"]
            ? String(aspMechanicSheet["Contact Number"])
            : null,
          "Alternate Contact Number": aspMechanicSheet[
            "Alternate Contact Number"
          ]
            ? String(aspMechanicSheet["Alternate Contact Number"])
            : null,
          Latitude: aspMechanicSheet["Latitude"]
            ? String(aspMechanicSheet["Latitude"])
            : null,
          Longitude: aspMechanicSheet["Longitude"]
            ? String(aspMechanicSheet["Longitude"])
            : null,
          Performance: aspMechanicSheet["Performance"]
            ? String(aspMechanicSheet["Performance"])
            : null,
          Priority: aspMechanicSheet["Priority"]
            ? String(aspMechanicSheet["Priority"])
            : null,
          Address: aspMechanicSheet["Address"]
            ? String(aspMechanicSheet["Address"])
            : null,
          State: aspMechanicSheet["State"]
            ? String(aspMechanicSheet["State"])
            : null,
          City: aspMechanicSheet["City"]
            ? String(aspMechanicSheet["City"])
            : null,
          "Location Capture Via": aspMechanicSheet["Location Capture Via"]
            ? String(aspMechanicSheet["Location Capture Via"])
            : null,
          "Dynamic Type": aspMechanicSheet["Dynamic Type"]
            ? String(aspMechanicSheet["Dynamic Type"])
            : null,
          "COCO Vehicle": aspMechanicSheet["COCO Vehicle"]
            ? String(aspMechanicSheet["COCO Vehicle"])
            : null,
          "Sub Services": aspMechanicSheet["Sub Services"]
            ? String(aspMechanicSheet["Sub Services"])
            : null,
          Username: aspMechanicSheet["Username"]
            ? String(aspMechanicSheet["Username"])
            : null,
          Password: aspMechanicSheet["Password"]
            ? String(aspMechanicSheet["Password"])
            : null,
          "Change Password": aspMechanicSheet["Change Password"]
            ? String(aspMechanicSheet["Change Password"])
            : null,
          Status: aspMechanicSheet["Status"]
            ? String(aspMechanicSheet["Status"])
            : null,
        };

        if (aspMechanicSheet["Code"]) {
          const record: any = {};
          const keyMapping: any = {
            aSPType: "aspTypeId",
            aSPCode: "aspId",
            performance: "performanceId",
            priority: "priorityId",
            state: "stateId",
            city: "cityId",
            locationCaptureVia: "locationCapturedViaId",
            dynamicType: "dynamicTypeId",
            cOCOVehicle: "cocoVehicleId",
            subServices: "subServiceIds",
            username: "userName",
          };

          for (const key in reArrangedAspMechanics) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedAspMechanics[key];
          }

          //VALIDATIONS
          const validationErrors = [];
          if (
            record.contactNumber &&
            !/^[0-9]{10}$/.test(record.contactNumber)
          ) {
            validationErrors.push("Invalid contact number.");
          }

          if (
            record.alternateContactNumber &&
            !/^[0-9]{10}$/.test(record.alternateContactNumber)
          ) {
            validationErrors.push("Invalid alternate contact number.");
          }

          if (record.latitude && !/^-?\d+(\.\d+)?$/.test(record.latitude)) {
            validationErrors.push("Invalid latitude.");
          }

          if (record.longitude && !/^-?\d+(\.\d+)?$/.test(record.longitude)) {
            validationErrors.push("Invalid longitude.");
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

          if (validationErrors.length > 0) {
            aspMechanicErrorData.push({
              ...reArrangedAspMechanics,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //ASP
          let aspMechanicId = null;
          let userId = null;
          if (record.code) {
            const trimmedCode = record.code.trim();
            const aspMechanicAlreadyExists = await AspMechanic.findOne({
              where: {
                code: trimmedCode,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (aspMechanicAlreadyExists) {
              aspMechanicId = aspMechanicAlreadyExists.dataValues.id;

              //USER
              const aspMechanicUserDetail = aspMechanicUserDetails.find(
                (aspMechanicUserDetail: any) =>
                  aspMechanicUserDetail.entityId ==
                  aspMechanicAlreadyExists.dataValues.id &&
                  aspMechanicUserDetail.roleId == 5
              );

              if (aspMechanicUserDetail) {
                userId = aspMechanicUserDetail.id;
              }
            }
          }

          //ASP TYPE
          let aspType: any = null;
          if (record.aspTypeId) {
            const trimmedAspTypeName = record.aspTypeId.trim();
            aspType = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedAspTypeName,
                typeId: 57, //ASP Mechanic ASP Types
              },
            });
          }
          const aspTypeId = aspType ? aspType.dataValues.id : 0;

          // Validate COCO Vehicle registration number pattern if ASP Type is COCO
          if (aspTypeId == 771 && record.cocoVehicleId) {
            const cocoVehiclePattern = /^(?:[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}|[0-9]{2}BH[0-9]{4}[A-Z]{2})$/;
            if (!cocoVehiclePattern.test(record.cocoVehicleId.trim())) {
              validationErrors.push("Invalid COCO vehicle registration number format.");
            }
          }

          // Re-check validation errors after ASP Type determination
          if (validationErrors.length > 0) {
            aspMechanicErrorData.push({
              ...reArrangedAspMechanics,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //IF ASP TYPE THIRD PARTY THEN GET ASP
          let asp: any = null;
          if (record.aspId && aspTypeId == 772) {
            const trimmedAspCode = record.aspId.trim();
            asp = await Asp.findOne({
              attributes: ["id"],
              where: {
                code: trimmedAspCode,
              },
              paranoid: false,
            });
          }
          const aspId = asp ? asp.dataValues.id : 0;

          //PERFORMANCE
          let performance: any = null;
          if (record.performanceId) {
            const trimmedPerformanceName = record.performanceId.trim();
            performance = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedPerformanceName,
                typeId: 24, //ASP PERFORMANCES
              },
            });
          }
          const performanceId = performance ? performance.dataValues.id : 0;

          //PRIORITY
          let priority: any = null;
          if (record.priorityId) {
            const trimmedPriorityName = record.priorityId.trim();
            priority = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedPriorityName,
                typeId: 25, //ASP PRIORITIES
              },
            });
          }
          const priorityId = priority ? priority.dataValues.id : 0;

          //STATE
          let state: any = null;
          if (record.stateId) {
            const trimmedStateName = record.stateId.trim();
            state = await State.findOne({
              attributes: ["id", "name"],
              where: { name: trimmedStateName },
              paranoid: false,
            });
          }
          const stateId = state ? state.dataValues.id : 0;

          //CITY
          let city: any = null;
          if (stateId && record.cityId) {
            const trimmedCityName = record.cityId.trim();
            city = await City.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedCityName,
                stateId: stateId,
              },
              paranoid: false,
            });
          }
          const cityId = city ? city.dataValues.id : 0;

          //IF ASP TYPE COCO THEN GET LOCATION CAPTURE VIA
          let locationCapturedVia: any = null;
          if (record.locationCapturedViaId && aspTypeId == 771) {
            const trimmedLocationCapturedViaName =
              record.locationCapturedViaId.trim();
            locationCapturedVia = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedLocationCapturedViaName,
                typeId: 58, //ASP Mechanic Location Capture Via Types
              },
              paranoid: false,
            });
          }
          const locationCapturedViaId = locationCapturedVia
            ? locationCapturedVia.dataValues.id
            : 0;

          //IF LOCATION CAPTURE VIA IS DYNAMIC THEN GET DYNAMIC TYPE
          let dynamicType: any = null;
          if (record.dynamicTypeId && locationCapturedViaId == 782) {
            const trimmedDynamicTypeName = record.dynamicTypeId.trim();
            dynamicType = await Config.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedDynamicTypeName,
                typeId: 59, //ASP Mechanic Dynamic Types
              },
            });
          }
          const dynamicTypeId = dynamicType ? dynamicType.dataValues.id : 0;

          //IF ASP TYPE COCO THEN GET COCO VEHICLE
          let cocoVehicle: any = null;
          if (record.cocoVehicleId && aspTypeId == 771) {
            const trimmedCocoVehicleRegistrationNumber =
              record.cocoVehicleId.trim();
            cocoVehicle = await OwnPatrolVehicle.findOne({
              attributes: ["id", "vehicleRegistrationNumber"],
              where: {
                vehicleRegistrationNumber: trimmedCocoVehicleRegistrationNumber,
              },
            });
          }
          const cocoVehicleId = cocoVehicle ? cocoVehicle.dataValues.id : 0;

          //SUB SERVICES
          let orgSubServiceIds = [];
          let trimmedSubServiceNames = [];
          if (record.subServiceIds) {
            trimmedSubServiceNames = record.subServiceIds.trim().split(",");
            orgSubServiceIds = (
              await SubService.findAll({
                attributes: ["id"],
                where: {
                  name: { [Op.in]: trimmedSubServiceNames },
                },
                paranoid: false,
              })
            ).map((subService: any) => subService.id);
          }

          record.subServiceIds = orgSubServiceIds;
          record.subServiceNames = trimmedSubServiceNames;
          record.aspMechanicId = aspMechanicId;
          record.aspTypeId = aspTypeId;
          record.aspId = aspId;
          record.userId = userId;
          record.performanceId = performanceId;
          record.priorityId = priorityId;
          record.cityId = cityId;
          record.locationCapturedViaId = locationCapturedViaId;
          record.dynamicTypeId = dynamicTypeId;
          record.cocoVehicleId = cocoVehicleId;
          record.changePassword =
            record.changePassword &&
              record.changePassword.trim().toLowerCase() === "yes"
              ? 1
              : 0;
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
            aspMechanicErrorData.push({
              ...reArrangedAspMechanics,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "ASP mechanic created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          aspMechanicErrorData.push({
            ...reArrangedAspMechanics,
            Error: "ASP mechanic code is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New ASP mechanic created (${newRecordsCreated} records) and existing ASP mechanic updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
            ? `New ASP mechanic created (${newRecordsCreated} records)`
            : existingRecordsUpdated > 0
              ? `Existing ASP mechanic updated (${existingRecordsUpdated} records)`
              : "No ASP mechanic created or updated";

      if (aspMechanicErrorData.length === 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Error Buffer Generation;
      importColumns.push("Error");

      const buffer = generateXLSXAndXLSExport(
        aspMechanicErrorData,
        importColumns,
        "xlsx",
        "AspMechanicDetails"
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

      const aspMechanicDetails = await AspMechanic.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!aspMechanicDetails || aspMechanicDetails.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let aspMechanicDetailsArray: any[] = [];

      const aspMechanicIds = [
        ...new Set(
          aspMechanicDetails.map((aspMechanicData: any) => aspMechanicData.id)
        ),
      ];
      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          aspMechanicIds: aspMechanicIds,
        }
      );
      let aspMechanicUsers = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        aspMechanicUsers = getUserDetails.data.data.aspMechanicUsers;
      }

      for (const aspMechanicDetail of aspMechanicDetails) {
        const [
          aspType,
          asp,
          performance,
          priority,
          city,
          locationCapturedVia,
          dynamicType,
          cocoVehicle,
        ] = await Promise.all([
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspMechanicDetail.dataValues.aspTypeId },
          }),
          Asp.findOne({
            attributes: ["id", "code", "name"],
            where: { id: aspMechanicDetail.dataValues.aspId },
            paranoid: false,
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspMechanicDetail.dataValues.performanceId },
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspMechanicDetail.dataValues.priorityId },
          }),
          City.findOne({
            attributes: ["id", "name"],
            where: { id: aspMechanicDetail.dataValues.cityId },
            paranoid: false,
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspMechanicDetail.dataValues.locationCapturedViaId },
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: { id: aspMechanicDetail.dataValues.dynamicTypeId },
          }),
          OwnPatrolVehicle.findOne({
            attributes: ["id", "vehicleRegistrationNumber"],
            where: { id: aspMechanicDetail.dataValues.cocoVehicleId },
            paranoid: false,
          }),
        ]);

        const aspMechanicUser = aspMechanicUsers.find(
          (aspMechanicUser: any) =>
            aspMechanicUser.entityId == aspMechanicDetail.dataValues.id
        );

        const aspMechanicDetails = {
          "ASP Type": aspType?.dataValues.name || null,
          "ASP Code": asp?.dataValues.code || null,
          Name: aspMechanicDetail.dataValues.name,
          Code: aspMechanicDetail.dataValues.code,
          Email: aspMechanicDetail.dataValues.email,
          "Contact Number": aspMechanicDetail.dataValues.contactNumber,
          "Alternate Contact Number":
            aspMechanicDetail.dataValues.alternateContactNumber,
          Latitude: aspMechanicDetail.dataValues.latitude,
          Longitude: aspMechanicDetail.dataValues.longitude,
          Performance: performance?.dataValues.name || null,
          Priority: priority?.dataValues.name || null,
          Address: aspMechanicDetail.dataValues.address,
          City: city?.dataValues.name || null,
          "Location Captured Via": locationCapturedVia?.dataValues.name || null,
          "Dynamic Type": dynamicType?.dataValues.name || null,
          "COCO Vehicle": cocoVehicle?.dataValues.vehicleRegistrationNumber || null,
          Username: aspMechanicUser?.userName || null,
          "Created At": moment
            .tz(aspMechanicDetail.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: aspMechanicDetail.dataValues.deletedAt
            ? "Inactive"
            : "Active",
        };
        aspMechanicDetailsArray.push(aspMechanicDetails);
      }

      // Column Filter;
      const aspMechanicColumnNames = aspMechanicDetailsArray
        ? Object.keys(aspMechanicDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          aspMechanicDetailsArray,
          aspMechanicColumnNames,
          format,
          "Asp Mechanic Details"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          aspMechanicDetailsArray,
          aspMechanicColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `Asp mechanic data export successfully`,
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

export const removeAspId: any = async (
  aspMechanicIds: any,
  transaction: any
) => {
  try {
    for (const aspMechanicId of aspMechanicIds) {
      const aspMechanicExists = await AspMechanic.findOne({
        attributes: ["id"],
        where: {
          id: aspMechanicId,
        },
        paranoid: false,
      });
      if (!aspMechanicExists) {
        return {
          success: false,
          error: `ASP mechanic - (${aspMechanicId}) not found`,
        };
      }

      await AspMechanic.update(
        { aspId: null },
        {
          where: { id: aspMechanicId },
          paranoid: false,
          transaction: transaction,
        }
      );
    }
    return {
      success: true,
      message: `ASP mechanic asp id updated successfully`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error,
    };
  }
};

//GET LAST ATTENDED COCO TECHNICIANS AGAINST THE COCO VEHICLE
export const getLastAttendedCocoTechnicians = async (
  ownPatrolVehicleTechnicianLogs: any
) => {
  try {
    const lastAttendedCocoTechnicianLimit = await Config.findOne({
      where: {
        typeId: 66, //LAST ATTENDED COCO TECHNICIANS LIMIT
      },
      attributes: ["name"],
    });
    const cocoAspVehiclePreviousTechnicianIds =
      ownPatrolVehicleTechnicianLogs.map(
        (ownPatrolVehicleTechnicianLog: any) =>
          ownPatrolVehicleTechnicianLog.aspMechanicId
      );
    const aspMechanics = await AspMechanic.findAll({
      where: {
        id: {
          [Op.in]: cocoAspVehiclePreviousTechnicianIds,
        },
      },
      attributes: [
        "id",
        "aspTypeId",
        "name",
        "code",
        "contactNumber",
        "alternateContactNumber",
        "workStatusId",
      ],
      order: [["updatedAt", "DESC"]],
      limit: lastAttendedCocoTechnicianLimit
        ? +lastAttendedCocoTechnicianLimit.dataValues.name
        : 5,
    });
    return aspMechanics;
  } catch (error: any) {
    throw error;
  }
};

export const getNewCocoTechnicians = async (
  inShiftOrLastAttendedTechnicians: any,
  newCocoTechnicians: any
) => {
  try {
    const newCocoTechnicianLimit = await Config.findOne({
      where: {
        typeId: 77, //NEW COCO TECHNICIANS LIMIT
      },
      attributes: ["name"],
    });

    //GET UNIQUE NEW COCO TECHNICIANS BY COMPARING NEW COCO TECHNICIANS WITH IN SHIFT OR LAST ATTENDED TECHNICIANS
    const uniqueNewCocoTechnicianIds = newCocoTechnicians
      .map((newCocoTechnician: any) => newCocoTechnician.aspMechanicId)
      .filter(
        (newCocoTechnicianId: any) =>
          !inShiftOrLastAttendedTechnicians.some(
            (inShiftOrLastAttendedTechnician: any) =>
              inShiftOrLastAttendedTechnician.id === newCocoTechnicianId
          )
      );

    if (uniqueNewCocoTechnicianIds.length > 0) {
      const limit = +newCocoTechnicianLimit?.dataValues.name || 5;
      const aspMechanics = await AspMechanic.findAll({
        where: {
          id: {
            [Op.in]: uniqueNewCocoTechnicianIds,
          },
        },
        attributes: [
          "id",
          "aspTypeId",
          "name",
          "code",
          "contactNumber",
          "alternateContactNumber",
          "workStatusId",
        ],
        order: [["updatedAt", "DESC"]],
        limit: limit,
      });
      return aspMechanics;
    } else {
      return [];
    }
  } catch (error: any) {
    throw error;
  }
};

//GET ASP MECHANIC WORK STATUS ID
export const getWorkStatusId = async (
  aspMechanic: any,
  serviceScheduledDate: any
) => {
  try {
    if (serviceScheduledDate) {
      //GET ASP WORK STATUS BASED ON PICKUP DATE AND DRIVERS AVAILABILITY
      const getAspMechanicWorkStatus = await axios.post(
        `${caseServiceUrl}/${endpoint.case.getAspMechanicWorkStatus}`,
        {
          aspMechanicId: aspMechanic.dataValues.id,
          serviceScheduledDate: moment
            .tz(serviceScheduledDate, "Asia/Kolkata")
            .format("YYYY-MM-DD"),
        }
      );
      //COCO
      if (aspMechanic.dataValues.aspTypeId == 771) {
        //IF CASE IS INPROGRESS THEN "BUSY"
        //IF THERE IS NO CASE THEN CHECK THE WORK STATUS UPDATED OTHERWISE STATUS WILL BE "OFFLINE"
        if (
          getAspMechanicWorkStatus.data.success &&
          !getAspMechanicWorkStatus.data.data.aspMechanicAvailable
        ) {
          return 13; //BUSY
        } else if (!aspMechanic.dataValues.workStatusId) {
          return 11; //OFFLINE
        } else {
          return aspMechanic.dataValues.workStatusId;
        }
      } else {
        //THIRD PARTY
        return getAspMechanicWorkStatus.data.success &&
          getAspMechanicWorkStatus.data.data.aspMechanicAvailable
          ? 12 //AVAILABLE
          : 13; //BUSY
      }
    } else {
      return aspMechanic.dataValues.workStatusId
        ? aspMechanic.dataValues.workStatusId
        : 11;
    }
  } catch (error: any) {
    throw error;
  }
};

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
      aspMechanicId: "numeric",
      aspTypeId: "required|numeric",
      aspId: "numeric",
      locationCapturedViaId: "numeric",
      dynamicTypeId: "numeric",
      cocoVehicleId: "numeric",
      latitude: "string|maxLength:60",
      longitude: "string|maxLength:60",
      name: "required|string|minLength:3|maxLength:255",
      code: "required|string|minLength:3|maxLength:60",
      email: "email",
      contactNumber: "required|string|minLength:10|maxLength:10",
      alternateContactNumber: "string|minLength:10|maxLength:10",
      performanceId: "required|numeric",
      priorityId: "required|numeric",
      address: "required|string",
      cityId: "required|numeric",
      // subServiceIds: "required|array",
      // "subServiceIds.*": "required",
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
        };
      } else {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }
    }

    //If asp type third party then asp is mandatory.
    if (payload.aspTypeId == 772 && !payload.aspId) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "ASP not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "ASP is required",
        });
      }
    }

    //If asp type coco then location capture via is mandatory.
    if (payload.aspTypeId == 771 && !payload.locationCapturedViaId) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Location capture via is not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Location capture via is required",
        });
      }
    }

    //If location capture via dynamic then dynamic type is mandatory.
    if (payload.locationCapturedViaId == 782 && !payload.dynamicTypeId) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Dynamic type is not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Dynamic type is required",
        });
      }
    }

    //If asp type coco then latitude is mandatory.
    if (payload.aspTypeId == 771 && !payload.latitude) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Latitude is not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Latitude is required",
        });
      }
    }

    //If asp type coco then longitude is mandatory.
    if (payload.aspTypeId == 771 && !payload.longitude) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Longitude is not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Longitude is required",
        });
      }
    }

    //If asp type coco then coco vehicle is mandatory.
    if (payload.aspTypeId == 771 && !payload.cocoVehicleId) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "COCO vehicle is not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle is required",
        });
      }
    }

    //Validate COCO vehicle exists if provided
    if (payload.cocoVehicleId) {
      const cocoVehicle = await OwnPatrolVehicle.findOne({
        attributes: ["id"],
        where: {
          id: payload.cocoVehicleId,
        },
        paranoid: false,
      });
      if (!cocoVehicle) {
        await transaction.rollback();
        if (importData !== undefined) {
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
    }

    if (payload.aspId) {
      const asp = await Asp.findOne({
        attributes: ["id"],
        where: {
          id: payload.aspId,
        },
      });
      if (!asp) {
        await transaction.rollback();
        if (importData !== undefined) {
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
    }

    const [
      aspType,
      performance,
      priority,
      city,
      getAspMechanicRoleDetail,
    ]: any = await Promise.all([
      Config.findOne({
        attributes: ["id"],
        where: {
          id: payload.aspTypeId,
          typeId: 57, //ASP Types
        },
      }),
      Config.findOne({
        attributes: ["id"],
        where: {
          id: payload.performanceId,
          typeId: 24, //ASP Performance
        },
      }),
      Config.findOne({
        attributes: ["id"],
        where: {
          id: payload.priorityId,
          typeId: 25, //ASP Priority
        },
      }),
      City.findOne({
        attributes: ["id"],
        where: {
          id: payload.cityId,
        },
      }),
      //GET ASP MECHANIC ROLE DETAIL
      axios.get(
        `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=ASP Mechanic`
      ),
    ]);

    if (!aspType) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "ASP type not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "ASP type not found",
        });
      }
    }

    if (!performance) {
      await transaction.rollback();

      if (importData !== undefined) {
        return {
          success: false,
          error: "Performance not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Performance not found",
        });
      }
    }

    if (!priority) {
      await transaction.rollback();

      if (importData !== undefined) {
        return {
          success: false,
          error: "Priority not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Priority not found",
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
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "City not found",
        });
      }
    }

    if (!getAspMechanicRoleDetail.data.success) {
      await transaction.rollback();

      if (importData !== undefined) {
        return {
          ...getAspMechanicRoleDetail.data,
          data: payload,
        };
      } else {
        return res.status(200).json(getAspMechanicRoleDetail.data);
      }
    }

    if (payload.locationCapturedViaId) {
      const locationCapturedVia = await Config.findOne({
        attributes: ["id"],
        where: {
          id: payload.locationCapturedViaId,
          typeId: 58, //Location Capture Via Types
        },
      });
      if (!locationCapturedVia) {
        await transaction.rollback();

        if (importData !== undefined) {
          return {
            success: false,
            error: "Location captured via not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Location captured via not found",
          });
        }
      }
    }

    if (payload.dynamicTypeId) {
      const dynamicType = await Config.findOne({
        attributes: ["id"],
        where: {
          id: payload.dynamicTypeId,
          typeId: 59, //Dynamic Types
        },
      });
      if (!dynamicType) {
        await transaction.rollback();

        if (importData !== undefined) {
          return {
            success: false,
            error: "Dynamic type not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "Dynamic type not found",
          });
        }
      }
    }

    if (
      !payload.subServiceIds ||
      (payload.subServiceIds && payload.subServiceIds.length == 0)
    ) {
      await transaction.rollback();
      if (importData) {
        return {
          success: false,
          error: "Sub services not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Sub services not found",
        });
      }
    }

    const aspMechanicRoleId = getAspMechanicRoleDetail.data.data.id;

    let existingAspMechanicData = null;
    if (payload.aspMechanicId) {
      //UPDATE
      const aspMechanic = await AspMechanic.findOne({
        attributes: ["id", "aspTypeId"],
        where: {
          id: payload.aspMechanicId,
        },
        paranoid: false,
      });
      if (!aspMechanic) {
        await transaction.rollback();

        if (importData !== undefined) {
          return {
            success: false,
            error: "ASP mechanic not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "ASP mechanic not found",
          });
        }
      }

      let aspMechanicAlreadyExists = await AspMechanic.findOne({
        where: {
          code: payload.code,
          id: {
            [Op.ne]: payload.aspMechanicId,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (aspMechanicAlreadyExists) {
        await transaction.rollback();

        if (importData !== undefined) {
          return {
            success: false,
            error: "ASP mechanic code is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "ASP mechanic code is already taken",
          });
        }
      }
      existingAspMechanicData = aspMechanic;
    } else {
      //ADD
      let aspMechanicAlreadyExists = await AspMechanic.findOne({
        where: {
          code: payload.code,
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (aspMechanicAlreadyExists) {
        await transaction.rollback();

        if (importData !== undefined) {
          return {
            success: false,
            error: "ASP mechanic code is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "ASP mechanic code is already taken",
          });
        }
      }
    }

    //INACTIVE IS NOT POSSIBLE IF EXISTING TYPE IS COCO AND TECHNICIAN IS ON SHIFT
    if (
      payload.aspMechanicId &&
      existingAspMechanicData &&
      existingAspMechanicData.dataValues.aspTypeId == 771 &&
      payload.status == 0
    ) {
      const cocoAspMechanicInShift: any = await AspMechanic.findOne({
        where: {
          id: payload.aspMechanicId,
          aspId: {
            [Op.not]: null,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (cocoAspMechanicInShift) {
        await transaction.rollback();

        if (importData !== undefined) {
          return {
            success: false,
            error:
              "It’s not possible to inactive the technician at the moment because the technician is on shift",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error:
              "It’s not possible to inactive the technician at the moment because the technician is on shift",
          });
        }
      }
    }

    //CHANGE ASP TYPE IS NOT POSSIBLE IF EXISTING TYPE IS COCO AND CURRENT IS THIRD PARY AND TECHNICIAN IS ON SHIFT
    if (
      payload.aspMechanicId &&
      existingAspMechanicData &&
      existingAspMechanicData.dataValues.aspTypeId == 771 &&
      payload.aspTypeId == 772
    ) {
      const cocoAspMechanicInShift: any = await AspMechanic.findOne({
        where: {
          id: payload.aspMechanicId,
          aspId: {
            [Op.not]: null,
          },
        },
        attributes: ["id"],
        paranoid: false,
      });
      if (cocoAspMechanicInShift) {
        await transaction.rollback();

        if (importData !== undefined) {
          return {
            success: false,
            error:
              "It’s not possible to change 'ASP Type' status at the moment because the technician is on shift",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error:
              "It’s not possible to change 'ASP Type' status at the moment because the technician is on shift",
          });
        }
      }
    }

    let deletedAt = null;
    let deletedById = null;
    //INACTIVE
    if (payload.status == 0) {
      deletedAt = new Date();
      deletedById = payload.authUserId;
    }

    const aspMechanicData: any = {
      aspTypeId: payload.aspTypeId,
      locationCapturedViaId: payload.locationCapturedViaId
        ? payload.locationCapturedViaId
        : null,
      dynamicTypeId: payload.dynamicTypeId ? payload.dynamicTypeId : null,
      aspId: payload.aspId ? payload.aspId : null,
      cocoVehicleId: payload.cocoVehicleId ? payload.cocoVehicleId : null,
      name: payload.name,
      code: payload.code,
      email: payload.email ? payload.email : null,
      contactNumber: payload.contactNumber,
      alternateContactNumber: payload.alternateContactNumber
        ? payload.alternateContactNumber
        : null,
      performanceId: payload.performanceId,
      priorityId: payload.priorityId,
      address: payload.address,
      cityId: payload.cityId,
      latitude: payload.latitude ? payload.latitude : null,
      longitude: payload.longitude ? payload.longitude : null,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    if (payload.createdById) {
      aspMechanicData.createdById = payload.createdById;
    }
    if (payload.updatedById) {
      aspMechanicData.updatedById = payload.updatedById;
    }

    let userEntityId: number;
    let savedAspMechanicId: number;
    let userCreatedByOrUpdatedById: any;
    let message = null;
    if (payload.aspMechanicId) {
      //UPDATE
      await AspMechanic.update(aspMechanicData, {
        where: {
          id: payload.aspMechanicId,
        },
        paranoid: false,
        transaction: transaction,
      });
      userEntityId = payload.aspMechanicId;
      savedAspMechanicId = payload.aspMechanicId;
      userCreatedByOrUpdatedById = {
        updatedById: payload.authUserId,
      };
      message = "ASP mechanic updated successfully";
    } else {
      //ADD
      const newAspMechanic = await AspMechanic.create(aspMechanicData, {
        transaction: transaction,
      });

      userEntityId = newAspMechanic.dataValues.id;
      savedAspMechanicId = newAspMechanic.dataValues.id;
      userCreatedByOrUpdatedById = {
        createdById: payload.authUserId,
      };
      message = "ASP mechanic created successfully";
    }

    //PROCESS ASP MECHANIC SUB SERVICES
    if (payload.subServiceIds.length > 0) {
      await AspMechanicSubService.destroy({
        where: {
          aspMechanicId: savedAspMechanicId,
        },
        force: true,
        transaction: transaction,
      });

      if (importData) {
        for (const subServiceName of payload.subServiceNames) {
          const subServiceNameExist = await SubService.findOne({
            where: {
              name: subServiceName,
            },
            paranoid: false,
          });
          if (!subServiceNameExist) {
            await transaction.rollback();
            return {
              success: false,
              error: `Sub service ${subServiceName} not found`,
              data: payload,
            };
          }
        }
      }

      const aspMechanicSubServiceData = payload.subServiceIds.map(
        (subServiceId: number) => ({
          aspMechanicId: savedAspMechanicId,
          subServiceId: subServiceId,
        })
      );
      await AspMechanicSubService.bulkCreate(aspMechanicSubServiceData, {
        transaction,
      });
    }

    const aspMechanicUserData = {
      userId: payload.userId,
      roleId: aspMechanicRoleId,
      userTypeId: 143, //ASP MECHANIC
      entityId: userEntityId,
      code: payload.code,
      name: payload.name,
      mobileNumber: payload.contactNumber,
      email: payload.email,
      userName: payload.userName,
      password: payload.password,
      ignorePasswordPattern: 1,
      address: payload.address,
      changePassword: payload.changePassword,
      status: payload.status,
      deletedById: deletedById,
      ...userCreatedByOrUpdatedById,
    };

    //SAVE USER ENTITY
    const saveAspMechanicUserEntity = await axios.post(
      `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
      aspMechanicUserData
    );
    if (!saveAspMechanicUserEntity.data.success) {
      await transaction.rollback();
      // return res.status(200).json(saveAspMechanicUserEntity.data);

      if (importData !== undefined) {
        return {
          ...saveAspMechanicUserEntity.data,
          data: payload,
        };
      } else {
        return res.status(200).json(saveAspMechanicUserEntity.data);
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
      };
    } else {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
export default new AspMechanicController();
