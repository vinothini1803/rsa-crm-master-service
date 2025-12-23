import { MailConfiguration } from "../database/models/index";
import { Request, Response } from "express";
import Utils from "../lib/utils";

class MailConfigurationController {
  constructor() {}

  getById = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const validateData = {
        id: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const mailConfigurationExists = await MailConfiguration.findOne({
        where: {
          id: payload.id,
        },
        attributes: ["id", "toEmail", "ccEmail"],
      });
      if (!mailConfigurationExists) {
        return res.status(200).json({
          success: false,
          error: `Mail configuration not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: mailConfigurationExists,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new MailConfigurationController();
