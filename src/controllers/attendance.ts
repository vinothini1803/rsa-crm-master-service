import {
  Asp,
  AspMechanic,
  AspMechanicSubService,
  AspSubService,
  City,
  Config,
  OwnPatrolVehicle,
  OwnPatrolVehicleHelper,
  Service,
  Shift,
  SubService,
  VehicleType,
  OwnPatrolVehicleTechnicianLogs,
} from "../database/models/index";
import Utils from "../lib/utils";
import sequelize from "../database/connection";
import { Op } from "sequelize";
import axios from "axios";
import { getValidBody } from "../middleware/validation.middleware";
import ownPatrolVehicleHelper from "../database/models/ownPatrolVehicleHelper";

class AttendanceController {
  constructor() { }

  public async formData(req: any, res: any) {
    try {
      const payload = req.body;
      const v = {
        roleId: "required|numeric",
        entityId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const promiseArray = [];

      // Build where clause for shifts based on route origin
      let shiftWhere: any = {};
      if (payload.routeOrigin == "master") {
        shiftWhere = {
          typeId: {
            [Op.in]: [1, 3], // 1 --> VDM / 3 --> BOTH
          },
        };
      } else if (payload.routeOrigin == "buddyApp") {
        shiftWhere = {
          typeId: {
            [Op.in]: [2, 3], // 2 --> RSA / 3 --> BOTH
          },
        };
      }

      promiseArray.push(
        Shift.findAll({
          attributes: ["id", "name", "value"],
          where: shiftWhere,
          order: [["displayOrder", "ASC"]],
        })
      );

      //ASP MECHANIC
      if (payload.roleId == 5) {
        promiseArray.push(getAspMechanicOwnPatrolVehicles(payload.entityId));

        const aspMechanic = await AspMechanic.findOne({
          where: {
            id: payload.entityId,
          },
          attributes: ["id"],
        });
        if (!aspMechanic) {
          return res.status(200).json({
            success: false,
            error: "ASP mechanic not found",
          });
        }
      } else if (payload.roleId == 9) {
        //OWN PATROL VEHICLE HELPER
        promiseArray.push(getHelperOwnPatrolVehicles(payload.entityId));

        const ownPatrolVehicleHelper = await OwnPatrolVehicleHelper.findOne({
          where: {
            id: payload.entityId,
          },
          attributes: ["id"],
        });
        if (!ownPatrolVehicleHelper) {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle helper not found",
          });
        }
      }

      const [shifts, ownPatrolVehicleResponse] = await Promise.all(
        promiseArray
      );
      if (!ownPatrolVehicleResponse.success) {
        return res.status(200).json(ownPatrolVehicleResponse);
      }
      const data = {
        shifts: shifts,
        ...(payload.routeOrigin == "master") ? {
          vehicles: ownPatrolVehicleResponse.data,
        } : {},
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

  public async validateShift(req: any, res: any) {
    try {
      const payload = getValidBody(req);
      //ASP MECHANIC
      if (payload.roleId == 5) {
        const aspMechanic = await AspMechanic.findOne({
          where: { id: payload.entityId },
          attributes: ["id"],
        });
        if (!aspMechanic) {
          return res.status(200).json({
            success: false,
            error: "ASP mechanic not found",
          });
        }
      } else if (payload.roleId == 9) {
        //OWN PATROL VEHICLE HELPER
        const ownPatrolVehicleHelper = await OwnPatrolVehicleHelper.findOne({
          where: { id: payload.entityId },
          attributes: ["id"],
        });
        if (!ownPatrolVehicleHelper) {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle helper not found",
          });
        }
      }

      const [shift, maximumShiftHour]: any = await Promise.all([
        Shift.findOne({
          where: { id: payload.shiftId },
          attributes: ["id"],
        }),
        // MAXIMUM SHIFT HOUR
        Config.findOne({
          where: { id: 761 },
          attributes: ["id", "name"],
        }),
      ]);

      if (!shift) {
        return res.status(200).json({
          success: false,
          error: "Shift not found",
        });
      }

      if (!maximumShiftHour) {
        return res.status(200).json({
          success: false,
          error: "Maximum shift hour not found",
        });
      }

      //OTHER THAN WEEKLY OFF
      if (payload.shiftId != 1) {
        const [asp, vehicle]: any = await Promise.all([
          Asp.findOne({
            where: { id: payload.aspId },
            attributes: ["id"],
          }),
          OwnPatrolVehicle.findOne({
            where: { id: payload.vehicleId },
            attributes: ["id"],
          }),
        ]);

        if (!asp) {
          return res.status(200).json({
            success: false,
            error: "ASP not found",
          });
        }

        if (!vehicle) {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle not found",
          });
        }

        // NOT NEEDED FOR BUDDY APP
        if (payload.routeOrigin != "buddyApp") {
          if (payload.roleId == 5) {
            //ASP MECHANIC
            const checkAspAlreadyAssignedForMechanic = await AspMechanic.findOne({
              where: {
                aspId: payload.aspId,
              },
              attributes: ["id"],
            });
            if (checkAspAlreadyAssignedForMechanic) {
              return res.status(200).json({
                success: false,
                error: "COCO vehicle already assigned to another ASP mechanic",
              });
            }
          } else if (payload.roleId == 9) {
            //OWN PATROL VEHICLE HELPER
            const checkVehicleAlreadyAssignedForHelper =
              await OwnPatrolVehicleHelper.findOne({
                where: {
                  ownPatrolVehicleId: payload.vehicleId,
                },
                attributes: ["id"],
              });
            if (checkVehicleAlreadyAssignedForHelper) {
              return res.status(200).json({
                success: false,
                error: "COCO vehicle already assigned to another helper",
              });
            }
          }
        }
      }

