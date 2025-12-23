import { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../database/connection";
import { Asp, CaseStatus, Client, Config, Dealer } from "../database/models";
import Utils from "../lib/utils";
import axios from "axios";
import config from "../config/config.json";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class TemplateController {
  constructor() {}

  //USED IN SEND NOTIFICATION / TEMPLATE DETAIL APIS / PREVIEW APIS
  getMasterDetails = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const userQueries: any = [];

      let index = 0;
      for (const masterQuery of payload.masterQueries) {
        index++;
        const sqlResult: any = await sequelize.query(masterQuery.query, {
          type: QueryTypes.SELECT,
        });

        masterQuery.queryResult = [];
        if (sqlResult && sqlResult.length > 0) {
          if (masterQuery.hasSubMapping) {
            //HAVE MAPPING THEN CALL OTHER SERVICE AND GET DETAILS
            // const [masterQueryVariable] = Object.values(sqlResult[0]);
            let masterQueryVariable: any = "";
            if (sqlResult.length > 1) {
              masterQueryVariable = sqlResult
                .map((sqlResultData: any) => {
                  const firstKey = Object.keys(sqlResultData)[0]; // Get the first key
                  return sqlResultData[firstKey]; // Return the value of the first key
                })
                .join(",");
            } else {
              const [sqlResultValue] = Object.values(sqlResult[0]);
              masterQueryVariable = sqlResultValue;
            }

            if (masterQueryVariable) {
              const subMappingQueryFinal = masterQuery.subMappingQuery.replace(
                "?",
                masterQueryVariable
              );

              if (masterQuery.subMappingService == "user") {
                userQueries.push({
                  index: index,
                  query: subMappingQueryFinal,
                  userRoleId: masterQuery.userRoleId,
                });
              }
            }
          } else {
            //NOT HAVE MAPPING THEN DIRECTLY ACCESS RESULTS
            masterQuery.queryResult = Object.values(sqlResult);
          }
        }
      }

      if (userQueries.length > 0) {
        const userServiceResponse = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.templateGetMasterDetails}`,
          {
            userQueries: userQueries,
          }
        );
        if (userServiceResponse.data.success) {
          userServiceResponse.data.data.forEach((userDetail: any) => {
            payload.masterQueries[userDetail.index - 1].queryResult =
              userDetail;
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: payload.masterQueries,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getFormDataDetails = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const types = await Config.findAll({
        attributes: ["id", "name"],
        where: {
          typeId: 64, //Template Types
        },
      });

      const caseStatus = payload.caseStatusId
        ? await Utils.findByModelId(CaseStatus, payload.caseStatusId, [
            "id",
            "name",
          ])
        : null;

      const dropDealer = payload.dropDealerId
        ? await Utils.findByModelId(Dealer, payload.dropDealerId, [
            "id",
            "name",
          ])
        : null;

      let sendToRoles = null;
      if (payload.sendToRoleIds && payload.sendToRoleIds.length > 0) {
        const userServiceResponse: any = await axios.post(
          `${userServiceUrl}/role/${userServiceEndpoint.roleMaster.getDetailByIds}`,
          {
            roleIds: payload.sendToRoleIds,
          }
        );
        if (userServiceResponse.data.success) {
          sendToRoles = userServiceResponse.data.data;
        }
      }

      const data = {
        types,
        caseStatus,
        dropDealer,
        sendToRoles,
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

  getSeederDetails = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      let clientData = null;
      if (payload.client) {
        clientData = await Client.findOne({
          attributes: ["id"],
          where: {
            name: payload.client,
          },
          paranoid: false,
        });
      }

      let typeData = null;
      if (payload.type) {
        typeData = await Config.findOne({
          where: {
            name: payload.type,
            typeId: 64, //TEMPLATE TYPES
          },
        });
      }

      let inputTypeData = null;
      if (payload.inputType) {
        inputTypeData = await Config.findOne({
          where: {
            name: payload.inputType,
            typeId: 67, //Template Input Types
          },
        });
      }

      const data = {
        clientData,
        typeData,
        inputTypeData,
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

export default new TemplateController();
