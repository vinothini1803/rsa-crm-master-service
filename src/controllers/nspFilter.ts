import { Request, Response } from "express";
import { NspFilter } from "../database/models";

class NspFilterController {
  constructor() {}

  getByTypeId = async (req: Request, res: Response) => {
    try {
      const { typeId } = req.query;

      const nspFilters: any = await NspFilter.findAll({
        where: { typeId: typeId },
        attributes: ["id", "name", "kmLimit"],
        order: [["displayOrder", "asc"]],
      });

      if (nspFilters.length == 0) {
        return res.status(200).json({
          success: false,
          error: "NSP filter not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: nspFilters,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new NspFilterController();