      const data = {
        maximumShiftHourInSeconds: maximumShiftHour.dataValues.name,
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

  // NOT USED
  public async updateMechanicAsp(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        aspMechanicId: "required|numeric",
        aspId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [aspMechanic, asp, checkAspAlreadyAssignedForOtherMechanic]: any =
        await Promise.all([
          AspMechanic.findOne({
            where: { id: payload.aspMechanicId },
            attributes: ["id"],
          }),
          Asp.findOne({
            where: { id: payload.aspId },
            attributes: ["id"],
          }),
          AspMechanic.findOne({
            where: {
              aspId: payload.aspId,
            },
            attributes: ["id"],
          }),
        ]);

      if (!aspMechanic) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP mechanic not found",
        });
      }

      if (!asp) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      if (checkAspAlreadyAssignedForOtherMechanic) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "COCO vehicle already assigned to another ASP mechanic",
        });
      }

      await Promise.all([
        Asp.update(
          {
            lastAspMechanicId: payload.aspMechanicId,
          },
          {
            where: {
              id: payload.aspId,
            },
            transaction: transaction,
          }
        ),
        AspMechanic.update(
          {
            aspId: payload.aspId,
          },
          {
            where: {
              id: payload.aspMechanicId,
            },
            transaction: transaction,
          }
        ),
      ]);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Data saved Successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async updateVehicle(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        roleId: "required|numeric",
        entityId: "required|numeric",
        aspId: "required|numeric",
        vehicleId: "required|numeric",
        isShiftEnded: "required|numeric",
        routeOrigin: "string",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      //ASP MECHANIC
      if (payload.roleId == 5) {
        const aspMechanic = await AspMechanic.findOne({
          where: { id: payload.entityId },
          attributes: ["id"],
        });
        if (!aspMechanic) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "ASP mechanic not found",
          });
        }
      } else if (payload.roleId == 9) {
        //OWN PATROL VEHICLE HELPER
        const ownPatrolVehicleHelper = await OwnPatrolVehicleHelper.findOne({
          where: { id: payload.entityId },
          attributes: ["id"],
        });
        if (!ownPatrolVehicleHelper) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "COCO vehicle helper not found",
          });
        }
      }

      const [asp, ownPatrolVehicle]: any = await Promise.all([
        Asp.findOne({
          where: { id: payload.aspId },
          attributes: ["id"],
        }),
        OwnPatrolVehicle.findOne({
          where: { id: payload.vehicleId },
          attributes: ["id"],
        }),
      ]);

      if (!asp) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      if (!ownPatrolVehicle) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "COCO vehicle not found",
        });
      }

      const updatePromises: any = [];
      //ASP MECHANIC
      if (payload.roleId == 5) {
        if (payload.isShiftEnded == 0) {
          // NOT NEEDED FOR BUDDY APP
          if (payload.routeOrigin != "buddyApp") {
            const checkAspAlreadyAssignedForOtherMechanic =
              await AspMechanic.findOne({
                where: {
                  aspId: payload.aspId,
                },
                attributes: ["id"],
              });
            if (checkAspAlreadyAssignedForOtherMechanic) {
              await transaction.rollback();
              return res.status(200).json({
                success: false,
                error: "COCO vehicle already assigned to another ASP mechanic",
              });
            }
          }

          updatePromises.push(
            AspMechanic.update(
              {
                aspId: payload.aspId,
                workStatusId: 12, //AVAILABLE
              },
              {
                where: {
                  id: payload.entityId,
                },
                transaction: transaction,
              }
            )
          );
        }

        const checkOwnPatrolVehicleTechnicianLogExist =
          await OwnPatrolVehicleTechnicianLogs.findOne({
            where: {
              ownPatrolVehicleId: payload.vehicleId,
              aspMechanicId: payload.entityId,
            },
          });

        if (checkOwnPatrolVehicleTechnicianLogExist) {
          updatePromises.push(
            OwnPatrolVehicleTechnicianLogs.update(
              {
                ownPatrolVehicleId: payload.vehicleId,
                aspMechanicId: payload.entityId,
              },
              {
                where: {
                  ownPatrolVehicleId: payload.vehicleId,
                  aspMechanicId: payload.entityId,
                },
                transaction: transaction,
              }
            )
          );
        } else {
          updatePromises.push(
            OwnPatrolVehicleTechnicianLogs.create(
              {
                ownPatrolVehicleId: payload.vehicleId,
                aspMechanicId: payload.entityId,
              },
              {
                transaction: transaction,
              }
            )
          );
        }
      } else if (payload.roleId == 9 && payload.isShiftEnded == 0) {
        //OWN PATROL VEHICLE HELPER
        if (payload.routeOrigin != "buddyApp") {
          // NOT NEEDED FOR BUDDY APP
          const checkVehicleAlreadyAssignedForOtherHelper =
            await OwnPatrolVehicleHelper.findOne({
              where: {
                ownPatrolVehicleId: payload.vehicleId,
              },
              attributes: ["id"],
            });
          if (checkVehicleAlreadyAssignedForOtherHelper) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "COCO vehicle already assigned to another helper",
            });
          }
        }

        updatePromises.push(
          OwnPatrolVehicleHelper.update(
            {
              ownPatrolVehicleId: payload.vehicleId,
            },
            {
              where: {
                id: payload.entityId,
              },
              transaction: transaction,
            }
          )
        );
      }
      await Promise.all(updatePromises);

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Data saved Successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async getOwnPatrolVehicleFn(req: any, res: any) {
    try {
      const payload = req.body;
      const v = {
        roleId: "required|numeric",
        entityId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let ownPatrolVehicleResponse: any;
      //ASP MECHANIC
      if (payload.roleId == 5) {
        ownPatrolVehicleResponse = await getAspMechanicOwnPatrolVehicles(
          payload.entityId
        );

        const aspMechanic = await AspMechanic.findOne({
          where: {
            id: payload.entityId,
          },
          attributes: ["id"],
        });
        if (!aspMechanic) {
          return res.status(200).json({
            success: false,
            error: "ASP mechanic not found",
          });
        }
      } else if (payload.roleId == 9) {
        //OWN PATROL VEHICLE HELPER
        ownPatrolVehicleResponse = await getHelperOwnPatrolVehicles(
          payload.entityId
        );

        const ownPatrolVehicleHelper = await OwnPatrolVehicleHelper.findOne({
          where: {
            id: payload.entityId,
          },
          attributes: ["id"],
        });
        if (!ownPatrolVehicleHelper) {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle helper not found",
          });
        }
      }

      if (!ownPatrolVehicleResponse) {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle not available",
        });
      }

      if (!ownPatrolVehicleResponse.success) {
        return res.status(200).json(ownPatrolVehicleResponse);
      }

      return res.status(200).json({
        success: true,
        data: ownPatrolVehicleResponse.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async getCocoVehicles(req: any, res: any) {
    try {
      const payload = req.body;
      const v = {
        searchKey: "string",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }
      const where: any = {};
      const searchKey = payload.searchKey || "";
      if (searchKey) {
        where[Op.or] = [
          { vehicleRegistrationNumber: { [Op.like]: `%${searchKey}%` } },
        ];
      }

      const cocoVehicles = await OwnPatrolVehicle.findAll({
        where: where,
        attributes: ["id", "vehicleRegistrationNumber", "aspId"],
        include: [
          {
            model: VehicleType,
            as: "vehicleType",
            attributes: ["id", "name"],
            required: true,
          },
        ],
      });

      if (cocoVehicles.length == 0) {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: cocoVehicles,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async validateVehicleChange(req: any, res: any) {
    try {
      const payload = req.body;
      const v = {
        attendanceLogId: "required|numeric",
        vehicleId: "required|numeric",
        reason: "string",
        aspId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [vehicle, asp]: any = await Promise.all([
        OwnPatrolVehicle.findOne({
          where: { id: payload.vehicleId },
          attributes: ["id"],
        }),
        Asp.findOne({
          where: { id: payload.aspId },
          attributes: ["id"],
        }),
      ]);

      if (!vehicle) {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle not found",
        });
      }

      if (!asp) {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "API Validated successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //NOT USED
  public async removeMechanicAsp(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const v = {
        aspMechanicIds: "required|array",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      for (const aspMechanicId of payload.aspMechanicIds) {
        const aspMechanic = await AspMechanic.findOne({
          where: { id: aspMechanicId },
          attributes: ["id"],
        });
        if (!aspMechanic) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: "ASP mechanic not found",
          });
        }

        await AspMechanic.update(
          {
            aspId: null,
          },
          {
            where: {
              id: aspMechanicId,
            },
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Data saved Successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async removeVehicle(req: any, res: any) {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      if (payload.aspMechanicIds && payload.aspMechanicIds.length > 0) {
        for (const aspMechanicId of payload.aspMechanicIds) {
          const aspMechanic = await AspMechanic.findOne({
            where: { id: aspMechanicId },
            attributes: ["id"],
          });
          if (!aspMechanic) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "ASP mechanic not found",
            });
          }

          await AspMechanic.update(
            {
              aspId: null,
              workStatusId: 11, //OFFLINE
            },
            {
              where: {
                id: aspMechanicId,
              },
              transaction: transaction,
            }
          );
        }
      }

      if (
        payload.ownPatrolVehicleHelperIds &&
        payload.ownPatrolVehicleHelperIds.length > 0
      ) {
        for (const ownPatrolVehicleHelperId of payload.ownPatrolVehicleHelperIds) {
          const ownPatrolVehicleHelper = await OwnPatrolVehicleHelper.findOne({
            where: { id: ownPatrolVehicleHelperId },
            attributes: ["id"],
          });
          if (!ownPatrolVehicleHelper) {
            await transaction.rollback();
            return res.status(200).json({
              success: false,
              error: "COCO vehicle helper not found",
            });
          }

          await OwnPatrolVehicleHelper.update(
            {
              ownPatrolVehicleId: null,
            },
            {
              where: {
                id: ownPatrolVehicleHelperId,
              },
              transaction: transaction,
            }
          );
        }
      }

      // Null lastLocationAttendanceLogId for ASPs when ASP mechanic shift ends
      if (payload.vehicleIds && payload.vehicleIds.length > 0) {
        for (const vehicleId of payload.vehicleIds) {
          const vehicle = await OwnPatrolVehicle.findOne({
            where: { id: vehicleId },
            attributes: ["id", "aspId"],
          });
          if (vehicle && vehicle.dataValues.aspId) {
            await Asp.update(
              {
                lastLocationAttendanceLogId: null,
              },
              {
                where: {
                  id: vehicle.dataValues.aspId,
                },
                transaction: transaction,
              }
            );
          }
        }
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Data saved Successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async checkVehicleAlreadyExist(req: any, res: any) {
    try {
      const payload = req.body;
      const v = {
        aspMechanicId: "required|numeric",
        aspId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [aspMechanic, asp, checkAspAlreadyAssignedForOtherMechanic]: any =
        await Promise.all([
          AspMechanic.findOne({
            where: { id: payload.aspMechanicId },
            attributes: ["id"],
          }),
          Asp.findOne({
            where: { id: payload.aspId },
            attributes: ["id"],
          }),
          AspMechanic.findOne({
            where: {
              id: {
                [Op.ne]: payload.aspMechanicId,
              },
              aspId: payload.aspId,
            },
            attributes: ["id"],
          }),
        ]);

      if (!aspMechanic) {
        return res.status(200).json({
          success: false,
          error: "ASP mechanic not found",
        });
      }

      if (!asp) {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      if (checkAspAlreadyAssignedForOtherMechanic) {
        return res.status(200).json({
          success: false,
          error: "COCO vehicle already assigned to another ASP mechanic",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Validated successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async getMasterDetails(req: any, res: any) {
    try {
      const payload = req.body;
      const v = {
        aspMechanicId: "numeric",
        ownPatrolVehicleHelperId: "numeric",
        ownPatrolVehicleId: "numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let aspMechanicData = null;
      if (payload.aspMechanicId) {
        const aspMechanic = await AspMechanic.findOne({
          attributes: ["id", "code", "name", "aspTypeId"],
          where: {
            id: payload.aspMechanicId,
          },
          paranoid: false,
        });
        if (!aspMechanic) {
          return res.status(200).json({
            success: false,
            error: "ASP mechanic not found",
          });
        }
        aspMechanicData = aspMechanic;
      }

      let ownPatrolVehicleData = null;
      if (payload.ownPatrolVehicleId) {
        const ownPatrolVehicle = await OwnPatrolVehicle.findOne({
          attributes: ["id", "vehicleRegistrationNumber"],
          where: {
            id: payload.ownPatrolVehicleId,
          },
          paranoid: false,
          include: {
            model: VehicleType,
            as: "vehicleType",
            attributes: ["id", "name"],
            paranoid: false,
          },
        });
        if (!ownPatrolVehicle) {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle not found",
          });
        }
        ownPatrolVehicleData = ownPatrolVehicle;
      }

      let ownPatrolVehicleHelperData = null;
      if (payload.ownPatrolVehicleHelperId) {
        const ownPatrolVehicleHelper = await OwnPatrolVehicleHelper.findOne({
          attributes: ["id", "code", "name"],
          where: {
            id: payload.ownPatrolVehicleHelperId,
          },
          paranoid: false,
        });
        if (!ownPatrolVehicleHelper) {
          return res.status(200).json({
            success: false,
            error: "COCO vehicle helper not found",
          });
        }
        ownPatrolVehicleHelperData = ownPatrolVehicleHelper;
      }

      const data = {
        aspMechanicData,
        ownPatrolVehicleData,
        ownPatrolVehicleHelperData,
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
}

const getAspMechanicOwnPatrolVehicles: any = async (aspMechanicId: number) => {
  try {
    //GET GIVEN ASP MECHANIC WITH CITY AND SUB SERVICE DETAILS
    const aspMechanic: any = await AspMechanic.findOne({
      attributes: ["id", "cityId"],
      where: {
        id: aspMechanicId,
        aspTypeId: 771, //COCO
      },
      include: [
        {
          model: City,
          as: "city",
          attributes: ["id", "nearestCityId", "districtId"],
          required: true,
        },
        {
          model: AspMechanicSubService,
          as: "aspMechanicSubServices",
          attributes: ["id", "subServiceId"],
          required: true,
          include: [
            {
              model: SubService,
              as: "subService",
              attributes: ["id", "name"],
              required: true,
              include: [
                {
                  model: Service,
                  as: "service",
                  attributes: ["id", "name"],
                  required: true,
                },
              ],
            },
          ],
        },
      ],
    });
    if (!aspMechanic) {
      return {
        success: false,
        error: "ASP mechanic not found",
      };
    }

    // GET COCO ASPs THAT ARE MAPPED WITH COCO MECHANIC
    let mechanicMappedAspIds = await AspMechanic.findAll({
      attributes: ["aspId"],
      where: {
        aspId: {
          [Op.ne]: null,
        },
        aspTypeId: 771, //COCO
      },
      group: ["aspId"],
    }).then((results) => results.map((result: any) => result.aspId));

    //FETCH ASPs BASED ON ASP MECHANIC NEAREST CITY AND DISTRICT
    const cityCondition = {
      nearestCityId: aspMechanic.city.nearestCityId,
    };
    const districtCondition = {
      districtId: aspMechanic.city.districtId,
    };
    const cocoAsps: any = await Asp.findAll({
      attributes: ["id", "code"],
      where: {
        isOwnPatrol: 1,
        id: {
          [Op.notIn]: mechanicMappedAspIds,
        },
      },
      include: [
        {
          model: City,
          attributes: ["id", "name"],
          where: {
            [Op.or]: [cityCondition, districtCondition],
          },
          required: true,
        },
      ],
    });
    if (cocoAsps.length == 0) {
      return {
        success: false,
        error: "COCO vehicle not available",
      };
    }

    const uniqueAsps = Array.from(
      new Map(cocoAsps.map((asp: any) => [asp.id, asp])).values()
    );
    const uniqueAspDetails = uniqueAsps.map((asp: any) => ({
      id: asp.id,
      code: asp.code,
    }));

    const uniqueAspCodes = uniqueAspDetails.map(
      (aspDetail: any) => aspDetail.code
    );
    const serviceNames = aspMechanic.aspMechanicSubServices.map(
      (subServiceDetail: any) => subServiceDetail.subService.service.name
    );
    const subServiceNames = aspMechanic.aspMechanicSubServices.map(
      (subServiceDetail: any) => subServiceDetail.subService.name
    );

    //FETCH ASPS THAT ARE MAPPED WITH SUB SERVICES THAT MECHANIC HAVE (ITS TEMPORARY FUNCTION. NEED TO CHANGE DURING CRM)
    // const subServiceAspResponse = await axios.post(
    //   `${process.env.RSA_BASE_URL}/crm/fetch/subService/asps`,
    //   {
    //     aspCodes: uniqueAspCodes,
    //     serviceNames: serviceNames,
    //     subServiceNames: subServiceNames,
    //   }
    // );

    // if (!subServiceAspResponse.data.success) {
    //   return subServiceAspResponse.data;
    // }

    // const subServiceAsps = subServiceAspResponse.data.subServiceAsps;
    // const filteredAspIds = uniqueAspDetails
    //   .filter((asp) => subServiceAsps.includes(asp.code))
    //   .map((asp) => asp.id);

    //FETCH ASPS THAT ARE MAPPED WITH SUB SERVICES THAT MECHANIC HAVE USING DATABASE MAPPING
    const subServiceIds = aspMechanic.aspMechanicSubServices.map(
      (subServiceDetail: any) => subServiceDetail.subServiceId
    );
    const uniqueAspIds = uniqueAspDetails.map((asp: any) => asp.id);

    const aspSubServices = await AspSubService.findAll({
      attributes: ["aspId"],
      where: {
        subServiceId: {
          [Op.in]: subServiceIds,
        },
        aspId: {
          [Op.in]: uniqueAspIds,
        },
      },
      group: ["aspId"],
    });

    const filteredAspIds = aspSubServices.map(
      (aspSubService: any) => aspSubService.aspId
    );

    if (filteredAspIds.length == 0) {
      return {
        success: false,
        error: "COCO vehicle not available",
      };
    }

    const cocoVehicles = await OwnPatrolVehicle.findAll({
      where: {
        aspId: {
          [Op.in]: filteredAspIds,
        },
      },
      attributes: ["id", "vehicleRegistrationNumber", "aspId"],
      include: [
        {
          model: VehicleType,
          as: "vehicleType",
          attributes: ["id", "name"],
          required: true,
        },
      ],
    });
    if (cocoVehicles.length == 0) {
      return {
        success: false,
        error: "COCO vehicle not available",
      };
    }

    return {
      success: true,
      data: cocoVehicles,
    };
  } catch (error: any) {
    throw error;
  }
};

const getHelperOwnPatrolVehicles: any = async (
  ownPatrolVehicleHelperId: number
) => {
  try {
    //GET GIVEN OWN PATROL VEHICLE HELPER WITH CITY
    const ownPatrolVehicleHelper: any = await OwnPatrolVehicleHelper.findOne({
      attributes: ["id", "cityId"],
      where: {
        id: ownPatrolVehicleHelperId,
      },
      include: [
        {
          model: City,
          as: "city",
          attributes: ["id", "nearestCityId", "districtId"],
          required: true,
        },
      ],
    });
    if (!ownPatrolVehicleHelper) {
      return {
        success: false,
        error: "COCO vehicle helper not found",
      };
    }

    // GET COCO VEHICLES THAT ARE MAPPED WITH COCO VEHICLE HELPER
    const helperMappedOwnPatrolVehicleIds =
      await OwnPatrolVehicleHelper.findAll({
        attributes: ["ownPatrolVehicleId"],
        where: {
          ownPatrolVehicleId: {
            [Op.ne]: null,
          },
        },
        group: ["ownPatrolVehicleId"],
      }).then((helperMappedOwnPatrolVehicles) =>
        helperMappedOwnPatrolVehicles.map(
          (helperMappedOwnPatrolVehicle: any) =>
            helperMappedOwnPatrolVehicle.ownPatrolVehicleId
        )
      );

    // GET COCO ASPS BASED ON COCO VEHICLE IDS
    let helperMappedOwnPatrolVehicleAspIds = [];
    if (helperMappedOwnPatrolVehicleIds.length > 0) {
      helperMappedOwnPatrolVehicleAspIds = await OwnPatrolVehicle.findAll({
        attributes: ["aspId"],
        where: {
          id: {
            [Op.in]: helperMappedOwnPatrolVehicleIds,
          },
        },
        group: ["aspId"],
      }).then((helperMappedOwnPatrolVehicleAsps) =>
        helperMappedOwnPatrolVehicleAsps.map(
          (helperMappedOwnPatrolVehicleAsp: any) =>
            helperMappedOwnPatrolVehicleAsp.aspId
        )
      );
    }

    //FETCH ASPs BASED ON OWN PATROL VEHICLE HELPER NEAREST CITY AND DISTRICT
    const cityCondition = {
      nearestCityId: ownPatrolVehicleHelper.city.nearestCityId,
    };
    const districtCondition = {
      districtId: ownPatrolVehicleHelper.city.districtId,
    };
    const cocoAsps: any = await Asp.findAll({
      attributes: ["id", "code"],
      where: {
        isOwnPatrol: 1,
        id: {
          [Op.notIn]: helperMappedOwnPatrolVehicleAspIds,
        },
      },
      include: [
        {
          model: City,
          attributes: ["id", "name"],
          where: {
            [Op.or]: [cityCondition, districtCondition],
          },
          required: true,
        },
      ],
    });
    if (cocoAsps.length == 0) {
      return {
        success: false,
        error: "COCO vehicle not available",
      };
    }
    const filteredAspIds = cocoAsps.map((cocoAsp: any) => cocoAsp.id);

    const cocoVehicles = await OwnPatrolVehicle.findAll({
      attributes: ["id", "vehicleRegistrationNumber", "aspId"],
      where: {
        aspId: {
          [Op.in]: filteredAspIds,
        },
      },
      include: [
        {
          model: VehicleType,
          as: "vehicleType",
          attributes: ["id", "name"],
          required: true,
        },
      ],
    });
    if (cocoVehicles.length == 0) {
      return {
        success: false,
        error: "COCO vehicle not available",
      };
    }

    return {
      success: true,
      data: cocoVehicles,
    };
  } catch (error: any) {
    throw error;
  }
};

export default new AttendanceController();
