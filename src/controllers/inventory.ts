import { Op } from "sequelize";
import { Inventory } from "../database/models/index";

class InventoryController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const { categoryId, limit, offset } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      if (categoryId !== undefined) {
        where.categoryId = categoryId;
      }

      // Limitation value setup
      let limitValue: number = InventoryController.defaultLimit;

      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = InventoryController.defaultOffset;

      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const inventory = await Inventory.findAll({
        where,
        attributes: ["id", "name"],
        order: [["id", "asc"]],
        limit: limitValue,
        offset: offsetValue,
      });

      if (inventory.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: inventory,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new InventoryController();
