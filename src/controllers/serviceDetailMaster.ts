import { getActivityStatus } from "./activityStatus";
import { getAsp } from "./asp";
import { getAspMechanic } from "./aspMechanic";
import { getConfigByPrimaryId } from "./config";
import { getSubService } from "./subService";
import { getDealer } from "./dealer";
import { getDispositionById } from "./disposition";
import { getAspActivityRejectReason } from "./aspActivityRejectReason";
import { AdditionalCharge } from "../database/models";
import config from "../config/config.json";
import axios from "axios";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class serviceDetailMasterController {
  constructor() {}

  public async getServiceDetailMaster(req: any, res: any) {
    try {
      const activityCharges = req.body.activityCharges;
      let promiseArr: any = [];
      promiseArr.push(getDispositionById(req.body.dispositionId));
      promiseArr.push(getActivityStatus(req.body.activityStatusId));
      promiseArr.push(getSubService(req.body.subServiceId));
      promiseArr.push(getDealer(req.body.dropDealerId));
      promiseArr.push(getConfigByPrimaryId(req.body.dropLocationTypeId));
      promiseArr.push(
        getConfigByPrimaryId(req.body.customerPreferredLocationId)
      );
      promiseArr.push(getAsp(req.body.aspId));
      promiseArr.push(getAspMechanic(req.body.aspMechanicId));
      promiseArr.push(getAspActivityRejectReason(req.body.rejectReasonId));
      promiseArr.push(
        AdditionalCharge.findAll({
          attributes: ["id", "name"],
        })
      );

      const [
        disposition,
        activityStatus,
        subService,
        dropDealer,
        dropLocationType,
        customerPreferredLocation,
        asp,
        aspMechanic,
        rejectReason,
        additionalCharges,
      ]: any = await Promise.all(promiseArr);

      if (activityCharges.length > 0) {
        for (const activityCharge of activityCharges) {
          const additionalChargeExists = additionalCharges.find(
            (additionalCharge: any) =>
              additionalCharge.id == activityCharge.chargeId
          );
          activityCharge.name = additionalChargeExists
            ? additionalChargeExists.dataValues.name
            : null;
        }
      }

      if (asp && asp.rmId) {
        const aspRmResponse = await axios.post(
          `${userServiceUrl}/user/${userServiceEndpoint.getUser}`,
          {
            id: asp.rmId,
          }
        );
        asp.dataValues.rmData = null;
        asp.dataValues.zmData = null;
        asp.dataValues.nmData = null;
        //RM EXISTS
        if (aspRmResponse.data.success) {
          asp.dataValues.rmData = {
            id: aspRmResponse.data.user.id,
            code: aspRmResponse.data.user.code,
            name: aspRmResponse.data.user.name,
            mobileNumber: aspRmResponse.data.user.mobileNumber,
          };

          //ZM EXISTS
          if (aspRmResponse.data.user.serviceZm) {
            asp.dataValues.zmData = {
              id: aspRmResponse.data.user.serviceZm.id,
              code: aspRmResponse.data.user.serviceZm.code,
              name: aspRmResponse.data.user.serviceZm.name,
              mobileNumber: aspRmResponse.data.user.serviceZm.mobileNumber,
            };

            //NM EXISTS
            if (aspRmResponse.data.user.serviceZm.serviceNm) {
              asp.dataValues.nmData = {
                id: aspRmResponse.data.user.serviceZm.serviceNm.id,
                code: aspRmResponse.data.user.serviceZm.serviceNm.code,
                name: aspRmResponse.data.user.serviceZm.serviceNm.name,
                mobileNumber:
                  aspRmResponse.data.user.serviceZm.serviceNm.mobileNumber,
              };
            }
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          disposition,
          activityStatus,
          subService,
          dropDealer,
          dropLocationType,
          customerPreferredLocation,
          asp,
          aspMechanic,
          rejectReason,
          activityCharges,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export default new serviceDetailMasterController();
