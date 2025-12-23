import { Op } from "sequelize";
import { CallCenterLocation } from "../database/models/index";

class CallCenterLocationController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const { callCenterId, limit, offset } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      if (callCenterId !== undefined) {
        where.callCenterId = callCenterId;
      }

      // Limitation value setup
      let limitValue: number = CallCenterLocationController.defaultLimit;

      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = CallCenterLocationController.defaultOffset;

      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const callCenterLocation = await CallCenterLocation.findAll({
        where,
        attributes: ["id", "callCenterId"],
        limit: limitValue,
        offset: offsetValue,
      });

      if (callCenterLocation.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: callCenterLocation,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new CallCenterLocationController();
