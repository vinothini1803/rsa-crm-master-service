import { Request, Response } from "express";
import { Asp, SubService } from "../database/models";

class OtherServiceController {
  constructor() {}

  getMasterDetails = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      let asp = null;
      if (payload.aspId) {
        asp = await Asp.findOne({
          attributes: ["id", "code", "name", "workshopName", "contactNumber"],
          where: {
            id: payload.aspId,
          },
        });

        if (!asp) {
          return res.status(200).json({
            success: false,
            error: "Asp not found",
          });
        }
      }

      let serviceSubServices = null;
      if (payload.serviceId) {
        serviceSubServices = await SubService.findAll({
          attributes: ["id"],
          where: {
            serviceId: payload.serviceId,
          },
          paranoid: false,
        });

        if (!serviceSubServices) {
          return res.status(200).json({
            success: false,
            error: "Service sub services not found",
          });
        }
      }

      const data = {
        asp,
        serviceSubServices,
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new OtherServiceController();
