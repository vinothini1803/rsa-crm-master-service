import { Op } from "sequelize";
import { ConfigType, Config } from "../database/models/index";

class ConfigTypeController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const { limit, offset } = req.query;

      // Limitation value setup
      let limitValue: number = ConfigTypeController.defaultLimit;

      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = ConfigTypeController.defaultOffset;

      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const configTypes = await ConfigType.findAll({
        include: [
          {
            model: Config,
            as: "configs",
            attributes: ["id", "name"],
          },
        ],
        limit: limitValue,
        offset: offsetValue,
      });

      if (configTypes.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: configTypes,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new ConfigTypeController();
