import { Op, Sequelize } from "sequelize";
import { ActivityStatus } from "../database/models/index";
import sequelize from "../database/connection";

class ActivityStatusController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, search, apiType, status } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {
        id: {
          [Op.notIn]: [5, 6, 13], //FAILURE, RE-ASSIGNED, PAYMENT NOT NEED
        },
      };
      let activityStatuses: any;

      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        activityStatuses = await ActivityStatus.findAll({
          where,
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        });
        if (activityStatuses.length === 0) {
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
            { name: { [Op.like]: `%${search}%` } },
            Sequelize.literal(
              `( IF (deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        // Limitation value setup
        let limitValue: number = ActivityStatusController.defaultLimit;
        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = ActivityStatusController.defaultOffset;
        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        activityStatuses = await ActivityStatus.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (activityStatuses.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: activityStatuses,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  public async getOtherServiceStatuses(req: any, res: any) {
    try {
      const activityStatuses = await ActivityStatus.findAll({
        where: {
          id: { [Op.in]: [7, 4, 8] }, //7-Successful,4-Cancelled,8-Rejected
        },
        attributes: ["id", "name"],
        order: [
          sequelize.literal(
            `CASE id
              WHEN 7 THEN 1
              WHEN 4 THEN 2
              WHEN 8 THEN 3
              ELSE 4
            END`
          ),
        ],
      });
      if (activityStatuses.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        data: activityStatuses,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export const getActivityStatus = async (id: any) => {
  try {
    return await ActivityStatus.findOne({
      attributes: ["id", "name"],
      where: { id: id },
    });
  } catch (error: any) {
    throw error;
  }
};

export default new ActivityStatusController();
