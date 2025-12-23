import {
  ActivityStatus,
  AdditionalCharge,
  Asp,
  AspActivityStatus,
  AspMechanic,
  AspSubService,
  City,
  Client,
  Config,
  NearestCity,
  OwnPatrolVehicle,
  OwnPatrolVehicleHelper,
  Service,
  Shift,
  SlaSetting,
  SubService,
  VehicleMake,
  VehicleModel,
  VehicleType,
  State,
} from "../database/models/index";
import { Op, Sequelize, where } from "sequelize";
import Utils from "../lib/utils";
import moment from "moment-timezone";
import sequelize from "../database/connection";
import config from "../config/config.json";
import axios from "axios";
import { getValidBody } from "../middleware/validation.middleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

const userServiceUrlData = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpointData = config.userService.endpoint;

class ManagerController {
  constructor() {}

  //USED IN ATTENDANCE COUNT AND ATTENDANCE DETAIL APIS
  getTechnicians = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        rmIds: "required|array",
        "rmIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const cities = await City.findAll({
        attributes: ["id", "name", "pincode"],
        where: {
          rmId: {
            [Op.in]: payload.rmIds,
          },
          [Op.and]: [
            {
              pincode: {
                [Op.ne]: null,
              },
            },
            {
              pincode: {
                [Op.ne]: "",
              },
            },
          ],
        },
        paranoid: false,
      });

      if (cities.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Cities not found",
        });
      }

      const rmCityPinCodes = [
        ...new Set(cities.map((city: any) => city.pincode)),
      ];

      const cocoTechnicians: any = await AspMechanic.findAll({
        attributes: ["id", "name", "code"],
        where: {
          aspTypeId: 771, // COCO TECHNICIANS
        },
        include: [
          {
            model: City,
            as: "city",
            attributes: ["id", "name"],
            where: {
              pincode: {
                [Op.in]: rmCityPinCodes,
              },
            },
            required: true,
            paranoid: false,
          },
        ],
      });
      if (cocoTechnicians.length == 0) {
        return res.status(200).json({
          success: false,
          error: "COCO technicians not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: cocoTechnicians,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  //USED IN ATTENDANCE DETAILS API
  getAttendanceMasterDetails = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const activeDetails = [];
      if (payload.activeAttendances && payload.activeAttendances.length > 0) {
        // Extract all unique vehicle, technician, and shift IDs from the active attendances
        const activeAttendanceVehicleIds = [
          ...new Set(
            payload.activeAttendances.map(
              (attendance: any) => attendance.vehicleId
            )
          ),
        ];
        const activeAttendanceTechnicianIds = [
          ...new Set(
            payload.activeAttendances.map(
              (attendance: any) => attendance.user.entityId
            )
          ),
        ];
        const activeAttendanceShiftIds = [
          ...new Set(
            payload.activeAttendances.map(
              (attendance: any) => attendance.shiftId
            )
          ),
        ];

        const [
          activeAttendanceVehicles,
          activeAttendanceTechnicians,
          activeAttendanceShifts,
        ]: any = await Promise.all([
          OwnPatrolVehicle.findAll({
            attributes: [
              "id",
              "vehicleRegistrationNumber",
              [Sequelize.col("asp.city.name"), "cityName"],
            ],
            where: {
              id: {
                [Op.in]: activeAttendanceVehicleIds,
              },
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
                include: [
                  {
                    model: City,
                    attributes: ["id", "name"],
                    required: false,
                    paranoid: false,
                  },
                ],
              },
            ],
            paranoid: false,
          }),
          AspMechanic.findAll({
            attributes: ["id", "name", "code"],
            where: {
              id: {
                [Op.in]: activeAttendanceTechnicianIds,
              },
            },
            paranoid: false,
          }),
          Shift.findAll({
            attributes: ["id", "name", "value"],
            where: {
              id: {
                [Op.in]: activeAttendanceShiftIds,
              },
            },
            paranoid: false,
          }),
        ]);

        for (const activeAttendance of payload.activeAttendances) {
          const cocoVehicle = activeAttendanceVehicles.find(
            (activeAttendanceVehicle: any) =>
              activeAttendanceVehicle.id === activeAttendance.vehicleId
          );
          const cocoTechnician = activeAttendanceTechnicians.find(
            (activeAttendanceTechnician: any) =>
              activeAttendanceTechnician.id === activeAttendance.user.entityId
          );
          const shift = activeAttendanceShifts.find(
            (activeAttendanceShift: any) =>
              activeAttendanceShift.id === activeAttendance.shiftId
          );

          activeDetails.push({
            attendanceLogId: activeAttendance.id,
            vehicleRegistrationNumber: cocoVehicle
              ? cocoVehicle.dataValues.vehicleRegistrationNumber
              : null,
            vehicleType:
              cocoVehicle && cocoVehicle.vehicleType
                ? cocoVehicle.vehicleType.name
                : null,
            cityName: cocoVehicle ? cocoVehicle.dataValues.cityName : null,
            shiftStartTime: moment
              .tz(activeAttendance.shiftStartDateTime, "Asia/Kolkata")
              .format("h:mm A"),
            technicianId: cocoTechnician ? cocoTechnician.dataValues.id : null,
            technicianUserId: activeAttendance.userId,
            technicianCode: cocoTechnician
              ? cocoTechnician.dataValues.code
              : null,
            technicianName: cocoTechnician
              ? cocoTechnician.dataValues.name
              : null,
            workingHours: shift
              ? Utils.secondsToTime(shift.dataValues.value)
              : null,

            shiftStartDateTime: moment
              .tz(activeAttendance.shiftStartDateTime, "Asia/Kolkata")
              .format("YYYY-MM-DD HH:mm:ss"),
          });
        }
      }

      const inactiveDetails = [];
      if (payload.inactiveAttendances) {
        for (const inactiveAttendance of payload.inactiveAttendances) {
          const cocoTechnician = await AspMechanic.findOne({
            attributes: ["id", "name", "code"],
            where: {
              id: inactiveAttendance.id,
            },
            paranoid: false,
          });

          inactiveDetails.push({
            technicianUserId: inactiveAttendance.userId,
            technicianId: inactiveAttendance.id,
            technicianCode: cocoTechnician
              ? cocoTechnician.dataValues.code
              : null,
            technicianName: cocoTechnician
              ? cocoTechnician.dataValues.name
              : null,
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          activeTotalCount: payload.activeAttendanceCount,
          activeDetails: activeDetails,
          inactiveTotalCount: payload.inactiveAttendanceCount,
          inactiveDetails: inactiveDetails,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getAspMechanicMasterDetail = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        ownPatrolVehicleId: "numeric",
        aspMechanicId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [
        ownPatrolVehicle,
        aspMechanic,
        exceededExpectationSlaMinData,
      ]: any = await Promise.all([
        payload.ownPatrolVehicleId
          ? OwnPatrolVehicle.findOne({
              attributes: ["id", "vehicleRegistrationNumber", "vehicleTypeId"],
              where: {
                id: payload.ownPatrolVehicleId,
              },
              include: {
                model: VehicleType,
                as: "vehicleType",
                attributes: ["id", "name"],
                paranoid: false,
              },
              paranoid: false,
            })
          : null,
        Utils.findByModelId(AspMechanic, payload.aspMechanicId, [
          "id",
          "code",
          "name",
          "address",
          "contactNumber",
          "alternateContactNumber",
        ]),
        Config.findOne({
          attributes: ["id", "name"],
          where: {
            typeId: 74, //Exceeded Expectation SLA Mins
          },
        }),
      ]);

      if (!aspMechanic) {
        return res.status(200).json({
          success: false,
          error: `ASP mechanic not found`,
        });
      }

      const data = {
        technicianCode: aspMechanic.code,
        technicianName: aspMechanic.name,
        technicianAddress: aspMechanic.address,
        technicianContactNumber: aspMechanic.contactNumber,
        technicianAlternateContactNumber: aspMechanic.alternateContactNumber,
        vehicleRegistrationNumber: ownPatrolVehicle
          ? ownPatrolVehicle.vehicleRegistrationNumber
          : null,
        vehicleType:
          ownPatrolVehicle && ownPatrolVehicle.vehicleType
            ? ownPatrolVehicle.vehicleType.name
            : null,
        exceededExpectationSlaMinData: exceededExpectationSlaMinData,
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

  getCocoAssets = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        rmIds: "required|array",
        "rmIds.*": "required",
        search: "string",
        dateRange: "string",
        limit: "numeric",
        offset: "numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const asps: any = await Asp.findAll({
        attributes: ["id"],
        where: {
          rmId: {
            [Op.in]: payload.rmIds,
          },
        },
        paranoid: false,
      });
      if (asps.length == 0) {
        return res.status(200).json({
          success: false,
          error: "ASPs not found",
        });
      }

      const aspIds = asps.map((asp: any) => asp.id);
      const cocoVehicleWhere: any = {};
      cocoVehicleWhere.aspId = {
        [Op.in]: aspIds,
      };

      if (payload.search) {
        cocoVehicleWhere[Op.or] = [
          { vehicleRegistrationNumber: { [Op.like]: `%${payload.search}%` } },
        ];
      }

      if (payload.dateRange) {
        const dateRange = payload.dateRange;
        const [startDate, endDate] = dateRange.split(" - ");

        const formattedStartDate = moment
          .tz(startDate, "DD/MM/YYYY", "Asia/Kolkata")
          .format("YYYY-MM-DD");
        const formattedEndDate = moment
          .tz(endDate, "DD/MM/YYYY", "Asia/Kolkata")
          .format("YYYY-MM-DD");

        cocoVehicleWhere[Op.and] = [
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("ownPatrolVehicle.createdAt")),
            ">=",
            formattedStartDate
          ),
          sequelize.where(
            sequelize.fn("DATE", sequelize.col("ownPatrolVehicle.createdAt")),
            "<=",
            formattedEndDate
          ),
        ];
      }

      let limitValue: number = 10;
      if (payload.limit) {
        limitValue = payload.limit;
      }

      let offsetValue: number = 0;
      if (payload.offset) {
        offsetValue = payload.offset;
      }

      const [cocoVehicles, cocoVehicleList]: any = await Promise.all([
        //COCO VEHICLE COUNT
        OwnPatrolVehicle.findAll({
          attributes: ["id", "deletedAt"],
          where: cocoVehicleWhere,
          include: [
            {
              model: Asp,
              as: "asp",
              attributes: ["id"],
              required: true,
              paranoid: false,
            },
          ],
          paranoid: false,
          group: ["ownPatrolVehicle.id"],
        }),
        //COCO VEHICLE DETAILS
        OwnPatrolVehicle.findAll({
          attributes: [
            "id",
            "vehicleRegistrationNumber",
            "inActiveReason",
            [
              Sequelize.literal(`DATE_FORMAT(inActiveFromDate, '%d/%m/%Y')`),
              "inActiveFromDate",
            ],
            [
              Sequelize.literal(`DATE_FORMAT(inActiveToDate, '%d/%m/%Y')`),
              "inActiveToDate",
            ],
            [
              Sequelize.literal(
                `CONCAT('Activate your asset on ', DATE_FORMAT(inActiveToDate, '%d/%m/%Y'))`
              ),
              "activationMessage",
            ],
            [Sequelize.col("asp.addressLineOne"), "aspAddressLineOne"],
            [Sequelize.col("asp.addressLineTwo"), "aspAddressLineTwo"],
            [Sequelize.col("vehicleType.name"), "vehicleTypeName"],
            [
              Sequelize.literal(
                "( SELECT IF (ownPatrolVehicle.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          where: cocoVehicleWhere,
          include: [
            {
              model: Asp,
              as: "asp",
              attributes: ["id", "addressLineOne", "addressLineTwo"],
              required: true,
              paranoid: false,
            },
            {
              model: VehicleType,
              as: "vehicleType",
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
          ],
          order: [["id", "desc"]],
          paranoid: false,
          limit: limitValue,
          offset: offsetValue,
          group: ["ownPatrolVehicle.id"],
        }),
      ]);

      const activeCocoVehicles = cocoVehicles
        .filter((cocoVehicle: any) => cocoVehicle.deletedAt == null)
        .map((activeCocoVehicle: any) => activeCocoVehicle.id);

      const inActiveCocoVehicles = cocoVehicles
        .filter((cocoVehicle: any) => cocoVehicle.deletedAt != null)
        .map((inActiveCocoVehicle: any) => inActiveCocoVehicle.id);

      if (cocoVehicleList.length == 0) {
        return res.status(200).json({
          success: false,
          error: "COCO assets not available",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          totalCount: cocoVehicles.length,
          activeCount: activeCocoVehicles.length,
          inActiveCount: inActiveCocoVehicles.length,
          cocoVehicles: cocoVehicleList,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getCocoAssetView = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        cocoAssetId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [ownPatrolVehicle, exceededExpectationSlaMinData]: any =
        await Promise.all([
          OwnPatrolVehicle.findOne({
            attributes: [
              "id",
              "aspId",
              "vehicleRegistrationNumber",
              "inActiveReason",
              [
                Sequelize.literal(`DATE_FORMAT(inActiveFromDate, '%d/%m/%Y')`),
                "inActiveFromDate",
              ],
              [
                Sequelize.literal(`DATE_FORMAT(inActiveToDate, '%d/%m/%Y')`),
                "inActiveToDate",
              ],
              [
                Sequelize.literal(
                  `CONCAT('Activate your asset on ', DATE_FORMAT(inActiveToDate, '%d/%m/%Y'))`
                ),
                "activationMessage",
              ],
              [Sequelize.col("asp.addressLineOne"), "aspAddressLineOne"],
              [Sequelize.col("asp.addressLineTwo"), "aspAddressLineTwo"],
              [Sequelize.col("vehicleType.name"), "vehicleTypeName"],
              [
                Sequelize.literal(
                  "( SELECT IF (ownPatrolVehicle.deletedAt IS NULL, 'Active', 'Inactive') )"
                ),
                "status",
              ],
            ],
            where: {
              id: payload.cocoAssetId,
            },
            include: [
              {
                model: Asp,
                as: "asp",
                attributes: ["id", "addressLineOne", "addressLineTwo"],
                required: true,
                paranoid: false,
              },
              {
                model: VehicleType,
                as: "vehicleType",
                attributes: ["id", "name"],
                required: false,
                paranoid: false,
              },
            ],
            paranoid: false,
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: {
              typeId: 74, //Exceeded Expectation SLA Mins
            },
          }),
        ]);

      if (!ownPatrolVehicle) {
        return res.status(200).json({
          success: false,
          error: "COCO asset not found",
        });
      }

      ownPatrolVehicle.dataValues.exceededExpectationSlaMinData =
        exceededExpectationSlaMinData;

      return res.status(200).json({
        success: true,
        data: ownPatrolVehicle,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  updateCocoAssetStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = getValidBody(req);

      const cocoVehicleUpdates: any = {};
      const aspUpdates: any = {};
      cocoVehicleUpdates.updatedById = payload.authUserId;
      cocoVehicleUpdates.isActiveReminderSent = 0;
      aspUpdates.updatedById = payload.authUserId;

      //INACTIVE
      if (payload.status == 0) {
        const dateRange = payload.dateRange;
        const [startDate, endDate] = dateRange.split(" - ");
        const inActiveFromDate = moment
          .tz(startDate, "DD/MM/YYYY", "Asia/Kolkata")
          .format("YYYY-MM-DD");
        const inActiveToDate = moment
          .tz(endDate, "DD/MM/YYYY", "Asia/Kolkata")
          .format("YYYY-MM-DD");

        cocoVehicleUpdates.inActiveReason = payload.reason;
        cocoVehicleUpdates.inActiveFromDate = inActiveFromDate;
        cocoVehicleUpdates.inActiveToDate = inActiveToDate;
        cocoVehicleUpdates.deletedById = payload.authUserId;
        cocoVehicleUpdates.deletedAt = new Date();
        aspUpdates.deletedById = payload.authUserId;
        aspUpdates.deletedAt = new Date();
      } else {
        //ACTIVE
        cocoVehicleUpdates.inActiveReason = null;
        cocoVehicleUpdates.inActiveFromDate = null;
        cocoVehicleUpdates.inActiveToDate = null;
        cocoVehicleUpdates.deletedById = null;
        cocoVehicleUpdates.deletedAt = null;
        aspUpdates.deletedById = null;
        aspUpdates.deletedAt = null;
      }

      const cocoVehicle: any = await OwnPatrolVehicle.findOne({
        attributes: ["id", "aspId"],
        where: {
          id: payload.cocoVehicleId,
        },
        paranoid: false,
      });
      if (!cocoVehicle) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "COCO asset not found",
        });
      }

      const [cocoAspHaveMechanic, cocoVehicleHelperIsInShift]: any =
        await Promise.all([
          Asp.findOne({
            where: {
              id: cocoVehicle.dataValues.aspId,
              isOwnPatrol: 1,
            },
            attributes: ["id"],
            include: {
              model: AspMechanic,
              attributes: ["id"],
              required: false,
              paranoid: false,
            },
            paranoid: false,
          }),
          OwnPatrolVehicleHelper.findOne({
            attributes: ["id"],
            where: {
              ownPatrolVehicleId: payload.cocoVehicleId,
            },
            paranoid: false,
          }),
        ]);

      //IF COCO ASP HAVE MECHANICS OR COCO VEHICLE HELPER IS IN SHIFT THEN COCO VEHICLE INACTIVE IS NOT POSSIBLE
      if (
        ((cocoAspHaveMechanic &&
          cocoAspHaveMechanic.aspMechanics &&
          cocoAspHaveMechanic.aspMechanics.length > 0) ||
          cocoVehicleHelperIsInShift) &&
        payload.status == 0
      ) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: `It’s not possible to inactive the COCO asset at the moment because the technician / helper is on shift`,
        });
      }

      await OwnPatrolVehicle.update(cocoVehicleUpdates, {
        where: {
          id: cocoVehicle.dataValues.id,
        },
        paranoid: false,
        transaction: transaction,
      });

      if (cocoAspHaveMechanic) {
        //UPDATE COCO ASP STATUS
        await Asp.update(aspUpdates, {
          where: {
            id: cocoVehicle.dataValues.aspId,
          },
          paranoid: false,
          transaction: transaction,
        });

        //UPDATE COCO ASP USER STATUS
        // const getAllAspEntityUsers: any = await axios.post(
        //   `${userServiceUrlData}/userMaster/${userServiceEndpointData.userMaster.getAllEntityUsers}`,
        //   {
        //     userTypeId: 142, //ASP
        //     entityIds: [cocoVehicle.dataValues.aspId],
        //   }
        // );

        // if (!getAllAspEntityUsers.data.success) {
        //   await transaction.rollback();
        //   return getAllAspEntityUsers.data;
        // }
        // const entityAspUserIds = getAllAspEntityUsers.data.data.map(
        //   (entityUser: any) => entityUser.id
        // );

        //UPDATE ASP STATUS IN USER
        // const entityAspUserUpdateStatus: any = await axios.put(
        //   `${userServiceUrlData}/userMaster/${userServiceEndpointData.userMaster.updateStatus}`,
        //   {
        //     userIds: entityAspUserIds,
        //     status: payload.status,
        //     updatedById: payload.authUserId,
        //     deletedById: payload.status == 0 ? payload.authUserId : null,
        //   }
        // );

        // if (!entityAspUserUpdateStatus.data.success) {
        //   await transaction.rollback();
        //   return entityAspUserUpdateStatus.data;
        // }
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "COCO asset updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  cocoAssetActiveReminder = async (req: any, res: any) => {
    try {
      const ownPatrolVehicles: any = await OwnPatrolVehicle.findAll({
        attributes: [
          "id",
          "vehicleRegistrationNumber",
          [
            Sequelize.literal(`DATE_FORMAT(inActiveToDate, '%d/%m/%Y')`),
            "inActiveToDate",
          ],
        ],
        where: {
          deletedAt: {
            [Op.ne]: null,
          },
          inActiveFromDate: {
            [Op.ne]: null,
          },
          isActiveReminderSent: 0,
          inActiveToDate: {
            [Op.lte]: moment().tz("Asia/Kolkata").format("YYYY-MM-DD"), // inActiveToDate <= currentDateTime
            [Op.ne]: null,
          },
        },
        include: [
          {
            model: Asp,
            as: "asp",
            attributes: ["id", "rmId"],
            required: true,
            paranoid: false,
          },
          {
            model: VehicleType,
            as: "vehicleType",
            attributes: ["id", "name"],
            required: true,
            paranoid: false,
          },
        ],
        paranoid: false,
      });

      if (ownPatrolVehicles.length == 0) {
        return res.status(500).json({
          success: false,
          error: "Inactive COCO assets not found",
        });
      }

      const ownPatrolVehicleIds = ownPatrolVehicles.map(
        (ownPatrolVehicle: any) => ownPatrolVehicle.id
      );
      const activeReminderOwnPatrolVehicles = ownPatrolVehicles.map(
        (ownPatrolVehicle: any) => ({
          rmId: ownPatrolVehicle.asp.rmId,
          vehicleNumber: ownPatrolVehicle.dataValues.vehicleRegistrationNumber,
          vehicleType: ownPatrolVehicle.vehicleType?.name,
          activateDate: ownPatrolVehicle.dataValues.inActiveToDate,
        })
      );
      const cocoAssetActiveReminderResponse = await axios.post(
        `${userServiceUrlData}/${userServiceEndpointData.manager.cocoAssetActiveReminderToManagers}`,
        {
          activeReminderOwnPatrolVehicles: activeReminderOwnPatrolVehicles,
        }
      );
      if (!cocoAssetActiveReminderResponse.data.success) {
        return res.status(200).json(cocoAssetActiveReminderResponse.data);
      }

      OwnPatrolVehicle.update(
        {
          isActiveReminderSent: 1,
        },
        {
          where: {
            id: {
              [Op.in]: ownPatrolVehicleIds,
            },
          },
          paranoid: false,
        }
      );

      return res.status(200).json({
        success: true,
        message: "COCO Asset active reminder processed successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getCaseList = async (req: any, res: any) => {
    try {
      const payload = req.body;
      // Collect all unique subServiceIds, breakdownAreaIds, pickUpCityIds, and dropCityIds
      const subServiceIds = [
        ...new Set(
          payload.caseLists.map((caseList: any) => caseList.subServiceId)
        ),
      ];

      const breakdownAreaIds = [
        ...new Set(
          payload.caseLists.map((caseList: any) => caseList.breakdownAreaId)
        ),
      ];

      const pickUpCityIds = [
        ...new Set(
          payload.caseLists.map(
            (caseList: any) => caseList.deliveryRequestPickUpCityId
          )
        ),
      ];

      const dropCityIds = [
        ...new Set(
          payload.caseLists.map(
            (caseList: any) => caseList.deliveryRequestDropCityId
          )
        ),
      ];

      const vehicleMakeIds = [
        ...new Set(
          payload.caseLists.map((caseList: any) => caseList.vehicleMakeId)
        ),
      ];

      const vehicleModelIds = [
        ...new Set(
          payload.caseLists.map((caseList: any) => caseList.vehicleModelId)
        ),
      ];

      // Batch fetch all necessary data
      const [subServices, cities, vehicleMakes, vehicleModels]: any =
        await Promise.all([
          SubService.findAll({
            attributes: ["id", "name", "serviceId"],
            where: {
              id: {
                [Op.in]: subServiceIds,
              },
            },
            include: {
              model: Service,
              attributes: ["id", "name"],
              paranoid: false,
            },
            paranoid: false,
          }),
          City.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: [
                  ...breakdownAreaIds,
                  ...pickUpCityIds,
                  ...dropCityIds,
                ],
              },
            },
            paranoid: false,
          }),
          VehicleMake.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: vehicleMakeIds,
              },
            },
            paranoid: false,
          }),
          VehicleModel.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: vehicleModelIds,
              },
            },
            paranoid: false,
          }),
        ]);

      // Populate caseLists with fetched data
      payload.caseLists.forEach((caseList: any) => {
        const subServiceData = subServices.find(
          (subService: any) => subService.id === caseList.subServiceId
        );
        const breakDownAreaData = cities.find(
          (breakDownArea: any) => breakDownArea.id === caseList.breakdownAreaId
        );
        const pickUpCityData = cities.find(
          (pickUpCity: any) =>
            pickUpCity.id === caseList.deliveryRequestPickUpCityId
        );
        const dropCityData = cities.find(
          (dropCity: any) => dropCity.id === caseList.deliveryRequestDropCityId
        );
        const vehicleMakeData = vehicleMakes.find(
          (vehicleMake: any) => vehicleMake.id === caseList.vehicleMakeId
        );
        const vehicleModelData = vehicleModels.find(
          (vehicleModel: any) => vehicleModel.id === caseList.vehicleModelId
        );

        caseList.service =
          subServiceData && subServiceData.service
            ? subServiceData.service.dataValues.name
            : null;
        caseList.subService = subServiceData
          ? subServiceData.dataValues.name
          : null;
        caseList.breakdownArea = breakDownAreaData
          ? breakDownAreaData.dataValues.name
          : null;
        caseList.deliveryRequestPickUpCity = pickUpCityData
          ? pickUpCityData.dataValues.name
          : null;
        caseList.deliveryRequestDropCity = dropCityData
          ? dropCityData.dataValues.name
          : null;
        caseList.vehicleMake = vehicleMakeData
          ? vehicleMakeData.dataValues.name
          : null;
        caseList.vehicleModel = vehicleModelData
          ? vehicleModelData.dataValues.name
          : null;
      });

      return res.status(200).json({
        success: true,
        data: {
          caseCount: payload.caseCount,
          caseLists: payload.caseLists,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getCaseListView = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const caseDetails: any = {};
      if (payload.caseDetail) {
        const [
          vehicleMake,
          vehicleModel,
          vehicleType,
          getAgentDetailResponse,
          breakdownCity,
        ]: any = await Promise.all([
          Utils.findByModelId(VehicleMake, payload.caseDetail.vehicleMakeId, [
            "id",
            "name",
          ]),
          Utils.findByModelId(VehicleModel, payload.caseDetail.vehicleModelId, [
            "id",
            "name",
          ]),
          Utils.findByModelId(VehicleType, payload.caseDetail.vehicleTypeId, [
            "id",
            "name",
          ]),
          axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
            id: payload.caseDetail.agentId,
          }),
          payload.caseDetail.caseInformation
            ? Utils.findByModelId(
                City,
                payload.caseDetail.caseInformation.breakdownAreaId,
                ["id", "name"]
              )
            : null,
        ]);

        caseDetails.caseNumber = payload.caseDetail.caseNumber;
        caseDetails.typeId = payload.caseDetail.typeId;
        caseDetails.vehicleMakeName = vehicleMake
          ? vehicleMake.dataValues.name
          : null;
        caseDetails.vehicleModelName = vehicleModel
          ? vehicleModel.dataValues.name
          : null;
        caseDetails.vehicleTypeName = vehicleType
          ? vehicleType.dataValues.name
          : null;
        caseDetails.agentName = getAgentDetailResponse.data.success
          ? getAgentDetailResponse.data.user.name
          : null;
        caseDetails.agentMobileNumber = getAgentDetailResponse.data.success
          ? getAgentDetailResponse.data.user.mobileNumber
          : null;
        caseDetails.registrationNumber = payload.caseDetail.registrationNumber;
        caseDetails.vin = payload.caseDetail.vin;
        caseDetails.deliveryRequestPickUpLocation =
          payload.caseDetail.deliveryRequestPickUpLocation;
        caseDetails.deliveryRequestDropLocation =
          payload.caseDetail.deliveryRequestDropLocation;
        caseDetails.description = payload.caseDetail.description;
        caseDetails.breakdownLocation = payload.caseDetail.caseInformation
          ? payload.caseDetail.caseInformation.breakdownLocation
          : null;
        caseDetails.breakdownCity = breakdownCity
          ? breakdownCity.dataValues.name
          : null;
        caseDetails.dropLocation = payload.caseDetail.caseInformation
          ? payload.caseDetail.caseInformation.dropLocation
          : null;
        caseDetails.voiceOfCustomer = payload.caseDetail.caseInformation
          ? payload.caseDetail.caseInformation.voiceOfCustomer
          : null;
        caseDetails.irateCustomer = payload.caseDetail.caseInformation
          ? payload.caseDetail.caseInformation.irateCustomer
          : null;
        caseDetails.womenAssist = payload.caseDetail.caseInformation
          ? payload.caseDetail.caseInformation.womenAssist
          : null;
        caseDetails.deliveryRequestPickupDate = payload.caseDetail
          .deliveryRequestPickupDate
          ? moment
              .tz(payload.caseDetail.deliveryRequestPickupDate, "Asia/Kolkata")
              .format("DD/MM/YYYY")
          : null;
        caseDetails.deliveryRequestPickupTime =
          payload.caseDetail.deliveryRequestPickupTime;
      }

      const activities: any = [];
      if (payload.activities && payload.activities.length > 0) {
        const aspIds = [
          ...new Set(
            payload.activities.map(
              (activity: any) => activity.activityAspDetail.aspId
            )
          ),
        ];

        const subServiceIds = [
          ...new Set(
            payload.activities.map(
              (activity: any) => activity.activityAspDetail.subServiceId
            )
          ),
        ];

        const [asps, subServices, additionalCharges]: any = await Promise.all([
          Asp.findAll({
            attributes: [
              "id",
              "code",
              "name",
              "workshopName",
              "email",
              "whatsAppNumber",
              "contactNumber",
              "addressLineOne",
              "addressLineTwo",
              "location",
            ],
            where: {
              id: {
                [Op.in]: aspIds,
              },
            },
            include: {
              model: AspMechanic,
              attributes: [
                "id",
                "name",
                "code",
                "contactNumber",
                "alternateContactNumber",
              ],
            },
            paranoid: false,
          }),
          SubService.findAll({
            attributes: [
              "id",
              "name",
              [Sequelize.col("service.name"), "serviceName"],
            ],
            where: {
              id: {
                [Op.in]: subServiceIds,
              },
            },
            include: {
              model: Service,
              attributes: ["id", "name"],
            },
            paranoid: false,
          }),
          AdditionalCharge.findAll({
            attributes: ["id", "name"],
            paranoid: false,
          }),
        ]);

        payload.activities.forEach((activity: any) => {
          const aspData = asps.find(
            (asp: any) => asp.id === activity.activityAspDetail.aspId
          );

          const subServiceData = subServices.find(
            (subService: any) =>
              subService.id === activity.activityAspDetail.subServiceId
          );

          let aspDetailDateTime = null;
          let aspDetailStatus = null;
          // Assigned,In Progress,Successful,Waiting for Dealer Approval,Advance Payment Paid,Balance Payment Pending,Excess Amount Credit Pending, Advance pay later
          if (
            [2, 3, 7, 9, 10, 11, 12, 14].includes(activity.activityStatusId)
          ) {
            aspDetailDateTime = activity.aspServiceAcceptedAt;
            aspDetailStatus = "Accepted";
          } else if (activity.activityStatusId == 8) {
            //Rejected
            aspDetailDateTime = activity.aspServiceRejectedAt;
            aspDetailStatus = "Rejected";
          } else if (activity.activityStatusId == 4) {
            //Cancelled
            aspDetailDateTime = activity.aspServiceCanceledAt;
            aspDetailStatus = "Cancelled";
          }

          const estimatedNetAmount =
            parseFloat(
              activity.activityAspDetail.estimatedAdditionalCharge || 0
            ) +
            parseFloat(activity.activityAspDetail.estimatedServiceCost) -
            parseFloat(activity.activityAspDetail.discountAmount || 0);

          const estimatedAspNetAmount = activity.activityAspDetail
            .estimatedAdditionalCharge
            ? parseFloat(activity.activityAspDetail.estimatedAdditionalCharge) +
              parseFloat(activity.activityAspDetail.estimatedAspServiceCost)
            : parseFloat(activity.activityAspDetail.estimatedAspServiceCost);
          let actualNetAmount = 0;
          let actualAspNetAmount = 0;
          if (activity.activityAspDetail.actualServiceCost) {
            actualNetAmount =
              activity.activityAspDetail.actualAdditionalCharge ||
              activity.activityAspDetail.actualClientWaitingCharge
                ? (parseFloat(
                    activity.activityAspDetail.actualAdditionalCharge
                  ) || 0) +
                  (parseFloat(
                    activity.activityAspDetail.actualClientWaitingCharge
                  ) || 0) +
                  parseFloat(activity.activityAspDetail.actualServiceCost)
                : parseFloat(activity.activityAspDetail.actualServiceCost);
            actualAspNetAmount =
              activity.activityAspDetail.actualAdditionalCharge ||
              activity.activityAspDetail.actualAspWaitingCharge
                ? (parseFloat(
                    activity.activityAspDetail.actualAdditionalCharge
                  ) || 0) +
                  (parseFloat(
                    activity.activityAspDetail.actualAspWaitingCharge
                  ) || 0) +
                  parseFloat(activity.activityAspDetail.actualAspServiceCost)
                : parseFloat(activity.activityAspDetail.actualAspServiceCost);
          }

          activity.activityAspDetail.estimatedNetAmount =
            estimatedNetAmount.toFixed(2);
          activity.activityAspDetail.estimatedAspNetAmount =
            estimatedAspNetAmount.toFixed(2);
          activity.activityAspDetail.actualNetAmount =
            actualNetAmount.toFixed(2);
          activity.activityAspDetail.actualAspNetAmount =
            actualAspNetAmount.toFixed(2);

          if (activity.activityCharges.length > 0) {
            for (const activityCharge of activity.activityCharges) {
              const activityChargeData = additionalCharges.find(
                (additionalCharge: any) =>
                  additionalCharge.id === activityCharge.chargeId
              );
              activityCharge.chargeName = activityChargeData
                ? activityChargeData.dataValues.name
                : null;
            }
          }

          activities.push({
            ...activity,
            asp: aspData,
            serviceName: subServiceData
              ? subServiceData.dataValues.serviceName
              : null,
            subServiceName: subServiceData
              ? subServiceData.dataValues.name
              : null,
            aspDetailDateTime: aspDetailDateTime
              ? moment
                  .tz(aspDetailDateTime, "Asia/Kolkata")
                  .format("DD-MM-YYYY hh:mm A")
              : null,
            aspDetailStatus,
          });
        });
      }

      const activityLogs: any = [];
      if (payload.activityLogs.length > 0) {
        const configs = await Config.findAll({
          attributes: ["id", "name"],
        });
        for (const activityLog of payload.activityLogs) {
          let channel = null;
          let interactionTo = null;
          let callType = null;
          //INTERACTION TYPE
          if (activityLog.typeId == 242) {
            const channelData = configs.find(
              (config: any) => (config.id = activityLog.channelId)
            );
            const interactionToData = configs.find(
              (config: any) => (config.id = activityLog.toId)
            );
            const callTypeData = configs.find(
              (config: any) => (config.id = activityLog.callTypeId)
            );
            channel = channelData ? channelData.dataValues.name : null;
            interactionTo = interactionToData
              ? interactionToData.dataValues.name
              : null;
            callType = callTypeData ? callTypeData.dataValues.name : null;
          }

          activityLogs.push({
            id: activityLog.id,
            caseDetailId: activityLog.caseDetailId,
            activityId: activityLog.activityId,
            typeId: activityLog.typeId,
            title: activityLog.title,
            description: activityLog.description,
            channel: channel,
            interactionTo: interactionTo,
            callType: callType,
            createdAt: moment
              .tz(activityLog.createdAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A"),
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          caseDetails,
          activities,
          slaDetails: payload.slaDetails,
          activityLogs,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getAspPerformanceList = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const aspPerformances: any = [];
      if (payload.lists && payload.lists.length > 0) {
        const aspIds = [
          ...new Set(payload.lists.map((list: any) => list.aspId)),
        ];

        const asps = await Asp.findAll({
          attributes: [
            "id",
            "code",
            "name",
            "workshopName",
            "whatsAppNumber",
            "contactNumber",
          ],
          where: {
            id: {
              [Op.in]: aspIds,
            },
          },
          include: {
            model: AspMechanic,
            attributes: [
              "id",
              "name",
              "code",
              "contactNumber",
              "alternateContactNumber",
            ],
          },
          paranoid: false,
        });

        for (const list of payload.lists) {
          const aspData = asps.find((asp: any) => asp.id === list.aspId);
          aspPerformances.push({
            ...list,
            asp: aspData ? aspData : null,
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          aspPerformances,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getClientPerformanceCount = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const clientPerformances: any = [];
      if (payload.lists && payload.lists.length > 0) {
        const clientIds = [
          ...new Set(payload.lists.map((list: any) => list.clientId)),
        ];

        const clients = await Client.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: clientIds,
            },
          },
          paranoid: false,
        });

        for (const list of payload.lists) {
          const clientData = clients.find(
            (client: any) => client.id === list.clientId
          );
          clientPerformances.push({
            ...list,
            clientName: clientData ? clientData.dataValues.name : null,
          });
        }
      }

      const totalCases = clientPerformances.reduce(
        (sum: any, clientPerformance: any) => {
          return sum + clientPerformance.caseCount;
        },
        0
      );

      return res.status(200).json({
        success: true,
        data: {
          totalCases,
          clientPerformances,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getAspByAspTypeAndRm = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        rmIds: "required|array",
        "rmIds.*": "required",
        aspType: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const aspWhereCondition: any = {};
      aspWhereCondition.rmId = {
        [Op.in]: payload.rmIds,
      };

      //COCO
      if (payload.aspType == 1) {
        aspWhereCondition.isOwnPatrol = 1;
      } else if (payload.aspType == 0) {
        //THIRD PARTY
        aspWhereCondition.isOwnPatrol = 0;
      }

      const [asps, exceededExpectationSlaMinData]: any = await Promise.all([
        Asp.findAll({
          attributes: [
            "id",
            "code",
            "name",
            "workshopName",
            "whatsAppNumber",
            "contactNumber",
          ],
          where: aspWhereCondition,
          paranoid: false,
        }),
        Config.findOne({
          attributes: ["id", "name"],
          where: {
            typeId: 74, //Exceeded Expectation SLA Mins
          },
        }),
      ]);

      if (asps.length == 0) {
        return res.status(200).json({
          success: false,
          error: `ASPs not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: asps,
        exceededExpectationSlaMinData: exceededExpectationSlaMinData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getNetworkCount = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        rmIds: "required|array",
        "rmIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const asps: any = await Asp.findAll({
        attributes: ["id", "createdAt", "deletedAt"],
        where: {
          rmId: {
            [Op.in]: payload.rmIds,
          },
        },
        paranoid: false,
        include: [
          {
            model: AspSubService,
            as: "subServices",
            required: true,
            include: [
              {
                model: SubService,
                as: "subService",
                attributes: ["id"],
                required: true,
                paranoid: false,
                include: [
                  {
                    model: Service,
                    attributes: ["id"],
                    required: true,
                    paranoid: false,
                  },
                ],
              },
            ],
          },
        ],
      });

      const currentFinancialYear = Utils.getCurrentFinancialYear();
      const financialYearStart = moment.tz(
        `${currentFinancialYear - 1}-04-01 00:00:00`,
        "Asia/Kolkata"
      );
      const financialYearEnd = moment.tz(
        `${currentFinancialYear}-03-31 23:59:59`,
        "Asia/Kolkata"
      );

      const services = await Service.findAll({
        attributes: ["id", "name"],
      });
      for (const service of services) {
        const activeAsps = asps.filter((asp: any) =>
          asp.subServices.some(
            (subService: any) =>
              subService.subService.service.id == service.dataValues.id &&
              asp.dataValues.deletedAt == null
          )
        );
        const inactiveAsps = asps.filter((asp: any) =>
          asp.subServices.some(
            (subService: any) =>
              subService.subService.service.id == service.dataValues.id &&
              asp.dataValues.deletedAt != null
          )
        );
        const aspsCreatedInCurrentFinancialYear = asps.filter((asp: any) =>
          asp.subServices.some(
            (subService: any) =>
              subService.subService.service.id == service.dataValues.id &&
              moment
                .tz(asp.dataValues.createdAt, "Asia/Kolkata")
                .isBetween(financialYearStart, financialYearEnd, null, "[]") ==
                true
          )
        );

        service.dataValues.totalCount = activeAsps.length + inactiveAsps.length;
        service.dataValues.activeCount = activeAsps.length;
        service.dataValues.inActiveCount = inactiveAsps.length;
        service.dataValues.newNetworks =
          aspsCreatedInCurrentFinancialYear.length;
      }

      const totalNetwork = services.reduce(
        (sum, service) => sum + service.dataValues.totalCount,
        0
      );

      return res.status(200).json({
        success: true,
        data: {
          totalNetwork,
          services,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  // STATE WISE ASP SLA PERFORMANCE
  getStateWiseAspSlaPerformanceList = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        rmIds: "required|array",
        "rmIds.*": "required",
        search: "string",
        limit: "numeric",
        offset: "numeric",
        aspType: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const stateWhere: any = {};
      if (payload.search) {
        stateWhere[Op.or] = [{ name: { [Op.like]: `%${payload.search}%` } }];
      }

      let limitValue: number = 10;
      if (payload.limit) {
        limitValue = payload.limit;
      }

      let offsetValue: number = 0;
      if (payload.offset) {
        offsetValue = payload.offset;
      }

      const rmCities = await City.findAll({
        attributes: ["stateId"],
        where: {
          rmId: {
            [Op.in]: payload.rmIds,
          },
        },
        paranoid: false,
        group: ["stateId"],
      });

      const rmStateIds = [
        ...new Set(rmCities.map((rmCity: any) => rmCity.stateId)),
      ];

      stateWhere.id = {
        [Op.in]: rmStateIds,
      };

      const stateBaseQuery: any = {
        attributes: ["id", "name"],
        where: stateWhere,
        paranoid: false,
        order: [["id", "asc"]],
        group: ["id"],
      };

      const [
        statesWithoutLimitOffset,
        states,
        exceededExpectationSlaMinData,
      ]: any = await Promise.all([
        State.findAll(stateBaseQuery),
        State.findAll({
          ...stateBaseQuery,
          limit: limitValue,
          offset: offsetValue,
        }),
        Config.findOne({
          attributes: ["id", "name"],
          where: {
            typeId: 74, //Exceeded Expectation SLA Mins
          },
        }),
      ]);

      //GET STATE BASED ASP DETAILS
      const stateIds = states.map((state: any) => state.dataValues.id);

      const stateAsps = await Asp.findAll({
        attributes: ["id"],
        where: {
          isOwnPatrol: payload.aspType,
          rmId: {
            [Op.in]: payload.rmIds,
          },
        },
        include: {
          model: City,
          required: true,
          attributes: ["id", "stateId"],
          where: {
            stateId: {
              [Op.in]: stateIds,
            },
          },
        },
        paranoid: false,
      });

      for (const state of states) {
        //GET NEAREST CITY BASED ASP DETAILS
        const asps = stateAsps.filter(
          (stateAsp: any) => stateAsp.city.stateId == state.dataValues.id
        );
        state.dataValues.aspIds = asps.map((asp: any) => asp.id);
      }
      if (states.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Data not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          totalCount: statesWithoutLimitOffset.length,
          states: states,
          exceededExpectationSlaMinData: exceededExpectationSlaMinData,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  // NEAREST CITY WISE ASP SLA PERFORMANCE
  getAspSlaPerformanceList = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        rmIds: "required|array",
        "rmIds.*": "required",
        search: "string",
        limit: "numeric",
        offset: "numeric",
        aspType: "required|numeric",
        stateId: "numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const nearestCityWhere: any = {};
      if (payload.search) {
        nearestCityWhere[Op.or] = [
          { name: { [Op.like]: `%${payload.search}%` } },
        ];
      }

      let limitValue: number = 10;
      if (payload.limit) {
        limitValue = payload.limit;
      }

      let offsetValue: number = 0;
      if (payload.offset) {
        offsetValue = payload.offset;
      }

      const rmCities = await City.findAll({
        attributes: ["nearestCityId"],
        where: {
          rmId: {
            [Op.in]: payload.rmIds,
          },
          ...(payload.stateId && { stateId: payload.stateId }),
        },
        paranoid: false,
        group: ["nearestCityId"],
      });

      const rmNearestCityIds = [
        ...new Set(rmCities.map((rmCity: any) => rmCity.nearestCityId)),
      ];

      nearestCityWhere.id = {
        [Op.in]: rmNearestCityIds,
      };

      const nearestCityBaseQuery: any = {
        attributes: ["id", "name"],
        where: nearestCityWhere,
        paranoid: false,
        order: [["id", "asc"]],
        group: ["id"],
      };

      const [
        nearestCityWithoutLimitOffset,
        nearestCities,
        exceededExpectationSlaMinData,
      ]: any = await Promise.all([
        NearestCity.findAll(nearestCityBaseQuery),
        NearestCity.findAll({
          ...nearestCityBaseQuery,
          limit: limitValue,
          offset: offsetValue,
        }),
        Config.findOne({
          attributes: ["id", "name"],
          where: {
            typeId: 74, //Exceeded Expectation SLA Mins
          },
        }),
      ]);

      //GET NEAREST CITY BASED ASP DETAILS
      const nearestCityIds = nearestCities.map(
        (nearestCity: any) => nearestCity.dataValues.id
      );

      const nearestCityAsps = await Asp.findAll({
        attributes: ["id"],
        where: {
          isOwnPatrol: payload.aspType,
          rmId: {
            [Op.in]: payload.rmIds,
          },
        },
        include: {
          model: City,
          required: true,
          attributes: ["id"],
          include: [
            {
              model: NearestCity,
              required: true,
              attributes: ["id"],
              where: {
                id: {
                  [Op.in]: nearestCityIds,
                },
              },
            },
          ],
        },
        paranoid: false,
      });

      for (const nearestCity of nearestCities) {
        //GET NEAREST CITY BASED ASP DETAILS
        const asps = nearestCityAsps.filter(
          (nearestCityAsp: any) =>
            nearestCityAsp.city.nearestCity.id == nearestCity.dataValues.id
        );
        nearestCity.dataValues.aspIds = asps.map((asp: any) => asp.id);
      }
      if (nearestCities.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Data not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          totalCount: nearestCityWithoutLimitOffset.length,
          nearestCities: nearestCities,
          exceededExpectationSlaMinData: exceededExpectationSlaMinData,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getAspSlaPerformanceListView = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        nearestCityId: "required|numeric",
        rmIds: "required|array",
        "rmIds.*": "required",
        search: "string",
        limit: "numeric",
        offset: "numeric",
        aspType: "required|numeric", //0-Third Party,1-COCO.
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const aspWhere: any = {};
      if (payload.search) {
        aspWhere[Op.or] = [
          { code: { [Op.like]: `%${payload.search}%` } },
          { name: { [Op.like]: `%${payload.search}%` } },
          { workshopName: { [Op.like]: `%${payload.search}%` } },
        ];
      }
      aspWhere.isOwnPatrol = payload.aspType;
      aspWhere.rmId = {
        [Op.in]: payload.rmIds,
      };

      let limitValue: number = 10;
      if (payload.limit) {
        limitValue = payload.limit;
      }

      let offsetValue: number = 0;
      if (payload.offset) {
        offsetValue = payload.offset;
      }

      const nearestCityAspBaseQuery = {
        attributes: [
          "id",
          "code",
          "name",
          "workshopName",
          "contactNumber",
          "cityId",
        ],
        where: aspWhere,
        include: {
          model: City,
          required: true,
          attributes: ["id", "nearestCityId"],
          include: [
            {
              model: NearestCity,
              required: true,
              attributes: ["id"],
              where: {
                id: payload.nearestCityId,
              },
            },
          ],
        },
        paranoid: false,
      };

      const [
        nearestCityAspWithoutLimitOffset,
        nearestCityAsps,
        exceededExpectationSlaMinData,
      ]: any = await Promise.all([
        Asp.findAll(nearestCityAspBaseQuery),
        Asp.findAll({
          ...nearestCityAspBaseQuery,
          limit: limitValue,
          offset: offsetValue,
        }),
        Config.findOne({
          attributes: ["id", "name"],
          where: {
            typeId: 74, //Exceeded Expectation SLA Mins
          },
        }),
      ]);

      if (nearestCityAsps.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Asp not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          totalCount: nearestCityAspWithoutLimitOffset.length,
          nearestCityAsps: nearestCityAsps,
          exceededExpectationSlaMinData: exceededExpectationSlaMinData,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getServicePerformanceCount = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        rmIds: "required|array",
        "rmIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [asps, exceededExpectationSlaMinData, services]: any =
        await Promise.all([
          Asp.findAll({
            attributes: ["id"],
            where: {
              rmId: {
                [Op.in]: payload.rmIds,
              },
            },
            paranoid: false,
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: {
              typeId: 74, //Exceeded Expectation SLA Mins
            },
          }),
          Service.findAll({
            attributes: ["id", "name"],
          }),
        ]);

      const aspIds = asps.map((asp: any) => asp.id);

      const data = {
        aspIds,
        exceededExpectationSlaMinData,
        services,
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

  getMasterDetails = async (req: any, res: any) => {
    try {
      const payload = req.body;
      let subServiceDetails: any = [];
      if (payload.subServiceIds && payload.subServiceIds.length > 0) {
        const subServices = await SubService.findAll({
          attributes: ["id"],
          where: {
            id: {
              [Op.in]: payload.subServiceIds,
            },
          },
          include: {
            model: Service,
            required: true,
            attributes: ["id", "name"],
          },
          paranoid: false,
        });
        subServiceDetails = subServices.map((subService: any) => ({
          subServiceId: subService.id,
          serviceId: subService.service.id,
          serviceName: subService.service.name,
        }));
      }

      let updatedCities: any = [];
      if (payload.breakdownCities && payload.breakdownCities.length > 0) {
        const cityIds = payload.breakdownCities.map((city: any) => city.id);
        // Fetch all cities
        const cities = await City.findAll({
          attributes: ["id", "locationTypeId"],
          where: {
            id: {
              [Op.in]: cityIds,
            },
          },
          paranoid: false,
        });

        const cityMap = cities.reduce((map: any, city: any) => {
          map[city.id] = city.locationTypeId;
          return map;
        }, {});

        // Fetch SLA settings for each breakdown city concurrently
        const slaPromises = payload.breakdownCities.map(
          async (breakdownCity: any) => {
            const locationTypeId = cityMap[breakdownCity.id];
            if (locationTypeId) {
              const slaSetting = await SlaSetting.findOne({
                attributes: ["id", "time"],
                where: {
                  caseTypeId: 31, // RSA
                  typeId: breakdownCity.typeId, //SLA TYPE ID
                  locationTypeId: locationTypeId,
                },
              });
              breakdownCity.slaTime = slaSetting
                ? slaSetting.dataValues.time
                : null;
            } else {
              breakdownCity.slaTime = null;
            }
            return breakdownCity;
          }
        );
        updatedCities = await Promise.all(slaPromises);
      }

      const exceededExpectationSlaMins = await Config.findOne({
        attributes: ["id", "name"],
        where: {
          typeId: 74, //Exceeded Expectation SLA Mins
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          subServiceDetails,
          updatedCities,
          exceededExpectationSlaMins,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  interactionList = async (req: any, res: any) => {
    try {
      const payload = req.body;

      const interactionDetails = [];
      if (payload.interactions && payload.interactions.length > 0) {
        const interactionTypeIds = [
          ...new Set(
            payload.interactions.map((interaction: any) => interaction.typeId)
          ),
        ];

        const interactionChannelIds = [
          ...new Set(
            payload.interactions.map(
              (interaction: any) => interaction.channelId
            )
          ),
        ];

        const interactionToIds = [
          ...new Set(
            payload.interactions.map((interaction: any) => interaction.toId)
          ),
        ];

        const interactionCallTypeIds = [
          ...new Set(
            payload.interactions.map(
              (interaction: any) => interaction.callTypeId
            )
          ),
        ];

        const configsTableIds = [
          ...interactionTypeIds,
          ...interactionChannelIds,
          ...interactionToIds,
          ...interactionCallTypeIds,
        ];

        const configTableDetails: any = await Config.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: configsTableIds,
            },
          },
        });

        for (const interaction of payload.interactions) {
          const type = configTableDetails.find(
            (configTableDetail: any) =>
              configTableDetail.id === interaction.typeId
          );
          const channel = configTableDetails.find(
            (configTableDetail: any) =>
              configTableDetail.id === interaction.channelId
          );
          const to = configTableDetails.find(
            (configTableDetail: any) =>
              configTableDetail.id === interaction.toId
          );
          const callType = configTableDetails.find(
            (configTableDetail: any) =>
              configTableDetail.id === interaction.callTypeId
          );

          interactionDetails.push({
            id: interaction.id,
            caseDetailId: interaction.caseDetailId,
            activityId: interaction.activityId,
            typeId: interaction.typeId,
            type: type ? type.name : null,
            title: interaction.title,
            description: interaction.description,
            channel: channel ? channel.name : null,
            interactionTo: to ? to.name : null,
            callType: callType ? callType.name : null,
            createdAt: moment
              .tz(interaction.createdAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A"),
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: interactionDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new ManagerController();
