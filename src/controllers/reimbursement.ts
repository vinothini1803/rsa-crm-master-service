import { Request, Response } from "express";
import {
  CaseStatus,
  CaseSubject,
  Config,
  Service,
  SubService,
} from "../database/models";
import moment from "moment-timezone";

class ReimbursementController {
  constructor() {}

  getStatusList = async (req: Request, res: Response) => {
    try {
      const statusList = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 16, //Activity Payment Statuses
        },
      });

      return res.status(200).json({
        success: true,
        data: statusList,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getListMasterData = async (req: Request, res: Response) => {
    try {
      const inData = req.body;
      if (inData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData = await Promise.all(
        inData.map(async (item: any) => {
          const reimbursementTransaction =
            item.activity.reimbursementActivityTransaction;
          const reimbursementPaymentStatusId =
            reimbursementTransaction?.paymentStatusId || null;
          const reimbursementAmount = reimbursementTransaction?.amount || null;

          const [
            caseStatus,
            caseSubject,
            subService,
            caseType,
            accidentType,
            channel,
            policyType,
            reimbursementPaymentStatus,
          ] = await Promise.all([
            CaseStatus.findOne({
              where: { id: item.caseStatusId },
              attributes: ["id", "name"],
              paranoid: false,
            }),
            CaseSubject.findOne({
              where: { id: item.caseSubjectId },
              attributes: ["id", "name"],
              paranoid: false,
            }),
            SubService.findOne({
              where: { id: item.subServiceId },
              attributes: ["id", "name"],
              paranoid: false,
              include: {
                model: Service,
                attributes: ["id", "name"],
                required: true,
                paranoid: false,
              },
            }),
            Config.findOne({
              where: { id: item.caseTypeId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: item.caseAccidentTypeId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: item.caseChannelId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: item.casePolicyTypeId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: reimbursementPaymentStatusId },
              attributes: ["id", "name"],
            }),
          ]);

          return {
            id: item.id,
            caseDetailId: item.caseDetailId,
            caseNumber: item.caseNumber,
            subject: caseSubject?.dataValues.name || null,
            caseStatus: caseStatus?.dataValues.name || null,
            vin: item.caseVin,
            registrationNumber: item.caseRegistrationNumber,
            customerContactName: item.caseCustomerContactName,
            customerMobileNumber: item.caseCustomerMobileNumber,
            customerCurrentContactName: item.caseCustomerCurrentContactName,
            customerCurrentMobileNumber: item.caseCustomerCurrentMobileNumber,
            caseType: caseType?.dataValues.name || null,
            accidentType: accidentType?.dataValues.name || null,
            channel: channel?.dataValues.name || null,
            policyType: policyType?.dataValues.name || null,
            customerType: {
              irateCustomer: item.caseIrateCustomer,
              womenAssist: item.caseWomenAssist,
            },
            service: subService?.dataValues.service.name || null,
            subService: subService?.dataValues.name || null,
            caseCreatedAt: moment
              .tz(item.caseCreatedAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A"),
            reimbursementAmount,
            reimbursementPaymentStatus:
              reimbursementPaymentStatus?.dataValues.name || null,
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: finalData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new ReimbursementController();
