import { Request, Response } from "express";
import { Client, VehicleMake, VehicleModel } from "../database/models";

class CaseInformationController {
  constructor() {}
  getCaseCreateMasterDetails = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const vehicleMake: any = await VehicleMake.findOne({
        where: { id: payload.makeId },
        attributes: ["id", "name"],
      });
      if (!vehicleMake) {
        return res.status(200).json({
          success: false,
          error: "Vehicle make not found",
        });
      }

      const vehicleModel: any = await VehicleModel.findOne({
        where: { id: payload.modelId },
        attributes: ["id", "name"],
      });
      if (!vehicleModel) {
        return res.status(200).json({
          success: false,
          error: "Vehicle model not found",
        });
      }

      const client: any = await Client.findOne({
        where: { id: payload.clientId },
        attributes: ["id", "name", "customerTollFreeNumber"],
      });
      if (!client) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      const data = {
        vehicleMake,
        vehicleModel,
        client,
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

export default new CaseInformationController();
