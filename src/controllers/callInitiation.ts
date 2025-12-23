import {
  Config,
  Client,
  Disposition,
  CaseSubject,
  Language,
} from "../database/models/index";
import { Request, Response } from "express";
import Utils from "../lib/utils";
import config from "../config/config.json";
import axios from "axios";
import { Op } from "sequelize";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class CallInitiationController {
  constructor() {}

  public getFormData = async (req: Request, res: Response) => {
    try {
      const getUserClients: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getUserClients}`,
        {
          userId: req.body.authUserId,
        }
      );
      let clients: any = [];
      if (getUserClients.data.success) {
        //AGENT
        if (getUserClients.data.user.roleId == 3) {
          clients = await Client.findAll({
            where: {
              id: {
                [Op.in]: getUserClients.data.clientIds,
              },
            },
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          });
        } else {
          clients = await Client.findAll({
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          });
        }
      }

      const [subjects, callFrom, channels, languages] = await Promise.all([
        Config.findAll({
          where: { typeId: 36 },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Config.findAll({
          where: { typeId: 35 },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Config.findAll({
          where: { typeId: 37 },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        Language.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
      ]);

      const data = {
        subjects: subjects,
        clients: clients,
        callFrom: callFrom,
        channels: channels,
        languages: languages,
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  public validateCallInitiationSaveData = async (
    req: Request,
    res: Response
  ) => {
    try {
      let payload = req.body;
      const validateData = {
        subjectId: "required|numeric",
        clientId: "required|numeric",
        callFromId: "required|numeric",
        dispositionId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const subject = await Config.findOne({
        where: { id: payload.subjectId, typeId: 36 },
      });
      if (!subject) {
        return res.status(200).json({
          success: false,
          error: "Subject not found",
        });
      }

      const client = await Client.findOne({ where: { id: payload.clientId } });
      if (!client) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      const callFrom = await Config.findOne({
        where: { id: payload.callFromId, typeId: 35 },
      });
      if (!callFrom) {
        return res.status(200).json({
          success: false,
          error: "Call from detail not found",
        });
      }

      const disposition = await Disposition.findOne({
        where: { id: payload.dispositionId },
      });
      if (!disposition) {
        return res.status(200).json({
          success: false,
          error: "Disposition not found",
        });
      }

      // if (subject && client && callFrom && disposition) {
      //   return res.status(200).json({ success: true });
      // } else {
      //   return res.status(200).json({
      //     success: false,
      //     error: `Mentioned Call Initiation Data not found`,
      //   });
      // }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  getFilterData = async (req: Request, res: Response) => {
    try {
      //EXTRAS
      const getUserClients: any = await axios.post(
        `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getUserClients}`,
        {
          userId: req.body.authUserId,
        }
      );
      let clients: any = [];
      if (getUserClients.data.success) {
        //AGENT
        if (getUserClients.data.user.roleId == 3) {
          clients = await Client.findAll({
            where: {
              id: {
                [Op.in]: getUserClients.data.clientIds,
              },
            },
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          });
        } else {
          clients = await Client.findAll({
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          });
        }
      }

      const [subject, callFrom, disposition, channels, languages]: any =
        await Promise.all([
          Config.findAll({
            where: { typeId: 36 },
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          }),
          Config.findAll({
            where: { typeId: 35 },
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          }),
          Disposition.findAll({
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          }),
          Config.findAll({
            where: { typeId: 37 },
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          }),
          Language.findAll({
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          }),
        ]);

      const data = {
        extras: {
          clients,
          subject,
          callFrom,
          disposition,
          channels,
          languages,
        },
      };
      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getCallInitiationList = async (req: Request, res: Response) => {
    try {
      const inData = req.body;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      //SUBJECT
      const subjectIDs = inData.map((item: any) => item.subjectId);
      const subject = await this.fetchDataAndCheck(
        Config,
        subjectIDs,
        "Subject"
      );
      let subjectObject: any = {};
      if (subject.data) {
        subjectObject = subject.data.reduce((acc: any, subject: any) => {
          acc[subject.id] = subject.dataValues;
          return acc;
        }, {});
      }

      //CLIENT
      let clientIDs = inData.map((item: any) => item.clientId);
      const client = await this.fetchDataAndCheck(Client, clientIDs, "Client");

      let clientObject: any = {};
      if (client.data) {
        clientObject = client.data.reduce((acc: any, client: any) => {
          acc[client.id] = client.dataValues;
          return acc;
        }, {});
      }

      //CALL FROM
      let callerIDs = inData.map((item: any) => item.callFromId);
      const caller = await this.fetchDataAndCheck(Config, callerIDs, "Caller");

      let callerObject: any = {};
      if (caller.data) {
        callerObject = caller.data.reduce((acc: any, call: any) => {
          acc[call.id] = call.dataValues;
          return acc;
        }, {});
      }

      //DISPOSITION
      let dispositionIDs = inData.map((item: any) => item.dispositionId);
      const disposition = await this.fetchDataAndCheck(
        Disposition,
        dispositionIDs,
        "Disposition"
      );

      let dispositionObject: any = {};
      if (disposition.data) {
        dispositionObject = disposition.data.reduce((acc: any, obj: any) => {
          acc[obj.id] = obj.dataValues;
          return acc;
        }, {});
      }

      //CONTACT LANGUAGE
      let contactLanguageIds = inData.map(
        (item: any) => item.contactLanguageId
      );
      const contactLanguage = await this.fetchDataAndCheck(
        Language,
        contactLanguageIds,
        "Contact Language"
      );

      let contactLanguageObject: any = {};
      if (contactLanguage.data) {
        contactLanguageObject = contactLanguage.data.reduce(
          (acc: any, obj: any) => {
            acc[obj.id] = obj.dataValues;
            return acc;
          },
          {}
        );
      }

      //CHANNEL
      let channelIds = inData.map((item: any) => item.channelId);
      const channel = await this.fetchDataAndCheck(
        Config,
        channelIds,
        "Channel"
      );

      let channelObject: any = {};
      if (channel.data) {
        channelObject = channel.data.reduce((acc: any, obj: any) => {
          acc[obj.id] = obj.dataValues;
          return acc;
        }, {});
      }

      let finalData = inData.map((item: any) => {
        return {
          id: item.id,
          contactName: item.contactName,
          mobileNumber: item.mobileNumber,
          subjectName: item.subjectId
            ? subjectObject[item.subjectId]
              ? subjectObject[item.subjectId]["name"]
              : null
            : null,
          clientName: item.clientId
            ? clientObject[item.clientId]
              ? clientObject[item.clientId]["name"]
              : null
            : null,
          callName: item.callFromId
            ? callerObject[item.callFromId]
              ? callerObject[item.callFromId]["name"]
              : null
            : null,
          disposition: item.dispositionId
            ? dispositionObject[item.dispositionId]
              ? dispositionObject[item.dispositionId]["name"]
              : null
            : null,
          contactLanguage: item.contactLanguageId
            ? contactLanguageObject[item.contactLanguageId]
              ? contactLanguageObject[item.contactLanguageId]["name"]
              : null
            : null,
          channel: item.channelId
            ? channelObject[item.channelId]
              ? channelObject[item.channelId]["name"]
              : null
            : null,
          remarks: item.remarks,
          caseNumber: item.caseNumber,
          createdAt: item.createdAt,
        };
      });
      return res.status(200).json({
        success: true,
        message: "success",
        data: finalData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  fetchDataAndCheck = async (model: any, ids: number[], fieldName: string) => {
    const data = await model.findAll({
      where: { id: ids },
      attributes: ["id", "name"],
    });

    return { success: true, data };
  };

  getExportData = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const [
        subjectDetails,
        clientDetails,
        callFromDetails,
        dispositionDetails,
      ]: any = await Promise.all([
        Config.findAll({
          where: { typeId: 36, id: { [Op.in]: payload.subjectIds } },
          attributes: ["id", "name"],
        }),
        Client.findAll({
          where: { id: { [Op.in]: payload.clientIds } },
          attributes: ["id", "name"],
          paranoid: false,
        }),
        Config.findAll({
          where: { typeId: 35, id: { [Op.in]: payload.callFromIds } },
          attributes: ["id", "name"],
        }),
        Disposition.findAll({
          where: { id: { [Op.in]: payload.dispositionIds } },
          attributes: ["id", "name"],
          paranoid: false,
        }),
      ]);

      const data = {
        subjectDetails,
        clientDetails,
        callFromDetails,
        dispositionDetails,
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

export default new CallInitiationController();
