import { Op } from "sequelize";
import { RazorpayPaymentStatus } from "../database/models/index";

class RazorpayPaymentStatusController {
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const razorpayPaymentStatuses = await RazorpayPaymentStatus.findAll({
        attributes: ["id", "name"],
      });

      if (razorpayPaymentStatuses.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: razorpayPaymentStatuses,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new RazorpayPaymentStatusController();
