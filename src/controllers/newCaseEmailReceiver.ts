import { Op } from "sequelize";
import { NewCaseEmailReceiver } from "../database/models/index";

class NewCaseEmailReceiverController {
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const newCaseEmailReceivers = await NewCaseEmailReceiver.findAll({
        attributes: ["id", "email"],
      });

      if (newCaseEmailReceivers.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: newCaseEmailReceivers,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new NewCaseEmailReceiverController();
