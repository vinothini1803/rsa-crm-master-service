import { Op } from "sequelize";
import { Config } from "../database/models/index";

class ConfigController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}

  public async getList(req: any, res: any) {
    try {
      const { typeId, limit, offset } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      if (typeId !== undefined) {
        where.typeId = typeId;
      }

      // Limitation value setup
      let limitValue: number = ConfigController.defaultLimit;

      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value config
      let offsetValue: number = ConfigController.defaultOffset;

      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const configs = await Config.findAll({
        where,
        attributes: ["id", "name"],
        order: [["id", "asc"]],
        limit: limitValue,
        offset: offsetValue,
      });

      if (configs.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: configs,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async getConfigById(req: any, res: any) {
    try {
      const { id } = req.query;
      const config = await Config.findOne({
        where: { id: id },
        attributes: ["id", "name"],
      });

      if (!config) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: config,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async getConfigByName(req: any, res: any) {
    try {
      const { name } = req.query;
      const config = await Config.findOne({
        where: { name: name },
        attributes: ["id", "name"],
      });

      if (!config) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: config,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async checkIfConfigExists(req: any, res: any) {
    try {
      const configs = req.body;
      const keys = Object.keys(configs);
      if (!keys.length) {
        return res.status(200).json({
          success: false,
          error: "Please provide any one config id",
        });
      }
      for (let key of keys) {
        const configExists = await Config.findOne({ where: configs[key] });
        if (!configExists) {
          return res.status(200).json({
            success: false,
            error: `${key} does not exist`,
          });
        }
      }
      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export const getConfig = async (typeId: any) => {
  try {
    return await Config.findAll({
      where: { typeId: typeId },
      attributes: ["id", "name", "typeId"],
      order: [["id", "asc"]],
    });
  } catch (error: any) {
    throw error;
  }
};

export const getConfigByPrimaryId = async (id: any) => {
  try {
    return await Config.findOne({
      attributes: ["id", "name"],
      where: { id: id },
    });
  } catch (error: any) {
    throw error;
  }
};

export const getOneConfig = async (id: any, typeId: any) => {
  try {
    return await Config.findOne({
      where: { id: id, typeId: typeId },
    });
  } catch (error: any) {
    throw error;
  }
};

export default new ConfigController();
