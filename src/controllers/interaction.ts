import { Config } from "../database/models/index";
import { Request, Response } from "express";

class InteractionController {
  constructor() {}

  getFormData = async (req: Request, res: Response) => {
    try {
      //EXTRAS
      const channels = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 26, //CHANNELS
        },
        order: [["id", "asc"]],
      });
      const toTypes = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 27, //INTERACTION TO TYPES
        },
        order: [["id", "asc"]],
      });
      const callTypes = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 28, //INTERACTION CALL TYPES
        },
        order: [["id", "asc"]],
      });

      const data = {
        extras: {
          channels,
          toTypes,
          callTypes,
        },
      };
      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
}

export default new InteractionController();
