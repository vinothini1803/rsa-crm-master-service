import { Op } from "sequelize";
import { ActivityFinanceStatus } from "../database/models/index";

class ActivityFinanceStatusController {
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const activityFinanceStatuses = await ActivityFinanceStatus.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      if (activityFinanceStatuses.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: activityFinanceStatuses,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new ActivityFinanceStatusController();
