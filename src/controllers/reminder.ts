import { Request, Response } from "express";
import { Op } from "sequelize";

import { getConfig } from "./config";
import { ReminderTimeSettings, Service, SubService, Config } from "../database/models";
import Utils from "../lib/utils";

const getReminderTypes = async () => {
  try {
    return await ReminderTimeSettings.findAll({
      attributes: ["id", "name", "value", "valueType", "displayOrder"],
      order: [["displayOrder", "asc"]],
    });
  } catch (error: any) {
    throw error;
  }
};
class ReminderController {
  constructor() {}

  public getFormData = async (req: Request, res: Response) => {
    try {
      const data = {
        priority: await getConfig(49),
        status: await getConfig(51),
        reminder: await getReminderTypes(),
        type: await getConfig(50),
      };
      return res.status(200).json({ success: true, data: data });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  public validateReminderData = async (req: Request, res: Response) => {
    try {
      const reminderTimeSetting: any = await ReminderTimeSettings.findOne({
        where: req.body,
      });
      if (!reminderTimeSetting) {
        return res.status(200).json({
          success: false,
          error: "Reminder Time Setting does not exist",
        });
      }
      return res
        .status(200)
        .json({ success: true, message: "Data fetched successfully" });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  public getReminderListSearchData = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const v = {
        search: "required|string",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [
        services,
        subServices,
        reminderPriorities,
        reminderTypes,
      ]: any = await Promise.all([
        Service.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
          },
          paranoid: false,
        }),
        SubService.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
          },
          paranoid: false,
        }),
        Config.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
            typeId: 49, // Reminder Priorities
          },
          paranoid: false,
        }),
        Config.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
            typeId: 50, // Reminder Types
          },
          paranoid: false,
        }),
      ]);

      let searchDetails = [];

      if (services && services.length > 0) {
        const serviceIds = services.map((service: any) => service.id);
        searchDetails.push({
          type: "service",
          ids: serviceIds,
        });
      }

      if (subServices && subServices.length > 0) {
        const subServiceIds = subServices.map((subService: any) => subService.id);
        searchDetails.push({
          type: "subService",
          ids: subServiceIds,
        });
      }

      if (reminderPriorities && reminderPriorities.length > 0) {
        const reminderPriorityIds = reminderPriorities.map(
          (priority: any) => priority.id
        );
        searchDetails.push({
          type: "reminderPriority",
          ids: reminderPriorityIds,
        });
      }

      if (reminderTypes && reminderTypes.length > 0) {
        const reminderTypeIds = reminderTypes.map((type: any) => type.id);
        searchDetails.push({
          type: "reminderType",
          ids: reminderTypeIds,
        });
      }

      return res.status(200).json({
        success: true,
        searchDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new ReminderController();
