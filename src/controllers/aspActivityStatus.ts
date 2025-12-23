import { Op } from "sequelize";
import { AspActivityStatus } from "../database/models/index";
import { Request, Response } from "express";
import Utils from "../lib/utils";

class AspActivityStatusController {
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const aspActivityStatuses = await AspActivityStatus.findAll({
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      if (aspActivityStatuses.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: aspActivityStatuses,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  getByIds = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const v = {
        ids: "required|array",
        "ids.*": "required",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      if (payload.ids.length == 0) {
        return res.status(200).json({
          success: false,
          error: "ASP activity status IDs are required",
        });
      }

      const aspActivityStatuses = await AspActivityStatus.findAll({
        where: {
          id: {
            [Op.in]: payload.ids,
          },
        },
        attributes: ["id", "name"],
      });
      if (aspActivityStatuses.length == 0) {
        return res.status(200).json({
          success: false,
          error: "ASP activity status not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: aspActivityStatuses,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new AspActivityStatusController();
