import { Request, Response } from "express";
import {
  CaseStatus,
  CaseSubject,
  Config,
  Service,
  SubService,
} from "../database/models";
import { Op } from "sequelize";
import moment from "moment-timezone";

class DashboardController {
  constructor() {}

  getAgentOnGoingCaseMasterDetails = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const finalData = [];
      if (payload.caseDetails && payload.caseDetails.length > 0) {
        const caseTypeIds: any = [];
        const subjectIds: any = [];
        const primaryServiceIds: any = [];
        const policyTypeIds: any = [];
        const channelIds: any = [];
        const statusIds: any = [];

        for (const caseDetail of payload.caseDetails) {
          if (!caseTypeIds.includes(caseDetail.caseInformation.caseTypeId)) {
            caseTypeIds.push(caseDetail.caseInformation.caseTypeId);
          }

          if (!subjectIds.includes(caseDetail.subjectID)) {
            subjectIds.push(caseDetail.subjectID);
          }

          if (
            !primaryServiceIds.includes(caseDetail.caseInformation.serviceId)
          ) {
            primaryServiceIds.push(caseDetail.caseInformation.serviceId);
          }

          if (
            !policyTypeIds.includes(caseDetail.caseInformation.policyTypeId)
          ) {
            policyTypeIds.push(caseDetail.caseInformation.policyTypeId);
          }

          if (!channelIds.includes(caseDetail.caseInformation.channelId)) {
            channelIds.push(caseDetail.caseInformation.channelId);
          }

          if (!statusIds.includes(caseDetail.statusId)) {
            statusIds.push(caseDetail.statusId);
          }
        }

        const [
          caseTypes,
          subjects,
          primaryServices,
          policyTypes,
          channels,
          statuses,
        ]: any = await Promise.all([
          Config.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: caseTypeIds,
              },
            },
          }),
          CaseSubject.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: subjectIds,
              },
            },
            paranoid: false,
          }),
          Service.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: primaryServiceIds,
              },
            },
            paranoid: false,
          }),
          Config.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: policyTypeIds,
              },
            },
          }),
          Config.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: channelIds,
              },
            },
          }),
          CaseStatus.findAll({
            attributes: ["id", "name"],
            where: {
              id: {
                [Op.in]: statusIds,
              },
            },
            paranoid: false,
          }),
        ]);

        for (const caseDetail of payload.caseDetails) {
          const caseType = caseTypes.find(
            (caseType: any) =>
              caseType.id === caseDetail.caseInformation.caseTypeId
          );

          const subject = subjects.find(
            (subject: any) => subject.id === caseDetail.subjectID
          );

          const service = primaryServices.find(
            (primaryService: any) =>
              primaryService.id === caseDetail.caseInformation.serviceId
          );

          const policyType = policyTypes.find(
            (policyType: any) =>
              policyType.id === caseDetail.caseInformation.policyTypeId
          );

          const channel = channels.find(
            (channel: any) =>
              channel.id === caseDetail.caseInformation.channelId
          );

          const status = statuses.find(
            (status: any) => status.id === caseDetail.statusId
          );

          finalData.push({
            caseId: caseDetail.id,
            caseNumber: caseDetail.caseNumber,
            caseType: caseType ? caseType.name : null,
            subject: subject ? subject.name : null,
            customerCurrentContactName:
              caseDetail.caseInformation.customerCurrentContactName,
            service: service ? service.name : null,
            registrationNumber: caseDetail.registrationNumber,
            policyType: policyType ? policyType.name : null,
            channel: channel ? channel.name : null,
            voiceOfCustomer: caseDetail.caseInformation.voiceOfCustomer,
            status: status ? status.name : null,
            statusId: status ? status.id : null,
            createdAt: moment
              .tz(caseDetail.createdAt, "Asia/Kolkata")
              .format("MMM D, hh:mm A"),
          });
        }
      }

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

  getAgentServiceCountMasterDetails = async (req: Request, res: Response) => {
    try {
      const payload = req.body;

      const [services, subServices]: any = await Promise.all([
        Service.findAll({
          attributes: ["id", "name"],
        }),
        SubService.findAll({
          attributes: ["id", "serviceId"],
          where: {
            id: {
              [Op.in]: payload.subServiceIds,
            },
          },
          include: {
            model: Service,
            attributes: ["id", "name"],
            required: true,
            paranoid: false,
          },
          paranoid: false,
        }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          services,
          subServices,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new DashboardController();
