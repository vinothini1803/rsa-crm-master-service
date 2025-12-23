import { City, OwnPatrolVehicleHelper, State } from "../database/models/index";
import { Op, Sequelize } from "sequelize";
import axios from "axios";
import config from "../config/config.json";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import {
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class OwnPatrolVehicleHelperController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, cityId, apiType, status } = req.query;
      const where: any = {};
      if (cityId) {
        where.cityId = cityId;
      }

      let ownPatrolVehicleHelpers: any;
      //DROPDOWN API
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
          ];
        }

        ownPatrolVehicleHelpers = await OwnPatrolVehicleHelper.findAll({
          where,
          attributes: ["id", "name", "code"],
          order: [["id", "asc"]],
        });
        if (ownPatrolVehicleHelpers.length === 0) {
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
            { code: { [Op.like]: `%${search}%` } },
            { name: { [Op.like]: `%${search}%` } },
            { mobileNumber: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            Sequelize.literal(`city.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (ownPatrolVehicleHelper.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = OwnPatrolVehicleHelperController.defaultLimit;
        if (limit) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number =
          OwnPatrolVehicleHelperController.defaultOffset;
        if (offset) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        ownPatrolVehicleHelpers = await OwnPatrolVehicleHelper.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            "code",
            "mobileNumber",
            "email",
            "address",
            [Sequelize.literal("(SELECT city.name)"), "cityName"],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(ownPatrolVehicleHelper.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (ownPatrolVehicleHelper.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: City,
              as: "city",
              required: false,
              attributes: ["id", "name"],
              paranoid: false,
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });
        if (ownPatrolVehicleHelpers.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: ownPatrolVehicleHelpers,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getFormData = async (req: any, res: any) => {
    try {
      const { ownPatrolVehicleHelperId } = req.query;
      let ownPatrolVehicleHelperData = null;
      let userData = null;

      if (ownPatrolVehicleHelperId) {
        const ownPatrolVehicleHelperExists: any =
          await OwnPatrolVehicleHelper.findOne({
            attributes: {
              exclude: [
                "createdById",
                "updatedById",
                "deletedById",
                "createdAt",
                "updatedAt",
              ],
            },
            where: {
              id: ownPatrolVehicleHelperId,
            },
            include: {
              model: City,
              as: "city",
              attributes: ["id", "stateId", "name"],
              required: false,
              paranoid: false,
            },
            paranoid: false,
          });

        if (!ownPatrolVehicleHelperExists) {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle helper not found",
          });
        }

        //GET USER DETAILS
        const getEntityUser: any = await axios.get(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=144&entityId=${ownPatrolVehicleHelperId}`
        );
        if (!getEntityUser.data.success) {
          return res.status(200).json({
            success: false,
            error: getEntityUser.data.error,
          });
        }

        ownPatrolVehicleHelperData = ownPatrolVehicleHelperExists;
        userData = getEntityUser.data.data;
      }

      //EXTRAS
      const states = await State.findAll({
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

      let ownPatrolVehicleHelper = null;
      if (ownPatrolVehicleHelperData) {
        ownPatrolVehicleHelper = {
          ...ownPatrolVehicleHelperData.dataValues,
          stateId: ownPatrolVehicleHelperData.dataValues.city
            ? ownPatrolVehicleHelperData.dataValues.city.stateId
            : null,
          status: ownPatrolVehicleHelperData.dataValues.deletedAt ? 0 : 1,
          user: user,
        };
      }

      const data = {
        extras: {
          states,
        },
        ownPatrolVehicleHelper: ownPatrolVehicleHelper,
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
  };

  // save = async (req: any, res: any) => {
  //   const transaction = await sequelize.transaction();
  //   try {
  //     const payload = req.body;
  //     const v = {
  //       ownPatrolVehicleHelperId: "numeric",
  //       code: "required|string|maxLength:60",
  //       name: "required|string|minLength:3|maxLength:191",
  //       email: "email",
  //       mobileNumber: "required|string|minLength:10|maxLength:10",
  //       address: "required|string",
  //       stateId: "required|numeric",
  //       cityId: "required|numeric",
  //       userId: "numeric",
  //       userName: "required|string|minLength:3|maxLength:255",
  //       password: "string",
  //       changePassword: "numeric",
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
  //     const { ownPatrolVehicleHelperId, ...inputData } = payload;

  //     //CUSTOM VALIDATIONS
  //     const [state, city, getRoleDetail]: any = await Promise.all([
  //       State.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: inputData.stateId,
  //         },
  //       }),
  //       City.findOne({
  //         attributes: ["id"],
  //         where: {
  //           id: inputData.cityId,
  //         },
  //       }),
  //       //GET ROLE DETAILS
  //       axios.get(
  //         `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=Own Patrol Vehicle Helper`
  //       ),
  //     ]);
  //     if (!state) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "State not found",
  //       });
  //     }

  //     if (!city) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: "City not found",
  //       });
  //     }

  //     if (!getRoleDetail.data.success) {
  //       await transaction.rollback();
  //       return res.status(200).json({
  //         success: false,
  //         error: getRoleDetail.data.error,
  //       });
  //     }
  //     const roleId = getRoleDetail.data.data.id;

  //     if (ownPatrolVehicleHelperId) {
  //       const ownPatrolVehicleHelper = await OwnPatrolVehicleHelper.findOne({
  //         attributes: ["id", "ownPatrolVehicleId"],
  //         where: {
  //           id: ownPatrolVehicleHelperId,
  //         },
  //         paranoid: false,
  //       });
  //       if (!ownPatrolVehicleHelper) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "COCO vehicle helper not found",
  //         });
  //       }

  //       const ownPatrolVehicleHelperAlreadyExists =
  //         await OwnPatrolVehicleHelper.findOne({
  //           where: {
  //             code: inputData.code,
  //             id: {
  //               [Op.ne]: ownPatrolVehicleHelperId,
  //             },
  //           },
  //           attributes: ["id"],
  //           paranoid: false,
  //         });
  //       if (ownPatrolVehicleHelperAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "COCO vehicle helper code is already taken",
  //         });
  //       }

  //       //IF COCO VEHICLE HELPER IS ON SHIFT THEN INACTIVE IS NOT POSSIBLE.
  //       if (
  //         ownPatrolVehicleHelper.dataValues.ownPatrolVehicleId &&
  //         inputData.status == 0
  //       ) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: `It’s not possible to inactive the COCO vehicle helper at the moment because the helper is on shift`,
  //         });
  //       }
  //     } else {
  //       const ownPatrolVehicleHelperAlreadyExists =
  //         await OwnPatrolVehicleHelper.findOne({
  //           where: {
  //             code: inputData.code,
  //           },
  //           attributes: ["id"],
  //           paranoid: false,
  //         });
  //       if (ownPatrolVehicleHelperAlreadyExists) {
  //         await transaction.rollback();
  //         return res.status(200).json({
  //           success: false,
  //           error: "COCO vehicle helper code is already taken",
  //         });
  //       }
  //     }

  //     let deletedAt = null;
  //     let deletedById = null;
  //     //INACTIVE
  //     if (inputData.status == 0) {
  //       deletedAt = new Date();
  //       deletedById = inputData.authUserId;
  //     }

  //     const data: any = {
  //       code: inputData.code,
  //       name: inputData.name,
  //       email: inputData.email ? inputData.email : null,
  //       mobileNumber: inputData.mobileNumber,
  //       address: inputData.address,
  //       cityId: inputData.cityId,
  //       deletedById: deletedById,
  //       deletedAt: deletedAt,
  //     };

  //     let userEntityId: number;
  //     let userCreatedByOrUpdatedById: any;
  //     if (ownPatrolVehicleHelperId) {
  //       data.updatedById = inputData.updatedById;
  //       await OwnPatrolVehicleHelper.update(data, {
  //         where: {
  //           id: ownPatrolVehicleHelperId,
  //         },
  //         paranoid: false,
  //         transaction: transaction,
  //       });
  //       userEntityId = ownPatrolVehicleHelperId;
  //       userCreatedByOrUpdatedById = {
  //         updatedById: inputData.updatedById,
  //       };
  //     } else {
  //       data.createdById = inputData.createdById;
  //       const newOwnPatrolVehicleHelper = await OwnPatrolVehicleHelper.create(
  //         data,
  //         {
  //           transaction: transaction,
  //         }
  //       );
  //       userEntityId = newOwnPatrolVehicleHelper.dataValues.id;
  //       userCreatedByOrUpdatedById = {
  //         createdById: inputData.createdById,
  //       };
  //     }

  //     const userData = {
  //       userId: inputData.userId,
  //       roleId: roleId,
  //       userTypeId: 144, //OWN PATROL VEHICLE HELPER
  //       entityId: userEntityId,
  //       code: inputData.code,
  //       name: inputData.name,
  //       mobileNumber: inputData.mobileNumber,
  //       email: inputData.email ? inputData.email : null,
  //       userName: inputData.userName,
  //       password: inputData.password,
  //       address: inputData.address,
  //       changePassword: inputData.changePassword,
  //       status: inputData.status,
  //       deletedById: deletedById,
  //       ...userCreatedByOrUpdatedById,
  //     };

  //     //SAVE USER ENTITY
  //     const saveUserEntity = await axios.post(
  //       `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
  //       userData
  //     );
  //     if (!saveUserEntity.data.success) {
  //       await transaction.rollback();
  //       return res.status(200).json(saveUserEntity.data);
  //     }

  //     await transaction.commit();
  //     return res.status(200).json({
  //       success: true,
  //       message: "COCO vehicle helper saved successfully",
  //     });
  //   } catch (error: any) {
  //     await transaction.rollback();
  //     return res.status(500).json({
  //       success: false,
  //       error: error?.message,
  //     });
  //   }
  // };

  updateStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        status: "required|numeric",
        ownPatrolVehicleHelperIds: "required|array",
        "ownPatrolVehicleHelperIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { ownPatrolVehicleHelperIds, status, updatedById, deletedById } =
        payload;
      if (ownPatrolVehicleHelperIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one COCO vehicle helper",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const ownPatrolVehicleHelperId of ownPatrolVehicleHelperIds) {
        const ownPatrolVehicleHelperExists =
          await OwnPatrolVehicleHelper.findOne({
            attributes: ["id", "ownPatrolVehicleId"],
            where: {
              id: ownPatrolVehicleHelperId,
            },
            paranoid: false,
          });
        if (!ownPatrolVehicleHelperExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `COCO vehicle helper (${ownPatrolVehicleHelperId}) not found`,
          });
        }

        //IF COCO VEHICLE HELPER IS ON SHIFT THEN INACTIVE IS NOT POSSIBLE.
        if (
          ownPatrolVehicleHelperExists.dataValues.ownPatrolVehicleId &&
          status == 0
        ) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `COCO vehicle helper (${ownPatrolVehicleHelperId}) It’s not possible to inactive the helper at the moment because the helper is on shift`,
          });
        }

        await OwnPatrolVehicleHelper.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: ownPatrolVehicleHelperId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      //GET USER DETAILS
      const getAllEntityUsers: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
        {
          userTypeId: 144, //OWN PATROL VEHICLE HELPER
          entityIds: ownPatrolVehicleHelperIds,
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

      //UPDATE STATUS IN USER
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
        message: "COCO vehicle helper status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  delete = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        ownPatrolVehicleHelperIds: "required|array",
        "ownPatrolVehicleHelperIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { ownPatrolVehicleHelperIds } = payload;
      if (ownPatrolVehicleHelperIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select at least one COCO vehicle helper",
        });
      }

      for (const ownPatrolVehicleHelperId of ownPatrolVehicleHelperIds) {
        const ownPatrolVehicleHelperExists =
          await OwnPatrolVehicleHelper.findOne({
            attributes: ["id", "ownPatrolVehicleId"],
            where: {
              id: ownPatrolVehicleHelperId,
            },
            paranoid: false,
          });
        if (!ownPatrolVehicleHelperExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `COCO vehicle helper (${ownPatrolVehicleHelperId}) not found`,
          });
        }

        //IF COCO VEHICLE HELPER IS ON SHIFT THEN DELETE IS NOT POSSIBLE.
        if (ownPatrolVehicleHelperExists.dataValues.ownPatrolVehicleId) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `COCO vehicle helper (${ownPatrolVehicleHelperId}), It’s not possible to delete the helper at the moment because the helper is on shift`,
          });
        }

        await OwnPatrolVehicleHelper.destroy({
          where: {
            id: ownPatrolVehicleHelperId,
          },
          force: true,
          transaction: transaction,
        });
      }

      //GET USER DETAILS
      const getAllEntityUsers: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getAllEntityUsers}`,
        {
          userTypeId: 144, //OWN PATROL VEHICLE HELPER
          entityIds: ownPatrolVehicleHelperIds,
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

      //DELETE IN USERS
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
        message: "COCO vehicle helper deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getViewData = async (req: any, res: any) => {
    try {
      const { ownPatrolVehicleHelperId } = req.query;
      if (!ownPatrolVehicleHelperId) {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle helper ID is required",
        });
      }
      const [ownPatrolVehicleHelper, getEntityUser]: any = await Promise.all([
        OwnPatrolVehicleHelper.findOne({
          attributes: {
            exclude: ["createdById", "updatedById", "deletedById"],
          },
          where: {
            id: ownPatrolVehicleHelperId,
          },
          paranoid: false,
        }),
        //GET USER DETAILS
        axios.get(
          `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=144&entityId=${ownPatrolVehicleHelperId}`
        ),
      ]);
      if (!ownPatrolVehicleHelper) {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle helper not found",
        });
      }

      if (!getEntityUser.data.success) {
        return res.status(200).json({
          success: false,
          error: getEntityUser.data.error,
        });
      }

      const city: any = await City.findOne({
        attributes: ["id", "name"],
        where: {
          id: ownPatrolVehicleHelper.dataValues.cityId,
        },
        include: {
          model: State,
          as: "state",
          attributes: ["id", "name"],
          paranoid: false,
        },
        paranoid: false,
      });

      const user = {
        id: getEntityUser.data.data.id,
        roleId: getEntityUser.data.data.roleId,
        userName: getEntityUser.data.data.userName,
      };

      const data = {
        ...ownPatrolVehicleHelper.dataValues,
        state: city && city.state ? city.state.dataValues.name : null,
        city: city ? city.dataValues.name : null,
        user,
        status: ownPatrolVehicleHelper.dataValues.deletedAt
          ? "Inactive"
          : "Active",
      };

      return res.status(200).json({
        success: true,
        message: "COCO vehicle helper data fetch successfully",
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getById = async (req: any, res: any) => {
    try {
      const { id } = req.query;
      const ownPatrolVehicleHelper = await OwnPatrolVehicleHelper.findOne({
        attributes: ["id", "code", "name", "email", "mobileNumber", "address"],
        where: {
          id: id,
        },
      });
      if (!ownPatrolVehicleHelper) {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle helper not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: ownPatrolVehicleHelper,
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
      const cocoVehicleHelperErrorData: any[] = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;

      // let importColumns = [
      //   "Code",
      //   "Name",
      //   "Email",
      //   "Mobile Number",
      //   "Address",
      //   "State Name",
      //   "City Name",
      //   "Username",
      //   "Password",
      //   "Change Password",
      //   "Status",
      // ];

      const importColumnsResponse = await Utils.getExcelImportColumns(1097);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1097,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      const cocoVehicleHelperSheets = Object.values(inData)[0]
        ? Object.values(inData)[0]["data"]
        : [];

      for (const cocoVehicleHelperSheet of cocoVehicleHelperSheets) {
        importColumns.forEach((importColumn: any) => {
          if (!cocoVehicleHelperSheet.hasOwnProperty(importColumn)) {
            cocoVehicleHelperSheet[importColumn] = "";
          }
        });

        let reArrangedCocoVehicleHelpers: any = {
          Code: cocoVehicleHelperSheet["Code"]
            ? String(cocoVehicleHelperSheet["Code"])
            : null,
          Name: cocoVehicleHelperSheet["Name"]
            ? String(cocoVehicleHelperSheet["Name"])
            : null,
          Email: cocoVehicleHelperSheet["Email"]
            ? String(cocoVehicleHelperSheet["Email"])
            : null,
          "Mobile Number": cocoVehicleHelperSheet["Mobile Number"]
            ? String(cocoVehicleHelperSheet["Mobile Number"])
            : null,
          Address: cocoVehicleHelperSheet["Address"]
            ? String(cocoVehicleHelperSheet["Address"])
            : null,
          "State Name": cocoVehicleHelperSheet["State Name"]
            ? String(cocoVehicleHelperSheet["State Name"])
            : null,
          "City Name": cocoVehicleHelperSheet["City Name"]
            ? String(cocoVehicleHelperSheet["City Name"])
            : null,
          Username: cocoVehicleHelperSheet["Username"]
            ? String(cocoVehicleHelperSheet["Username"])
            : null,
          Password: cocoVehicleHelperSheet["Password"]
            ? String(cocoVehicleHelperSheet["Password"])
            : null,
          "Change Password": cocoVehicleHelperSheet["Change Password"]
            ? String(cocoVehicleHelperSheet["Change Password"])
            : null,
          Status: cocoVehicleHelperSheet["Status"]
            ? String(cocoVehicleHelperSheet["Status"])
            : null,
        };

        if (cocoVehicleHelperSheet["Code"]) {
          const record: any = {};
          const keyMapping: any = {
            stateName: "stateId",
            cityName: "cityId",
            username: "userName",
          };

          for (const key in reArrangedCocoVehicleHelpers) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            // Check if key has a mapping, use the mapping if available
            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedCocoVehicleHelpers[key];
          }

          const validationErrors = [];
          if (record.mobileNumber && !/^[0-9]{10}$/.test(record.mobileNumber)) {
            validationErrors.push("Invalid mobile number.");
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
            cocoVehicleHelperErrorData.push({
              ...reArrangedCocoVehicleHelpers,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //COCO VEHICLE HELPER
          let cocoVehicleHelperId = null;
          let userId = null;
          if (record.code) {
            const trimmedCode = record.code.trim();
            const cocoVehicleHelperAlreadyExists =
              await OwnPatrolVehicleHelper.findOne({
                where: {
                  code: trimmedCode,
                },
                attributes: ["id"],
                paranoid: false,
              });
            if (cocoVehicleHelperAlreadyExists) {
              cocoVehicleHelperId =
                cocoVehicleHelperAlreadyExists.dataValues.id;

              //USER
              const getCocoVehicleHelperUser: any = await axios.get(
                `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=144&entityId=${cocoVehicleHelperId}`
              );
              if (getCocoVehicleHelperUser.data.success) {
                userId = getCocoVehicleHelperUser.data.data.id;
              }
            }
          }

          //STATE
          let stateId = 0;
          if (record.stateId) {
            const trimmedStateName = record.stateId.trim();
            const state = await State.findOne({
              attributes: ["id", "name"],
              where: { name: trimmedStateName },
              paranoid: false,
            });
            if (state) {
              stateId = state.dataValues.id;
            }
          }

          //CITY
          let cityId = 0;
          if (stateId && record.cityId) {
            const trimmedCityName = record.cityId.trim();
            const city = await City.findOne({
              attributes: ["id", "name"],
              where: {
                name: trimmedCityName,
                stateId: stateId,
              },
              paranoid: false,
            });
            if (city) {
              cityId = city.dataValues.id;
            }
          }

          record.ownPatrolVehicleHelperId = cocoVehicleHelperId;
          record.userId = userId;
          record.stateId = stateId;
          record.cityId = cityId;
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
            cocoVehicleHelperErrorData.push({
              ...reArrangedCocoVehicleHelpers,
              Error: output.errors ? output.errors.join(",") : output.error,
            });
          } else {
            if (output.message === "COCO vehicle helper created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        } else {
          cocoVehicleHelperErrorData.push({
            ...reArrangedCocoVehicleHelpers,
            Error: "COCO vehicle helper code is mandatory",
          });
        }
      }

      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New COCO vehicle helper created successfully (${newRecordsCreated} records) and existing COCO vehicle helper updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New COCO vehicle helper created successfully (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing COCO vehicle helper updated (${existingRecordsUpdated} records)`
          : "No COCO vehicle helper created or updated";

      if (cocoVehicleHelperErrorData.length === 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Error Buffer Generation;
      importColumns.push("Error");

      const buffer = generateXLSXAndXLSExport(
        cocoVehicleHelperErrorData,
        importColumns,
        "xlsx",
        "CocoVehicleHelperDetails"
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

      const cocoVehicleHelperDetails = await OwnPatrolVehicleHelper.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });
      if (!cocoVehicleHelperDetails || cocoVehicleHelperDetails.length === 0) {
        return res.status(200).json({
          success: false,
          error: startDate && endDate ? "No record found for the selected date range" : "No record found",
        });
      }

      let cocoVehicleHelperDetailsArray: any[] = [];
      const cocoVehicleHelperIds = [
        ...new Set(
          cocoVehicleHelperDetails.map(
            (cocoVehicleHelperData: any) => cocoVehicleHelperData.id
          )
        ),
      ];
      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          cocoVehicleHelperIds: cocoVehicleHelperIds,
        }
      );
      let cocoVehicleHelperUsers = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        cocoVehicleHelperUsers =
          getUserDetails.data.data.cocoVehicleHelperUsers;
      }

      for (const cocoVehicleHelperDetail of cocoVehicleHelperDetails) {
        const city = await City.findOne({
          attributes: ["id", "name"],
          where: { id: cocoVehicleHelperDetail.dataValues.cityId },
          paranoid: false,
        });

        const cocoVehicleHelperUser = cocoVehicleHelperUsers.find(
          (cocoVehicleHelperUser: any) =>
            cocoVehicleHelperUser.entityId ==
            cocoVehicleHelperDetail.dataValues.id
        );

        cocoVehicleHelperDetailsArray.push({
          Code: cocoVehicleHelperDetail.dataValues.code,
          Name: cocoVehicleHelperDetail.dataValues.name,
          Email: cocoVehicleHelperDetail.dataValues.email,
          "Mobile Number": cocoVehicleHelperDetail.dataValues.mobileNumber,
          Address: cocoVehicleHelperDetail.dataValues.address,
          City: city?.dataValues.name || null,
          Username: cocoVehicleHelperUser?.userName || null,
          "Created At": moment
            .tz(cocoVehicleHelperDetail.dataValues.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          Status: cocoVehicleHelperDetail.dataValues.deletedAt
            ? "Inactive"
            : "Active",
        });
      }

      // Column Filter;
      const cocoVehicleHelperColumnNames = cocoVehicleHelperDetailsArray
        ? Object.keys(cocoVehicleHelperDetailsArray[0])
        : [];

      // Buffer File Store Area;
      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          cocoVehicleHelperDetailsArray,
          cocoVehicleHelperColumnNames,
          format,
          "COCO Vehicle Helper Details"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(
          cocoVehicleHelperDetailsArray,
          cocoVehicleHelperColumnNames
        );
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }

      return res.status(200).json({
        success: true,
        message: `COCO vehicle helper data export successfully`,
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
    let payload;
    if (importData) {
      payload = importData;
    } else {
      payload = req.body;
    }

    const v = {
      ownPatrolVehicleHelperId: "numeric",
      code: "required|string|maxLength:60",
      name: "required|string|minLength:3|maxLength:191",
      email: "email",
      mobileNumber: "required|string|minLength:10|maxLength:10",
      address: "required|string",
      stateId: "required|numeric",
      cityId: "required|numeric",
      userId: "numeric",
      userName: "required|string|minLength:3|maxLength:255",
      password: "string",
      changePassword: "numeric",
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
    const { ownPatrolVehicleHelperId, ...inputData } = payload;

    //CUSTOM VALIDATIONS
    const [state, city, getRoleDetail]: any = await Promise.all([
      State.findOne({
        attributes: ["id"],
        where: {
          id: inputData.stateId,
        },
      }),
      City.findOne({
        attributes: ["id"],
        where: {
          id: inputData.cityId,
        },
      }),
      //GET ROLE DETAILS
      axios.get(
        `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByName}?roleName=Own Patrol Vehicle Helper`
      ),
    ]);
    if (!state) {
      await transaction.rollback();

      if (importData) {
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

    if (!city) {
      await transaction.rollback();

      if (importData) {
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

    if (!getRoleDetail.data.success) {
      await transaction.rollback();

      if (importData) {
        return {
          ...getRoleDetail.data,
          data: payload,
        };
      } else {
        return res.status(200).json(getRoleDetail.data);
      }
    }
    const roleId = getRoleDetail.data.data.id;

    if (ownPatrolVehicleHelperId) {
      const ownPatrolVehicleHelper = await OwnPatrolVehicleHelper.findOne({
        attributes: ["id", "ownPatrolVehicleId"],
        where: {
          id: ownPatrolVehicleHelperId,
        },
        paranoid: false,
      });
      if (!ownPatrolVehicleHelper) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "COCO vehicle helper not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle helper not found",
          });
        }
      }

      const ownPatrolVehicleHelperAlreadyExists =
        await OwnPatrolVehicleHelper.findOne({
          where: {
            code: inputData.code,
            id: {
              [Op.ne]: ownPatrolVehicleHelperId,
            },
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (ownPatrolVehicleHelperAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: "COCO vehicle helper code is already taken",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle helper code is already taken",
          });
        }
      }

      //IF COCO VEHICLE HELPER IS ON SHIFT THEN INACTIVE IS NOT POSSIBLE.
      if (
        ownPatrolVehicleHelper.dataValues.ownPatrolVehicleId &&
        inputData.status == 0
      ) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `It’s not possible to inactive the COCO vehicle helper at the moment because the helper is on shift`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `It’s not possible to inactive the COCO vehicle helper at the moment because the helper is on shift`,
          });
        }
      }
    } else {
      const ownPatrolVehicleHelperAlreadyExists =
        await OwnPatrolVehicleHelper.findOne({
          where: {
            code: inputData.code,
          },
          attributes: ["id"],
          paranoid: false,
        });
      if (ownPatrolVehicleHelperAlreadyExists) {
        await transaction.rollback();

        if (importData) {
          return {
            success: false,
            error: `COCO vehicle helper code is already taken`,
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: `COCO vehicle helper code is already taken`,
          });
        }
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
      code: inputData.code,
      name: inputData.name,
      email: inputData.email ? inputData.email : null,
      mobileNumber: inputData.mobileNumber,
      address: inputData.address,
      cityId: inputData.cityId,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let userEntityId: number;
    let userCreatedByOrUpdatedById: any;
    let message = null;
    if (ownPatrolVehicleHelperId) {
      data.updatedById = inputData.updatedById;
      await OwnPatrolVehicleHelper.update(data, {
        where: {
          id: ownPatrolVehicleHelperId,
        },
        paranoid: false,
        transaction: transaction,
      });
      userEntityId = ownPatrolVehicleHelperId;
      userCreatedByOrUpdatedById = {
        updatedById: inputData.updatedById,
      };
      message = "COCO vehicle helper updated successfully";
    } else {
      data.createdById = inputData.createdById;
      const newOwnPatrolVehicleHelper = await OwnPatrolVehicleHelper.create(
        data,
        {
          transaction: transaction,
        }
      );
      userEntityId = newOwnPatrolVehicleHelper.dataValues.id;
      userCreatedByOrUpdatedById = {
        createdById: inputData.createdById,
      };
      message = "COCO vehicle helper created successfully";
    }

    const userData = {
      userId: inputData.userId,
      roleId: roleId,
      userTypeId: 144, //OWN PATROL VEHICLE HELPER
      entityId: userEntityId,
      code: inputData.code,
      name: inputData.name,
      mobileNumber: inputData.mobileNumber,
      email: inputData.email ? inputData.email : null,
      userName: inputData.userName,
      password: inputData.password,
      address: inputData.address,
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

      if (importData) {
        return {
          ...saveUserEntity.data,
          data: payload,
        };
      } else {
        return res.status(200).json(saveUserEntity.data);
      }
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

export default new OwnPatrolVehicleHelperController();
