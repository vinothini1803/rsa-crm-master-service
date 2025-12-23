import { Op } from "sequelize";
import { Address, State, City } from "../database/models/index";

class AddressController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const { limit, offset } = req.query;

      // Limitation value setup
      let limitValue: number = AddressController.defaultLimit;

      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = AddressController.defaultOffset;

      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const addresses = await Address.findAll({
        attributes: ["id", "address", "pincode"],
        include: [
          {
            model: State,
            attributes: ["id", "name"],
          },
          {
            model: City,
            attributes: ["id", "name"],
          },
        ],
        limit: limitValue,
        offset: offsetValue,
      });

      if (addresses.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: addresses,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new AddressController();
