import { Op } from "sequelize";
import { Country } from "../database/models/index";

class CountryController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const { limit, offset } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      // Limitation value setup
      let limitValue: number = CountryController.defaultLimit;

      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value
      let offsetValue: number = CountryController.defaultOffset;

      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const countries = await Country.findAll({
        where,
        attributes: ["id", "name"],
        limit: limitValue,
        offset: offsetValue,
      });

      if (countries.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: countries,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new CountryController();
