import { Op } from "sequelize";
import { Config, AdditionalCharge, ConfigType } from "../database/models/index";

class AdditionalChargeController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const { limit, offset, typeId } = req.query;

      const limitOffsetObject: any = {};
      if (limit !== undefined) {
        limitOffsetObject.limit = parseInt(limit);
        limitOffsetObject.offset = offset
          ? parseInt(offset)
          : AdditionalChargeController.defaultOffset;
      }

      const additionalChargeWhere: any = {};
      if (typeId != 152) {
        additionalChargeWhere.id = {
          [Op.notIn]: [8, 9], //EXCEPT SERVICE CHARGES & EXCESS CHARGES
        };
      }

      const additionalCharges = await AdditionalCharge.findAll({
        where: additionalChargeWhere,
        attributes: ["id", "name"],
        order: [["id", "asc"]],
        ...limitOffsetObject,
      });

      if (additionalCharges.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: additionalCharges,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async getMasterData(req: any, res: any) {
    try {
      const inData = req.body;
      if (inData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }
      let charge: any;
      let config: any;
      let configTypes: any;
      const finalData: any = [];
      for (var i = 0; i < inData.length; i++) {
        charge = await AdditionalCharge.findOne({
          where: { id: inData[i].chargeId },
          attributes: ["id", "name"],
        });
        config = await Config.findOne({
          where: { id: inData[i].typeId },
          attributes: ["id", "name"],
        });
        configTypes = await ConfigType.findOne({
          where: { id: config.id },
          attributes: ["id", "name"],
        });

        await finalData.push({
          activityId: inData[i].activityId,
          charge: charge ? charge.dataValues : "",
          typeInfo: {
            configTypes,
            config,
          },
          amount: inData[i].amount,
        });
      }
      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: finalData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new AdditionalChargeController();
