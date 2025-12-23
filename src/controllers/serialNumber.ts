import { Request, Response } from "express";
import { where } from "sequelize";
import {
  FinancialYears,
  SerialNumberGroups,
  SerialNumberCategories,
  SerialNumberGroupSerialNumberSegments,
  Client,
} from "../database/models/index";
import Utils from "../lib/utils";

class serialNumberController {
  constructor() {}

  public async generateCaseSerialNumber(req: Request, res: Response) {
    try {
      const inData: any = req.query;

      const client = await Client.findOne({
        where: { id: inData.clientId },
        attributes: ["id", "deliveryRequestSerialNumberCategoryId"],
      });
      if (!client) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      const serialNumberResponse: any = await Utils.generateSerialNumber(
        client.dataValues.deliveryRequestSerialNumberCategoryId,
        inData.financialYear
      );
      if (!serialNumberResponse.success) {
        return res.status(200).json({
          success: false,
          error: serialNumberResponse.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Serial number generated successfully",
        data: serialNumberResponse.serialNumber,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // GENERIC SERIAL NUMBER BASED ON CATEGORY
  public async generateGenericSerialNumber(req: Request, res: Response) {
    try {
      const inData: any = req.query;
      const serialNumberCategory = await SerialNumberCategories.findOne({
        where: {
          shortName: inData.shortName,
        },
        attributes: ["id", "shortName"],
      });
      if (!serialNumberCategory) {
        return res.status(200).json({
          success: false,
          error: "Serial Number Category not found",
        });
      }

      const serialNumberResponse = await Utils.generateSerialNumber(
        serialNumberCategory.dataValues.id,
        inData.financialYear
      );
      if (!serialNumberResponse.success) {
        return res.status(200).json({
          success: false,
          error: serialNumberResponse.error,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Serial number generated successfully",
        data: serialNumberResponse.serialNumber,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new serialNumberController();
