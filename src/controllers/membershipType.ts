import { Op } from "sequelize";
import { MembershipType } from "../database/models/index";

class MembershipTypeController {
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const membershipTypes = await MembershipType.findAll({
        attributes: ["id", "name"],
      });

      if (membershipTypes.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: membershipTypes,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new MembershipTypeController();
