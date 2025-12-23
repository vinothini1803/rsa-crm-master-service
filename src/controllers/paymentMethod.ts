import { Op } from "sequelize";
import { PaymentMethod } from "../database/models/index";

class PaymentMethodController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;

  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const { limit, offset, forReimbursement } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      // Limitation value setup
      let limitValue: number = PaymentMethodController.defaultLimit;

      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = PaymentMethodController.defaultOffset;

      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      if (forReimbursement == "true") {
        where.id = { [Op.in]: [3, 4] }; //3-Bank,4-UPI
      } else {
        where.id = { [Op.in]: [1, 2] }; //1-Wallet,2-Razorpay
      }

      const paymentMethods = await PaymentMethod.findAll({
        where,
        attributes: ["id", "name"],
        order: [["id", "asc"]],
        limit: limitValue,
        offset: offsetValue,
      });

      if (paymentMethods.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: paymentMethods,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new PaymentMethodController();
