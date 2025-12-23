import { Op, Sequelize } from "sequelize";
import { Request, Response } from "express";
import moment from "moment-timezone";
import {
  Asp,
  State,
  City,
  SubService,
  Config,
  Client,
  CaseSubject,
  VehicleType,
  VehicleMake,
  VehicleModel,
  AspActivityStatus,
  ActivityStatus,
  Dealer,
  ConfigType,
  CaseStatus,
  CaseCancelReason,
  AdditionalCharge,
  PolicyPremium,
  Service,
  ConditionOfVehicle,
  Disposition,
  Language,
  CallCenter,
  ManualLocationReason,
  FuelType,
  SlaSetting,
  Company,
} from "../database/models/index";
import configType from "../database/models/configType";
import { Validator } from "node-input-validator";
import axios from "axios";
import { getSubjectServiceDetails } from "./service";
import Utils from "../lib/utils";
import config from "../config/config.json";

//API with endpoint (Case Service);
const caseServiceUrl = `${config.caseService.host}:${config.caseService.port}/${config.caseService.version}/${config.caseService.serviceAccess.case}`;
const caseEndpoint = config.caseService.endpoint;

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

export namespace CaseDataController {
  // VEHICLE DELIVERY FORM MASTER DATA VALIDATION
  export async function vehicleDeliveryFormValidation(
    req: Request,
    res: Response
  ) {
    try {
      const inData = req.body;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      //VALIDATIONS
      const v = {
        typeId: "required|numeric",
        clientId: "required|numeric",
        registrationNumber: "string|maxLength:10",
        vin: "required|string|maxLength:17",
        vehicleTypeId: "required|numeric",
        vehicleMakeId: "required|numeric",
        vehicleModelId: "required|numeric",
        // approximateVehicleValue: "required",
        subjectID: "required|numeric",
        deliveryRequestSubServiceId: "required|numeric",
        deliveryRequestSchemeId: "required|numeric",
        locationTypeId: "requiredIf:deliveryRequestSchemeId,22|numeric",
        dealerId: "numeric",
        deliveryRequestDropDealerId: "numeric",
        pickupLatitude: "requiredIf:locationTypeId,451|string|maxLength:60",
        pickupLongitude: "requiredIf:locationTypeId,451|string|maxLength:60",
        pickupLocation: "requiredIf:locationTypeId,451|string",
        pickupStateId: "requiredIf:locationTypeId,451|numeric",
        pickupCityId: "requiredIf:locationTypeId,451|numeric",
        dropLatitude: "requiredIf:locationTypeId,451|string|maxLength:60",
        dropLongitude: "requiredIf:locationTypeId,451|string|maxLength:60",
        dropLocation: "requiredIf:locationTypeId,451|string",
        dropStateId: "requiredIf:locationTypeId,451|numeric",
        dropCityId: "requiredIf:locationTypeId,451|numeric",
        contactNameAtPickUp: "required|string|minLength:3|maxLength:255",
        contactNumberAtPickUp: "required|string|minLength:10|maxLength:10",
        contactNameAtDrop: "required|string|minLength:3|maxLength:255",
        contactNumberAtDrop: "required|string|minLength:10|maxLength:10",
        deliveryRequestPickupDate: "required|string",
        deliveryRequestPickupTime: "required|string|maxLength:60",
        description: "required|string",
        hasDocuments: "required|boolean",
        attachmentId: "nullable",
        statusId: "required|numeric",
        deliveryRequestCreatedDealerId: "required|numeric",
        createdById: "required|numeric",
        createdBy: "required|string",
      };

      const errors = await Utils.validateParams(inData, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          error: errors.join(", "),
        });
      }

      // PICKUP AND DROP DEALER IS REQUIRED IF SCHEME IS OEM OR (SCHEME IS DEALER AND LOCATION TYPE IS DEALER)
      if (
        inData.deliveryRequestSchemeId == 21 ||
        (inData.deliveryRequestSchemeId == 22 && inData.locationTypeId == 452)
      ) {
        if (!inData.dealerId) {
          return res.status(200).json({
            success: false,
            error: "Pickup dealer is required",
          });
        }
        if (!inData.deliveryRequestDropDealerId) {
          return res.status(200).json({
            success: false,
            error: "Drop dealer is required",
          });
        }
      }

      const [
        caseType,
        client,
        caseSubject,
        vehicleType,
        vehicleMake,
        vehicleModel,
        deliveryRequestSubService,
        deliveryRequestScheme,
        dealer,
        deliveryRequestDropDealer,
      ]: any = await Promise.all([
        Config.findOne({
          where: {
            id: inData.typeId,
            typeId: 4,
          },
          attributes: ["id"],
        }),
        Client.findOne({
          where: { id: inData.clientId },
          attributes: ["id", "name"],
        }),
        CaseSubject.findOne({
          where: { id: inData.subjectID, clientId: inData.clientId },
          attributes: ["id", "name"],
        }),
        VehicleType.findOne({
          where: { id: inData.vehicleTypeId },
          attributes: ["id", "name"],
        }),
        VehicleMake.findOne({
          where: { id: inData.vehicleMakeId },
          attributes: ["id", "name"],
        }),
        VehicleModel.findOne({
          where: {
            id: inData.vehicleModelId,
            vehicleMakeId: inData.vehicleMakeId,
          },
          attributes: ["id", "name"],
        }),
        SubService.findOne({
          where: { id: inData.deliveryRequestSubServiceId },
          attributes: ["id", "name"],
        }),
        Config.findOne({
          where: {
            id: inData.deliveryRequestSchemeId,
            typeId: 3,
          },
          attributes: ["id", "name"],
        }),
        inData?.dealerId
          ? Dealer.findOne({
            where: { id: inData.dealerId },
            attributes: ["id", "name"],
          })
          : null,
        inData?.deliveryRequestDropDealerId
          ? Dealer.findOne({
            where: { id: inData.deliveryRequestDropDealerId },
            attributes: ["id", "name"],
          })
          : null,
      ]);

      if (!caseType) {
        return res.status(200).json({
          success: false,
          error: "Case type not found",
        });
      }

      if (!client) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      if (!caseSubject) {
        return res.status(200).json({
          success: false,
          error: "Service request not found",
        });
      }

      if (!vehicleType) {
        return res.status(200).json({
          success: false,
          error: "Vehicle type not found",
        });
      }

      if (!vehicleMake) {
        return res.status(200).json({
          success: false,
          error: "Vehicle make not found",
        });
      }

      if (!vehicleModel) {
        return res.status(200).json({
          success: false,
          error: "Vehicle model not found",
        });
      }

      if (!deliveryRequestSubService) {
        return res.status(200).json({
          success: false,
          error: "Sub service not found",
        });
      }

      if (!deliveryRequestScheme) {
        return res.status(200).json({
          success: false,
          error: "Scheme not found",
        });
      }

      // PICKUP AND DROP DEALER IS REQUIRED IF SCHEME IS OEM OR (SCHEME IS DEALER AND LOCATION TYPE IS DEALER)
      if (
        inData.deliveryRequestSchemeId == 21 ||
        (inData.deliveryRequestSchemeId == 22 && inData.locationTypeId == 452)
      ) {
        if (!dealer) {
          return res.status(200).json({
            success: false,
            error: "Pickup dealer not found",
          });
        }

        if (!deliveryRequestDropDealer) {
          return res.status(200).json({
            success: false,
            error: "Drop dealer not found",
          });
        }
      }

      // DEALER SCHEME AND LOCATION TYPE IS CUSTOMER MEANS
      if (
        inData.deliveryRequestSchemeId &&
        inData.deliveryRequestSchemeId == 22 &&
        inData.locationTypeId &&
        inData.locationTypeId == 451
      ) {
        const [
          locationType,
          deliveryRequestPickupState,
          deliveryRequestPickupCity,
          deliveryRequestDropState,
          deliveryRequestDropCity,
        ]: any = await Promise.all([
          Config.findOne({
            attributes: ["id"],
            where: {
              id: inData.locationTypeId,
              typeId: 42,
            },
          }),
          State.findOne({
            where: {
              id: inData.pickupStateId,
            },
            attributes: ["id", "name"],
          }),
          City.findOne({
            where: {
              id: inData.pickupCityId,
              stateId: inData.pickupStateId,
            },
            attributes: ["id", "name"],
          }),
          State.findOne({
            where: {
              id: inData.dropStateId,
            },
            attributes: ["id", "name"],
          }),
          City.findOne({
            where: {
              id: inData.dropCityId,
              stateId: inData.dropStateId,
            },
            attributes: ["id", "name"],
          }),
        ]);

        if (!locationType) {
          return res.status(200).json({
            success: false,
            error: "Location type not found",
          });
        }

        if (!deliveryRequestPickupState) {
          return res.status(200).json({
            success: false,
            error: "Pickup state not found",
          });
        }

        if (!deliveryRequestPickupCity) {
          return res.status(200).json({
            success: false,
            error: "Pickup city not found",
          });
        }

        if (!deliveryRequestDropState) {
          return res.status(200).json({
            success: false,
            error: "Drop state not found",
          });
        }

        if (!deliveryRequestDropCity) {
          return res.status(200).json({
            success: false,
            error: "Drop city not found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "success",
        data: {
          vehicleMakeName: vehicleMake ? vehicleMake.dataValues.name : null,
          vehicleModelName: vehicleModel ? vehicleModel.dataValues.name : null,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET CASE DETAILS
  export async function getData(req: Request, res: Response) {
    try {
      const inData = req.body;

      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData: any = [];
      const client = await Client.findOne({
        where: { id: inData.clientId },
        attributes: ["id", "name", "dialerCampaignName"],
      });
      const dealer = await Dealer.findOne({
        where: { id: inData.dealerId },
        attributes: ["id", "name", "email"],
        paranoid: false,
      });
      const deliveryRequestScheme = await Config.findOne({
        where: { id: inData.deliveryRequestSchemeId },
        attributes: ["id", "name"],
      });
      const deliveryRequestType = await Config.findOne({
        where: { id: inData.typeId },
        attributes: ["id", "name"],
      });
      const caseSubject = await CaseSubject.findOne({
        where: { id: inData.subjectID },
        attributes: ["id", "name"],
      });
      const deliveryRequestSubService = await SubService.findOne({
        where: { id: inData.deliveryRequestSubServiceId },
        attributes: ["id", "name"],
      });
      const vehicleType = await VehicleType.findOne({
        where: { id: inData.vehicleTypeId },
        attributes: ["id", "name"],
      });
      const vehicleMake = await VehicleMake.findOne({
        where: { id: inData.vehicleMakeId },
        attributes: ["id", "name"],
      });
      const vehicleModel = await VehicleModel.findOne({
        where: { id: inData.vehicleModelId },
        attributes: ["id", "name"],
      });
      const caseStatus = await CaseStatus.findOne({
        where: { id: inData.statusId },
        attributes: ["id", "name"],
      });
      const caseCancelReason = await CaseCancelReason.findOne({
        where: { id: inData.cancelReasonId },
        attributes: ["id", "name"],
      });
      const deliveryRequestPickupState = await State.findOne({
        where: {
          id: inData.deliveryRequestPickUpStateId,
        },
        attributes: ["id", "name"],
        paranoid: false,
      });
      const deliveryRequestDropState = await State.findOne({
        where: {
          id: inData.deliveryRequestDropStateId,
        },
        attributes: ["id", "name"],
        paranoid: false,
      });
      const deliveryRequestPickUpCity = await City.findOne({
        where: {
          id: inData.deliveryRequestPickUpCityId,
        },
        attributes: ["id", "name"],
        paranoid: false,
      });
      const deliveryRequestDropCity = await City.findOne({
        where: {
          id: inData.deliveryRequestDropCityId,
        },
        attributes: ["id", "name"],
        paranoid: false,
      });
      const deliveryRequestDropDealer = await Dealer.findOne({
        where: { id: inData.deliveryRequestDropDealerId },
        attributes: ["id", "name", "email"],
        paranoid: false,
      });
      const deliveryRequestCreatedDealer = await Dealer.findOne({
        where: { id: inData.deliveryRequestCreatedDealerId },
        attributes: ["id", "name", "email"],
        paranoid: false,
      });
      const locationType = await Config.findOne({
        where: { id: inData.locationTypeId },
        attributes: ["id", "name"],
      });

      const slaSettingDetails = await SlaSetting.findAll({
        attributes: ["id", "typeId", "time"],
        where: { caseTypeId: inData.typeId },
      });
      const slaSettings = slaSettingDetails.map((slaSettingDetail: any) => ({
        ...slaSettingDetail.toJSON(),
        timeInMilliSeconds: slaSettingDetail.time * 1000,
      }));

      const extras = {
        slaSettings,
      };

      await finalData.push({
        caseDetailId: inData.id,
        caseNumber: inData.caseNumber,
        agentId: inData.agentId,
        clientId: inData.clientId,
        client: client ? client.dataValues.name : null,
        dialerCampaignName: client
          ? client.dataValues.dialerCampaignName
          : null,
        dealerId: dealer ? dealer.dataValues.id : null,
        dealer: dealer ? dealer.dataValues.name : null,
        dealerEmail: dealer ? dealer.dataValues.email : null,
        scheme: deliveryRequestScheme
          ? deliveryRequestScheme.dataValues.name
          : null,
        type: deliveryRequestType ? deliveryRequestType.dataValues.name : null,
        caseSubject: caseSubject ? caseSubject.dataValues.name : null,
        subService: deliveryRequestSubService
          ? deliveryRequestSubService.dataValues.name
          : null,
        subServiceId: deliveryRequestSubService
          ? deliveryRequestSubService.dataValues.id
          : null,
        vehicleType: vehicleType ? vehicleType.dataValues.name : null,
        vehicleMakeId: inData.vehicleMakeId,
        vehicleMake: vehicleMake ? vehicleMake.dataValues.name : null,
        vehicleModel: vehicleModel ? vehicleModel.dataValues.name : null,
        approximateVehicleValue: inData.approximateVehicleValue
          ? Utils.convertToIndianCurrencyFormat(
            parseFloat(inData.approximateVehicleValue)
          )
          : null,
        registrationNumber: inData.registrationNumber
          ? inData.registrationNumber
          : null,
        vin: inData.vin,
        caseStatusId: caseStatus ? caseStatus.dataValues.id : null,
        caseStatus: caseStatus ? caseStatus.dataValues.name : null,
        caseCancelReason: caseCancelReason
          ? caseCancelReason.dataValues.name
          : null,
        deliveryRequestPickUpLocation: inData.deliveryRequestPickUpLocation,
        deliveryRequestPickUpState: deliveryRequestPickupState
          ? deliveryRequestPickupState.dataValues.name
          : null,
        deliveryRequestPickUpStateId: deliveryRequestPickupState
          ? deliveryRequestPickupState.dataValues.id
          : null,
        deliveryRequestPickUpCity: deliveryRequestPickUpCity
          ? deliveryRequestPickUpCity.dataValues.name
          : null,
        deliveryRequestPickUpCityId: deliveryRequestPickUpCity
          ? deliveryRequestPickUpCity.dataValues.id
          : null,
        deliveryRequestDropDealer: deliveryRequestDropDealer
          ? deliveryRequestDropDealer.dataValues.name
          : null,
        deliveryRequestDropDealerEmail: deliveryRequestDropDealer
          ? deliveryRequestDropDealer.dataValues.email
          : null,
        deliveryRequestDropLocation: inData.deliveryRequestDropLocation,
        deliveryRequestDropState: deliveryRequestDropState
          ? deliveryRequestDropState.dataValues.name
          : null,
        deliveryRequestDropStateId: deliveryRequestDropState
          ? deliveryRequestDropState.dataValues.id
          : null,
        deliveryRequestDropCity: deliveryRequestDropCity
          ? deliveryRequestDropCity.dataValues.name
          : null,
        deliveryRequestDropCityId: deliveryRequestDropCity
          ? deliveryRequestDropCity.dataValues.id
          : null,
        deliveryRequestPickupDate: inData.deliveryRequestPickupDate
          ? moment
            .tz(inData.deliveryRequestPickupDate, "Asia/Kolkata")
            .format("DD/MM/YYYY")
          : null,
        deliveryRequestPickupTime: inData.deliveryRequestPickupTime,
        createdAt: moment
          .tz(inData.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        createdAtInMilliSeconds: moment
          .tz(inData.createdAt, "Asia/Kolkata")
          .valueOf(),
        contactNameAtPickUp: inData.contactNameAtPickUp,
        contactNumberAtPickUp: inData.contactNumberAtPickUp,
        contactNameAtDrop: inData.contactNameAtDrop,
        contactNumberAtDrop: inData.contactNumberAtDrop,
        description: inData.description,
        hasDocuments: inData.hasDocuments,
        deliveryRequestCreatedDealerId: inData.deliveryRequestCreatedDealerId,
        deliveryRequestSchemeId: inData.deliveryRequestSchemeId,
        locationTypeId: inData.locationTypeId,
        locationType: locationType ? locationType.dataValues.name : null,
        deliveryRequestCreatedDealer: deliveryRequestCreatedDealer
          ? deliveryRequestCreatedDealer
          : null,
        activityDetails: inData.activities,
        agentAssignedAt: inData.agentAssignedAt
          ? moment
            .tz(inData.agentAssignedAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        agentAssignedAtInMilliSeconds: inData.agentAssignedAt
          ? moment.tz(inData.agentAssignedAt, "Asia/Kolkata").valueOf()
          : null,
        positiveActivityExists: inData.positiveActivityExists,
        extras,
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
  }

  //GET ATTACHEMENT INFO
  export async function getAttachementInfo(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }
      // Initialize an array to store the transformed data
      let finalData: any = [];

      for (let i = 0; i < inData.length; i++) {
        // Get the original data from the request
        const originalData = inData[i];

        // Fetch additional data from the database
        let attachmentType = await Config.findOne({
          where: { id: originalData.attachmentTypeId },
          attributes: ["id", "name", "typeId"],
        });

        let attachmentOf = await Config.findOne({
          where: { id: originalData.attachmentOfId },
          attributes: ["id", "name", "typeId"],
        });

        // Create an object that combines the original data with nested objects
        const data = {
          id: originalData.id,
          fileName: originalData.fileName,
          originalName: originalData.originalName,
          imageUrl: originalData.imageUrl,
          attachmentTypeId: originalData.attachmentTypeId,
          attachmentType: attachmentType
            ? attachmentType.dataValues.name
            : null,
          attachmentOfId: originalData.attachmentOfId,
          attachmentOf: attachmentOf ? attachmentOf.dataValues.name : null,
        };

        // Add the combined data to the final array
        finalData.push(data);
      }

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
  }

  export async function getAdditionalChargeAttachmentInfo(
    req: Request,
    res: Response
  ) {
    try {
      const inData = req.body;
      if (!inData || !Array.isArray(inData)) {
        return res.status(200).json({
          success: false,
          error: "Invalid or no data found",
        });
      }

      const finalData: any = [];

      for (const originalData of inData) {
        const { activityId, chargeId, id, fileName, originalName } =
          originalData;

        let additionalCharge = await AdditionalCharge.findOne({
          where: { id: chargeId },
          attributes: ["id", "name"],
        });

        if (additionalCharge) {
          const existingAdditionalCharges = finalData.find(
            (data: any) => data.chargeId === chargeId
          );

          if (existingAdditionalCharges) {
            //PUSH NEW FILES TO SPECIFIC CHARGE IN THE FINAL DATA ARRAY SINCE EXISTING ADDTIONAL CHARGES ARE REFERENCE OF FINAL DATA
            existingAdditionalCharges.files.push({
              id,
              fileName,
              originalName,
            });
          } else {
            finalData.push({
              activityId,
              chargeId,
              chargeName: additionalCharge.dataValues.name,
              files: [{ id, fileName, originalName }],
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "Attachment listed successfully",
        data: finalData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getCaseList(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }
      let subjectIDs = inData.map((item: any) => item.subjectID);
      const subjectName: any = await CaseSubject.findAll({
        where: { id: subjectIDs },
        attributes: ["id", "name"],
      });
      if (subjectName.length === 0) {
        return res.status(200).json({
          success: false,
          message: "Subject id not found",
        });
      }
      const subjectObject = subjectName.reduce((acc: any, subject: any) => {
        acc[subject.id] = subject.dataValues;
        return acc;
      }, {});
      let statusIDs = inData.map((item: any) => item.statusId);
      const statusName: any = await CaseStatus.findAll({
        where: { id: statusIDs },
        attributes: ["id", "name"],
      });
      const statusObject = statusName.reduce((acc: any, status: any) => {
        acc[status.id] = status.dataValues;
        return acc;
      }, {});
      if (statusName.length === 0) {
        return res.status(200).json({
          success: false,
          message: "Status id found",
        });
      }
      let finalData = inData.map((item: any) => {
        let subject = item.subjectID;
        let status = item.statusId;
        const caseInfo = item.caseInformations?.[0] || {};
        return {
          caseId: item.caseNumber,
          vehicleNo: item.registrationNumber,
          vin: item.vin,
          subject: subjectObject[subject]?.["name"] || null,
          status: statusObject[status]?.["name"] || null,
          currentContactName: caseInfo.customerCurrentContactName,
          currentMobileNumber: caseInfo.customerCurrentMobileNumber,
          account: caseInfo.customerContactName,
          location: caseInfo.breakdownLocation,
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
  }

  export async function lorryReceiptMasterDetail(req: Request, res: Response) {
    try {
      const inData = req.body;
      const finalData: any = [];

      const [company, vehicleModel, pickupDealer, dropDealer]: any =
        await Promise.all([
          Company.findOne({
            where: { id: 1 },
            attributes: ["id", "name", "gstin", "address"],
            paranoid: false,
          }),
          VehicleModel.findOne({
            where: { id: inData.caseDetail.vehicleModelId },
            attributes: ["id", "name"],
            paranoid: false,
          }),
          inData.caseDetail.dealerId
            ? Dealer.findOne({
              where: { id: inData.caseDetail.dealerId },
              attributes: ["id", "name", "gstin"],
              paranoid: false,
            })
            : Promise.resolve(null),
          inData.caseDetail.deliveryRequestDropDealerId
            ? Dealer.findOne({
              where: { id: inData.caseDetail.deliveryRequestDropDealerId },
              attributes: ["id", "name", "gstin"],
              paranoid: false,
            })
            : Promise.resolve(null),
        ]);

      const [startTime, endTime] =
        inData.caseDetail.deliveryRequestPickupTime.split(" - ");
      const deliveryRequestPickupDateTime = moment
        .tz(
          `${inData.caseDetail.deliveryRequestPickupDate} ${endTime}`,
          "YYYY-MM-DD h A",
          "Asia/Kolkata"
        )
        .format("YYYY-MM-DD HH:mm:ss");

      await finalData.push({
        companyName: company ? company.name : null,
        companyGstin: company ? company.gstin : null,
        companyAddress: company ? company.address : null,
        locationTypeId: inData.caseDetail.locationTypeId,
        pickupDealer: pickupDealer ? pickupDealer.name : null,
        pickupLocation: inData.caseDetail.deliveryRequestPickUpLocation,
        pickupDealerGstin: pickupDealer ? pickupDealer.gstin : null,
        dropDealer: dropDealer ? dropDealer.name : null,
        dropLocation: inData.caseDetail.deliveryRequestDropLocation,
        dropDealerGstin: dropDealer ? dropDealer.gstin : null,
        deliveryRequestPickupDate: inData.caseDetail.deliveryRequestPickupDate
          ? moment
            .tz(inData.caseDetail.deliveryRequestPickupDate, "Asia/Kolkata")
            .format("DD/MM/YYYY")
          : null,
        caseNumber: inData.caseDetail.caseNumber,
        aspVehicleRegistrationNumber:
          inData.activityAspDetail.aspVehicleRegistrationNumber,

        //CONSIDER DELIVERY REQUEST PICKUP DATE TIME AS ASP REACHED PICKUP LOCATION DATE TIME - REQUIREMENT BY BUSINESS TEAM
        aspReachedToPickupAt: deliveryRequestPickupDateTime
          ? moment
            .tz(deliveryRequestPickupDateTime, "Asia/Kolkata")
            .format("DD/MM/YYYY, hh:mm A")
          : null,
        aspReachedToPickupDate: inData.caseDetail.deliveryRequestPickupDate
          ? moment
            .tz(inData.caseDetail.deliveryRequestPickupDate, "Asia/Kolkata")
            .format("DD/MM/YYYY")
          : null,

        vin: inData.caseDetail.vin,
        vehicleModel: vehicleModel ? vehicleModel.name : null,
        approximateVehicleValue: inData.caseDetail.approximateVehicleValue
          ? Utils.convertToIndianCurrencyFormat(
            parseFloat(inData.caseDetail.approximateVehicleValue)
          )
          : null,
      });

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
  }

  export async function getCaseInformation(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const caseInformationContactNumbers = [
        inData.caseInformation.customerMobileNumber,
        inData.caseInformation.customerCurrentMobileNumber,
        inData.caseInformation.customerAlternateMobileNumber,
      ];

      const finalData: any = [];
      const promises: any = [];

      promises.push(
        Client.findOne({
          where: { id: inData.clientId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        CaseSubject.findOne({
          where: { id: inData.subjectID },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        VehicleType.findOne({
          where: { id: inData.vehicleTypeId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        VehicleMake.findOne({
          where: { id: inData.vehicleMakeId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        VehicleModel.findOne({
          where: { id: inData.vehicleModelId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        CaseStatus.findOne({
          where: { id: inData.statusId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        State.findOne({
          where: { id: inData.caseInformation.customerStateId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        City.findOne({
          where: { id: inData.caseInformation.customerCityId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        Disposition.findOne({
          where: { id: inData.caseInformation.dispositionId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        Language.findOne({
          where: { id: inData.caseInformation.contactLanguageId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        Language.findOne({
          where: {
            id: inData.caseInformation.customerCurrentContactLanguageId,
          },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        Config.findOne({
          where: { id: inData.caseInformation.channelId },
          attributes: ["id", "name"],
        })
      );

      promises.push(
        Config.findOne({
          where: { id: inData.caseInformation.caseTypeId },
          attributes: ["id", "name"],
        })
      );

      promises.push(
        Config.findOne({
          where: { id: inData.caseInformation.accidentTypeId },
          attributes: ["id", "name"],
        })
      );

      promises.push(
        Service.findOne({
          where: { id: inData.caseInformation.serviceId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        SubService.findOne({
          where: { id: inData.caseInformation.subServiceId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      //DISABLED - CONFIRMED BY CLIENT TEAM
      // promises.push(
      //   ConditionOfVehicle.findOne({
      //     where: { id: inData.caseInformation.conditionOfVehicleId },
      //     attributes: ["id", "name"],
      //     paranoid: false,
      //   })
      // );

      promises.push(
        FuelType.findOne({
          where: { id: inData.caseInformation.fuelTypeId },
          attributes: ["id", "name", "displayName"],
          paranoid: false,
        })
      );

      promises.push(
        Config.findOne({
          where: { id: inData.caseInformation.policyTypeId },
          attributes: ["id", "name"],
        })
      );

      promises.push(
        PolicyPremium.findOne({
          where: { id: inData.caseInformation.policyPremiumId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        Config.findOne({
          where: { id: inData.caseInformation.getLocationViaId },
          attributes: ["id", "name"],
        })
      );

      promises.push(
        ManualLocationReason.findOne({
          where: { id: inData.caseInformation.reasonForManualLocationId },
          attributes: ["id", "name"],
          paranoid: false,
        })
      );

      promises.push(
        City.findOne({
          where: { id: inData.caseInformation.breakdownAreaId },
          attributes: ["id", "name", "locationTypeId", "locationCategoryId"],
          paranoid: false,
          include: [
            {
              model: Config,
              as: "locationCategory",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: Config,
              as: "locationType",
              attributes: ["id", "name"],
              required: false,
            },
          ],
        })
      );

      promises.push(
        Config.findOne({
          where: { id: inData.caseInformation.vehicleLocationId },
          attributes: ["id", "name"],
        })
      );

      promises.push(
        inData.caseInformation.dropLocationTypeId &&
        Config.findOne({
          where: { id: inData.caseInformation.dropLocationTypeId },
          attributes: ["id", "name"],
        })
      );

      promises.push(
        inData.caseInformation.customerPreferredLocationId &&
        Config.findOne({
          where: { id: inData.caseInformation.customerPreferredLocationId },
          attributes: ["id", "name"],
        })
      );

      promises.push(
        inData.caseInformation.dropDealerId &&
        Dealer.findOne({
          where: { id: inData.caseInformation.dropDealerId },
          attributes: [
            "id",
            "name",
            "mobileNumber",
            [
              Sequelize.literal("CONCAT(code, '-', legalName)"),
              "codeWithLegalName",
            ],
          ],
          paranoid: false,
        })
      );

      promises.push(
        inData.agentId &&
        axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
          id: inData.agentId,
        })
      );

      promises.push(
        inData.l1AgentId &&
        axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
          id: inData.l1AgentId,
        })
      );

      promises.push(
        Config.findAll({
          where: { id: [491, 492] },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        inData.caseInformation.dropAreaId &&
        City.findOne({
          where: { id: inData.caseInformation.dropAreaId },
          attributes: ["id", "name", "locationTypeId"],
          paranoid: false,
        })
      );

      const [
        client,
        caseSubject,
        vehicleType,
        vehicleMake,
        vehicleModel,
        caseStatus,
        customerState,
        customerCity,
        disposition,
        contactLanguage,
        customerCurrentContactLanguage,
        channel,
        caseType,
        accidentType,
        service,
        subService,
        // conditionOfVehicle,
        fuelType,
        policyType,
        policyPremium,
        getLocationVia,
        manualLocationReason,
        breakdownArea,
        vehicleLocation,
        dropLocationType,
        customerPreferredLocation,
        dropDealer,
        agentDetail,
        l1AgentDetail,
        accidentalDocLocationViaTypes,
        dropArea,
      ]: any = await Promise.all(promises);

      const activityLogData: any = [];
      if (inData.activityLogs.length > 0) {
        for (const activityLog of inData.activityLogs) {
          let channel = null;
          let interactionTo = null;
          let callType = null;
          //INTERACTION TYPE
          if (activityLog.typeId == 242) {
            const [channelExists, interactionToExists, callTypeExists]: any =
              await Promise.all([
                Config.findOne({
                  where: { id: activityLog.channelId },
                }),
                Config.findOne({
                  where: { id: activityLog.toId },
                }),
                Config.findOne({
                  where: { id: activityLog.callTypeId },
                }),
              ]);

            channel = channelExists ? channelExists.dataValues.name : null;
            interactionTo = interactionToExists
              ? interactionToExists.dataValues.name
              : null;
            callType = callTypeExists ? callTypeExists.dataValues.name : null;
          }
          activityLogData.push({
            id: activityLog.id,
            caseDetailId: activityLog.caseDetailId,
            activityId: activityLog.activityId,
            typeId: activityLog.typeId,
            title: activityLog.title,
            description: activityLog.description,
            channel: channel,
            interactionTo: interactionTo,
            callType: callType,
            createdAt: moment
              .tz(activityLog.createdAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A"),
          });
        }
      }

      await finalData.push({
        caseDetailId: inData.id,
        caseNumber: inData.caseNumber,
        agentId: inData.agentId,
        agentName:
          agentDetail && agentDetail.data.success
            ? agentDetail.data.user.name
            : null,
        l1AgentId: inData.l1AgentId ? inData.l1AgentId : null,
        l1AgentName:
          l1AgentDetail && l1AgentDetail.data.success
            ? l1AgentDetail.data.user.name
            : null,
        clientId: client ? client.dataValues.id : null,
        client: client ? client.dataValues.name : null,
        callCenterId: inData.callCenterId,
        registrationNumber: inData.registrationNumber,
        vin: inData.vin,
        vehicleType: vehicleType ? vehicleType.dataValues.name : null,
        vehicleMake: vehicleMake ? vehicleMake.dataValues.name : null,
        vehicleModel: vehicleModel ? vehicleModel.dataValues.name : null,
        caseSubject: caseSubject ? caseSubject.dataValues.name : null,
        caseStatusId: caseStatus ? caseStatus.dataValues.id : null,
        psfStatus: inData.psfStatus,
        caseStatus: caseStatus ? caseStatus.dataValues.name : null,
        caseInformationId: inData.caseInformation.id,
        customerContactName: inData.caseInformation.customerContactName,
        customerMobileNumber: inData.caseInformation.customerMobileNumber,
        customerCurrentContactName:
          inData.caseInformation.customerCurrentContactName,
        customerCurrentMobileNumber:
          inData.caseInformation.customerCurrentMobileNumber,
        customerAlternateMobileNumber:
          inData.caseInformation.customerAlternateMobileNumber,
        customerState: customerState ? customerState.dataValues.name : null,
        customerCity: customerCity ? customerCity.dataValues.name : null,
        voiceOfCustomer: inData.caseInformation.voiceOfCustomer,
        disposition: disposition ? disposition.dataValues.name : null,
        contactLanguage: contactLanguage
          ? contactLanguage.dataValues.name
          : null,
        customerCurrentContactLanguage: customerCurrentContactLanguage
          ? customerCurrentContactLanguage.dataValues.name
          : null,
        channel: channel ? channel.dataValues.name : null,
        caseTypeId: caseType ? caseType.dataValues.id : null,
        caseType: caseType ? caseType.dataValues.name : null,
        accidentType: accidentType ? accidentType.dataValues.name : null,
        specialCraneNeeded: inData.caseInformation.specialCraneNeeded,
        serviceId: service ? service.dataValues.id : null,
        service: service ? service.dataValues.name : null,
        subServiceId: subService ? subService.dataValues.id : null,
        subService: subService ? subService.dataValues.name : null,
        // conditionOfVehicle: conditionOfVehicle
        //   ? conditionOfVehicle.dataValues.name
        //   : null,
        // conditionOfVehicleOthers:
        //   inData.caseInformation.conditionOfVehicleOthers,
        irateCustomer: inData.caseInformation.irateCustomer,
        womenAssist: inData.caseInformation.womenAssist,
        hasActivePolicy: inData.caseInformation.hasActivePolicy,
        policyNumber: inData.caseInformation.policyNumber,
        fuelType: fuelType ? fuelType.dataValues.name : null,
        saleDate: inData.caseInformation.saleDate
          ? moment
            .tz(inData.caseInformation.saleDate, "Asia/Kolkata")
            .format("DD/MM/YYYY")
          : null,
        runningKm: inData.caseInformation.runningKm,
        policyTypeId: policyType ? policyType.dataValues.id : null,
        policyType: policyType ? policyType.dataValues.name : null,
        policyStartDate: inData.caseInformation.policyStartDate
          ? moment
            .tz(inData.caseInformation.policyStartDate, "Asia/Kolkata")
            .format("DD/MM/YYYY")
          : null,
        policyEndDate: inData.caseInformation.policyEndDate
          ? moment
            .tz(inData.caseInformation.policyEndDate, "Asia/Kolkata")
            .format("DD/MM/YYYY")
          : null,
        serviceEligibilityId: inData.caseInformation.serviceEligibilityId,
        serviceEligibility: inData.caseInformation.serviceEligibility,
        policyPremium: policyPremium ? policyPremium.dataValues.name : null,
        getLocationVia: getLocationVia ? getLocationVia.dataValues.name : null,
        manualLocationReason: manualLocationReason
          ? manualLocationReason.dataValues.name
          : null,
        breakdownLocation: inData.caseInformation.breakdownLocation,
        nearestCity: inData.caseInformation.nearestCity,
        breakdownLat: inData.caseInformation.breakdownLat,
        breakdownLong: inData.caseInformation.breakdownLong,
        breakdownAreaId: breakdownArea?.dataValues.id || null,
        breakdownArea: breakdownArea?.dataValues.name || null,
        breakdownAreaLocationTypeId:
          breakdownArea?.dataValues.locationTypeId || null,
        breakdownAreaLocationType: breakdownArea?.locationType?.name || null,
        breakdownAreaLocationCategory:
          breakdownArea?.locationCategory?.name || null,
        addressByCustomer: inData.caseInformation.addressByCustomer || null,
        breakdownLandmark: inData.caseInformation.breakdownLandmark || null,
        customerLocation: inData.caseInformation.customerLocation,
        vehicleLocation: vehicleLocation
          ? vehicleLocation.dataValues.name
          : null,
        dropLocationTypeId: dropLocationType
          ? dropLocationType.dataValues.id
          : null,
        dropLocationType: dropLocationType
          ? dropLocationType.dataValues.name
          : null,
        customerPreferredLocationId: customerPreferredLocation
          ? customerPreferredLocation.dataValues.id
          : null,
        customerPreferredLocation: customerPreferredLocation
          ? customerPreferredLocation.dataValues.name
          : null,
        dropDealerId: dropDealer ? dropDealer.dataValues.id : null,
        dropDealer: dropDealer ? dropDealer.dataValues.name : null,
        dropDealerCodeWithLegalName: dropDealer
          ? dropDealer.dataValues.codeWithLegalName
          : null,
        dropAreaId: inData.caseInformation.dropAreaId,
        dropArea: dropArea?.dataValues.name || null,
        dropDealerMobileNumber: dropDealer
          ? dropDealer.dataValues.mobileNumber
          : null,
        dropLocationLat: inData.caseInformation.dropLocationLat,
        dropLocationLong: inData.caseInformation.dropLocationLong,
        dropLocation: inData.caseInformation.dropLocation,
        breakdownToDropLocationDistance:
          inData.caseInformation.breakdownToDropLocationDistance,
        customerNeedToPay: inData.caseInformation.customerNeedToPay,
        nonMembershipType: inData.caseInformation.nonMembershipType,
        additionalServiceRequested: inData.caseInformation.additionalServiceRequested == 1 ? true : false,
        additionalChargeableKm: inData.caseInformation.additionalChargeableKm,
        hasAccidentalDocument: inData.caseInformation.hasAccidentalDocument,
        accidentalDocLinkId: inData.caseInformation.accidentalDocLinkId,
        accidentalDocumentLink: inData.accidentalDocumentLink,
        withoutAccidentalDocument:
          inData.caseInformation.withoutAccidentalDocument,
        withoutAccidentalDocumentRemarks:
          inData.caseInformation.withoutAccidentalDocumentRemarks,
        accidentalAttachments: inData.accidentalAttachments,
        policyInterestedCustomer: inData.policyInterestedCustomer,
        isCustomerInvoiced: inData.isCustomerInvoiced == 1 ? true : false,
        customerInvoiceNumber: inData.customerInvoiceNumber || null,
        customerInvoiceDate: inData.customerInvoiceDate || null,
        customerInvoicePath: inData.customerInvoicePath
          ? `${process.env.RSA_WEB_BASE_URL || ""}${inData.customerInvoicePath}`
          : null,
        isCancellationInvoiced: inData.isCancellationInvoiced == 1 ? true : false,
        cancellationInvoiceNumber: inData.cancellationInvoiceNumber || null,
        cancellationInvoiceDate: inData.cancellationInvoiceDate || null,
        cancellationInvoicePath: inData.cancellationInvoicePath
          ? `${process.env.RSA_WEB_BASE_URL || ""}${inData.cancellationInvoicePath}`
          : null,
        createdAt: moment
          .tz(inData.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        activityDetails: inData.activities,
        activityLogs: activityLogData,
        breakdownVehicleAttachments: inData.breakdownVehicleAttachments,
        positiveActivityExists: inData.positiveActivityExists,
        hasReachedBreakdown: inData.hasReachedBreakdown,
        breakdownReachTimeSLA: inData.breakdownReachTimeSLA,
        extras: {
          accidentalDocLocationViaTypes: accidentalDocLocationViaTypes,
          accidentalDocCaptureContactDetails: Array.from(
            new Set(
              caseInformationContactNumbers.filter(
                (contactNumber): string => contactNumber
              )
            )
          ),
        },
      });

      return res.status(200).json({
        success: true,
        message: "Data fetched successfully",
        data: finalData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getRsaFormData(req: Request, res: Response) {
    try {
      const payload = req.body;
      const v = {
        tempCaseFormDetailId: "required|numeric",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const getTempCaseFormDetailResponse = await axios.post(
        `${caseServiceUrl}/${caseEndpoint.case.getTempCaseFormDetail}`,
        {
          id: payload.tempCaseFormDetailId,
        }
      );
      if (!getTempCaseFormDetailResponse.data.success) {
        return res.status(200).json({
          success: false,
          error: getTempCaseFormDetailResponse.data.error,
        });
      }

      // GET PAYLOAD FROM TEMP CASE FORM DETAIL TABLE
      const request = JSON.parse(
        getTempCaseFormDetailResponse.data.data.payload
      );

      const client = await Client.findOne({
        where: {
          id: request.clientId,
        },
        attributes: ["id", "name"],
      });
      if (!client) {
        return res.status(200).json({
          success: false,
          errors: "Client details not found",
        });
      }

      const promises = [];
      promises.push(
        Disposition.findAll({
          where: {
            typeId: 392, // RSA
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 38, // CASE CREATION TYPES
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Language.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Language.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 37, // CASE CHANNELS
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 39, // CASE ACCIDENT TYPES
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        CaseSubject.findAll({
          where: {
            clientId: request.clientId,
            id: {
              [Op.notIn]: [1], //VEHICLE TRANSFER
            },
          },
          attributes: ["id", "name", "caseTypeId"],
          order: [["id", "asc"]],
        })
      );

      //DISABLED - CONFIRMED BY CLIENT TEAM
      // promises.push(
      //   ConditionOfVehicle.findAll({
      //     attributes: ["id", "name"],
      //     order: [["id", "asc"]],
      //   })
      // );

      promises.push(
        VehicleType.findAll({
          where: {
            id: {
              [Op.notIn]: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], //EXCEPT VDM VEHICLE TYPES
            },
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        VehicleMake.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 40, // POLICY TYPES
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        PolicyPremium.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        State.findAll({
          where: {
            countryId: 1, // India
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 41, // CUSTOMER VEHICLE LOCATION TYPES
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 42, // DROP LOCATION TYPES
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 43, // CUSTOMER PREFERRED LOCATIONS
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        ManualLocationReason.findAll({
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 46, // GET LOCATION VIA TYPES
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        SubService.findAll({
          where: {
            id: [24, 25], //CUSTODY & CAB ASSISTANCE
          },
          attributes: [
            "id",
            "name",
            "serviceId",
            "hasAspAssignment",
            "hasLimit",
          ],
          order: [["id", "asc"]],
        })
      );

      const [
        dispositions,
        caseTypes,
        contactLanguages,
        currentContactLanguages,
        caseChannels,
        caseAccidentTypes,
        caseSubjects,
        // conditionOfVehicles,
        vehicleTypes,
        vehicleMakes,
        policyTypes,
        policyPremiums,
        states,
        customerVehicleLocations,
        dropLocationTypes,
        customerPreferredLocations,
        manualLocationReasons,
        locationViaTypes,
        towingAdditionalSubServices,
      ] = await Promise.all(promises);

      //GET POLICY DETAILS FROM SALES PORTAL
      // let policyDetails = null;
      // let vehicleDetails = null;
      // VIN OR VEHICLE REGISTRATION NUMBER EXISTS
      // if (request.vin || request.vehicleRegistrationNumber) {
      //   const policyDetailResponse = await axios.post(
      //     `${process.env.RSA_BASE_URL}/crm/get/membership/details`,
      //     {
      //       clientName: client.dataValues.name,
      //       vin: request.vin,
      //       vehicleRegistrationNumber: request.vehicleRegistrationNumber,
      //     }
      //   );
      //   if (policyDetailResponse.data.success) {
      //     policyDetails = policyDetailResponse.data.policy_detail;
      //     vehicleDetails = policyDetailResponse.data.vehicle_details;
      //   }
      // }

      //CREATE NEW FUEL TYPE IF NOT EXISTS IN DATABASE
      // if (vehicleDetails && vehicleDetails.fuel_type) {
      //   const fuelTypeExist = await FuelType.findOne({
      //     where: { name: vehicleDetails.fuel_type },
      //   });
      //   if (!fuelTypeExist) {
      //     await FuelType.create({
      //       name: vehicleDetails.fuel_type,
      //       displayName: vehicleDetails.fuel_type,
      //     });
      //   }
      // }

      // const fuelTypes = await FuelType.findAll({
      //   attributes: ["id", "name", "displayName"],
      //   order: [["id", "asc"]],
      //   group: ["displayName"],
      // });

      const extras = {
        dispositions: dispositions,
        caseTypes: caseTypes,
        contactLanguages: contactLanguages,
        currentContactLanguages: currentContactLanguages,
        caseChannels: caseChannels,
        caseAccidentTypes: caseAccidentTypes,
        caseSubjects: caseSubjects,
        // conditionOfVehicles: conditionOfVehicles,
        vehicleTypes: vehicleTypes,
        vehicleMakes: vehicleMakes,
        // fuelTypes: fuelTypes,
        policyTypes: policyTypes,
        // policyDetails: policyDetails,
        // vehicleDetails: vehicleDetails,
        policyPremiums: policyPremiums,
        states: states,
        customerVehicleLocations: customerVehicleLocations,
        dropLocationTypes: dropLocationTypes,
        customerPreferredLocations: customerPreferredLocations,
        manualLocationReasons: manualLocationReasons,
        locationViaTypes: locationViaTypes,
        towingAdditionalServiceId: 3, //Others
        towingAdditionalSubServices: towingAdditionalSubServices,
      };

      const data = {
        clientName: client.dataValues.name,
        ...request,
        extras: extras,
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
  }

  export async function getAdditionalServiceRequestFormData(
    req: Request,
    res: Response
  ) {
    try {
      const promises: any = [];
      promises.push(
        Service.findAll({
          where: {
            id: {
              [Op.notIn]: [2], //Mechanical
            },
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 42, // DROP LOCATION TYPES
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        Config.findAll({
          where: {
            typeId: 43, // CUSTOMER PREFERRED LOCATIONS
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        })
      );

      promises.push(
        SubService.findOne({
          where: {
            id: 24, //CUSTODY
          },
          attributes: ["id", "name", "serviceId"],
        })
      );

      promises.push(
        SubService.findOne({
          where: {
            id: 25, //CAB ASSITANCE
          },
          attributes: ["id", "name", "serviceId"],
        })
      );

      const [
        services,
        dropLocationTypes,
        customerPreferredLocations,
        custodySubService,
        cabAssistanceSubService,
      ]: any = await Promise.all(promises);

      const extras = {
        services: services,
        dropLocationTypes: dropLocationTypes,
        customerPreferredLocations: customerPreferredLocations,
      };

      const data = {
        custodyServiceId: custodySubService
          ? custodySubService.dataValues.serviceId
          : null,
        custodySubServiceId: custodySubService
          ? custodySubService.dataValues.id
          : null,

        cabAssistanceServiceId: cabAssistanceSubService
          ? cabAssistanceSubService.dataValues.serviceId
          : null,
        cabAssistanceSubServiceId: cabAssistanceSubService
          ? cabAssistanceSubService.dataValues.id
          : null,
        extras: extras,
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
  }

  export async function caseInformationRequestMasterData(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const v = {
        breakdownAreaId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const breakdownAreaData = await Utils.findByModelId(
        City,
        payload.breakdownAreaId,
        ["id", "name", "rmId", "deletedAt"]
      );
      if (
        !breakdownAreaData ||
        (breakdownAreaData && breakdownAreaData.deletedAt)
      ) {
        return res.status(200).json({
          success: false,
          error: "Breakdown city not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          breakdownAreaData,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function caseRequestMasterData(req: Request, res: Response) {
    try {
      const payload = req.body;
      const v = {
        pickUpCityId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const pickUpCityData = await Utils.findByModelId(
        City,
        payload.pickUpCityId,
        ["id", "name", "rmId", "deletedAt"]
      );
      if (!pickUpCityData || (pickUpCityData && pickUpCityData.deletedAt)) {
        return res.status(200).json({
          success: false,
          error: "Pickup city not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          pickUpCityData,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function overAllMapCaseViewMasterDetail(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const caseTypeIds = [
        ...new Set(
          payload.caseDetails.map((caseDetail: any) => caseDetail.caseTypeId)
        ),
      ];

      const vehicleTypeIds = [
        ...new Set(
          payload.caseDetails.map((caseDetail: any) => caseDetail.vehicleTypeId)
        ),
      ];

      const vehicleMakeIds = [
        ...new Set(
          payload.caseDetails.map((caseDetail: any) => caseDetail.vehicleMakeId)
        ),
      ];

      const vehicleModelIds = [
        ...new Set(
          payload.caseDetails.map(
            (caseDetail: any) => caseDetail.vehicleModelId
          )
        ),
      ];

      const clientIds = [
        ...new Set(
          payload.caseDetails.map((caseDetail: any) => caseDetail.clientId)
        ),
      ];

      const caseSubjectIds = [
        ...new Set(
          payload.caseDetails.map((caseDetail: any) => caseDetail.subjectId)
        ),
      ];

      const deliveryRequestSubServiceIds = [
        ...new Set(
          payload.caseDetails
            .map((caseDetail: any) => caseDetail.deliveryRequestSubServiceId)
            .filter((id: any) => id !== null && id !== undefined && id !== "")
        ),
      ];

      const [
        caseTypes,
        vehicleTypes,
        vehicleMakes,
        vehicleModels,
        clients,
        caseSubjects,
        deliveryRequestSubServices,
      ]: any = await Promise.all([
        Config.findAll({
          attributes: ["id", "name"],
          where: { id: { [Op.in]: caseTypeIds } },
        }),
        VehicleType.findAll({
          attributes: ["id", "name"],
          where: { id: { [Op.in]: vehicleTypeIds } },
          paranoid: false,
        }),
        VehicleMake.findAll({
          attributes: ["id", "name"],
          where: {
            id: { [Op.in]: vehicleMakeIds },
          },
          paranoid: false,
        }),
        VehicleModel.findAll({
          attributes: ["id", "name"],
          where: {
            id: { [Op.in]: vehicleModelIds },
          },
          paranoid: false,
        }),
        Client.findAll({
          attributes: ["id", "name"],
          where: {
            id: { [Op.in]: clientIds },
          },
          paranoid: false,
        }),
        CaseSubject.findAll({
          attributes: ["id", "name"],
          where: {
            id: { [Op.in]: caseSubjectIds },
          },
          paranoid: false,
        }),
        SubService.findAll({
          attributes: ["id", "name"],
          where: {
            id: { [Op.in]: deliveryRequestSubServiceIds },
          },
          paranoid: false,
        }),
      ]);

      for (const caseDetail of payload.caseDetails) {
        //RSA
        if (caseDetail.typeId == 31) {
          const caseTypeData = caseTypes.find(
            (caseType: any) => caseType.id == caseDetail.caseTypeId
          );
          caseDetail.caseType = caseTypeData ? caseTypeData.name : null;
        }

        const vehicleTypeData = vehicleTypes.find(
          (vehicleType: any) => vehicleType.id == caseDetail.vehicleTypeId
        );
        const vehicleMakeData = vehicleMakes.find(
          (vehicleMake: any) => vehicleMake.id == caseDetail.vehicleMakeId
        );
        const vehicleModelData = vehicleModels.find(
          (vehicleModel: any) => vehicleModel.id == caseDetail.vehicleModelId
        );
        const clientData = clients.find(
          (client: any) => client.id == caseDetail.clientId
        );
        const caseSubjectData = caseSubjects.find(
          (caseSubject: any) => caseSubject.id == caseDetail.subjectId
        );
        caseDetail.vehicleType = vehicleTypeData ? vehicleTypeData.name : null;
        caseDetail.vehicleMake = vehicleMakeData ? vehicleMakeData.name : null;
        caseDetail.vehicleModel = vehicleModelData
          ? vehicleModelData.name
          : null;
        caseDetail.client = clientData ? clientData.name : null;
        caseDetail.caseSubject = caseSubjectData ? caseSubjectData.name : null;

        if (caseDetail.deliveryRequestSubServiceId) {
          const deliveryRequestSubServiceData = deliveryRequestSubServices.find(
            (deliveryRequestSubService: any) =>
              deliveryRequestSubService.id ==
              caseDetail.deliveryRequestSubServiceId
          );
          caseDetail.deliveryRequestSubService = deliveryRequestSubServiceData
            ? deliveryRequestSubServiceData.name
            : null;
        }
      }

      return res.status(200).json({
        success: true,
        data: payload.caseDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //USED IN RSA CRM POLICY DETAIL ADD AND UPDATE PROCESS
  export async function policyDetailUpdateFormData(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const client: any = await Client.findOne({
        attributes: ["id", "name"],
        where: {
          id: payload.clientId,
        },
        paranoid: false,
      });
      if (!client) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      const [policyTypes, membershipTypeResponse, states] = await Promise.all([
        Config.findAll({
          where: {
            typeId: 40, //Policy Types
            id: {
              [Op.notIn]: [434],
            },
          },
          attributes: ["id", "name"],
        }),
        axios.post(`${process.env.RSA_BASE_URL}/crm/membershipTypes/getList`, {
          clientName: client.name,
        }),
        State.findAll({
          attributes: ["id", "name"],
        }),
      ]);

      if (!membershipTypeResponse.data.success) {
        return res.status(200).json(membershipTypeResponse.data);
      }

      return res.status(200).json({
        success: true,
        data: {
          policyTypes: policyTypes,
          membershipTypes: membershipTypeResponse.data.membership_types,
          states: states,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getMembershipAndVehicleData(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const v = {
        clientName: "required|string",
        vin: "nullable|string",
        vehicleRegistrationNumber: "nullable|string",
        mobileNumber: "nullable",
        policyNumber: "nullable|string",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      //GET POLICY DETAILS FROM SALES PORTAL
      let policyDetails = null;
      let vehicleDetails = null;
      // VIN OR VEHICLE REGISTRATION NUMBER EXISTS
      if (
        payload.vin ||
        payload.vehicleRegistrationNumber ||
        payload.mobileNumber ||
        payload.policyNumber
      ) {
        const policyDetailResponse = await axios.post(
          `${process.env.RSA_BASE_URL}/crm/get/membership/details`,
          {
            clientName: payload.clientName,
            vin: payload.vin,
            vehicleRegistrationNumber: payload.vehicleRegistrationNumber,
            mobileNumber: payload.mobileNumber,
            policyNumber: payload.policyNumber,
          }
        );
        if (policyDetailResponse?.data?.success) {
          policyDetails = policyDetailResponse.data.policy_detail;
          vehicleDetails = policyDetailResponse.data.vehicle_details;
        }
      }

      //CREATE NEW FUEL TYPE IF NOT EXISTS IN DATABASE
      if (vehicleDetails && vehicleDetails.fuel_type) {
        const fuelTypeExist = await FuelType.findOne({
          where: { name: vehicleDetails.fuel_type },
          paranoid: false,
        });
        if (!fuelTypeExist) {
          await FuelType.create({
            name: vehicleDetails.fuel_type,
            displayName: vehicleDetails.fuel_type,
          });
        }
      }

      const fuelTypes = await FuelType.findAll({
        attributes: ["id", "name", "displayName"],
        order: [["id", "asc"]],
        group: ["displayName"],
      });

      return res.status(200).json({
        success: true,
        fuelTypes,
        policy_detail: policyDetails,
        vehicle_details: vehicleDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getVehicleData(req: Request, res: Response) {
    try {
      const payload = req.body;
      const v = {
        vehicleRegistrationNumber: "required|string",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      //GET VEHICLE DETAILS FROM FIT SERVER
      const vehicleDetailResponse = await axios.post(
        `${process.env.GET_VEHICLE_DETAIL_URL}`,
        {
          vehicleNumber: payload.vehicleRegistrationNumber,
        }
      );

      let vehicleDetails = null;
      if (vehicleDetailResponse?.data?.success) {
        vehicleDetails = {
          viNumber: vehicleDetailResponse.data?.result?.chassis_number || null,
          registrationNumber:
            vehicleDetailResponse.data?.result?.registration_number || null,
          fuelType: vehicleDetailResponse.data?.result?.fuel_type || null,
        };
      }

      //CREATE NEW FUEL TYPE IF NOT EXISTS IN DATABASE
      if (vehicleDetails?.fuelType) {
        const fuelTypeExist = await FuelType.findOne({
          where: { name: vehicleDetails.fuelType },
          paranoid: false,
        });
        if (!fuelTypeExist) {
          await FuelType.create({
            name: vehicleDetails.fuelType,
            displayName: vehicleDetails.fuelType,
          });
        }
      }

      const fuelTypes = await FuelType.findAll({
        attributes: ["id", "name", "displayName"],
        order: [["id", "asc"]],
        group: ["displayName"],
      });

      return res.status(200).json({
        success: true,
        fuelTypes,
        vehicleDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function crmListSearchData(req: Request, res: Response) {
    try {
      const payload = req.body;
      const v = {
        search: "required|string",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [
        customerTypes,
        caseSubjects,
        serviceSubServices,
        subServices,
        policyTypes,
        channels,
        caseStatuses,
        activityStatuses,
        services,
        activityPaymentStatuses,
        subjects,
        clients,
        callFromDetails,
        dispositions,
        languages,
      ]: any = await Promise.all([
        Config.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
            typeId: 38, //Case Creation Types
          },
        }),
        CaseSubject.findAll({
          attributes: ["id"],
          where: { name: { [Op.like]: `%${payload.search}%` } },
          paranoid: false,
        }),
        SubService.findAll({
          attributes: ["id"],
          paranoid: false,
          include: {
            model: Service,
            attributes: ["id"],
            where: { name: { [Op.like]: `%${payload.search}%` } },
          },
        }),
        SubService.findAll({
          attributes: ["id"],
          where: { name: { [Op.like]: `%${payload.search}%` } },
          paranoid: false,
        }),
        Config.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
            typeId: 40, //Policy Types
          },
        }),
        Config.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
            typeId: 37, //Case Channels
          },
        }),
        CaseStatus.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
          },
          paranoid: false,
        }),
        ActivityStatus.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
          },
          paranoid: false,
        }),
        Service.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
          },
          paranoid: false,
        }),
        Config.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
            typeId: 16, //Activity Payment Statuses
          },
        }),
        Config.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
            typeId: 36, //Case Subject Types
          },
        }),
        Client.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
          },
          paranoid: false,
        }),
        Config.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
            typeId: 35, //Interaction Call From
          },
        }),
        Disposition.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
          },
          paranoid: false,
        }),
        Language.findAll({
          attributes: ["id"],
          where: {
            name: { [Op.like]: `%${payload.search}%` },
          },
          paranoid: false,
        }),
      ]);

      let searchDetails = [];
      if (customerTypes.length > 0) {
        const customerTypeIds = customerTypes.map(
          (customerType: any) => customerType.id
        );
        searchDetails.push({
          type: "customerType",
          ids: customerTypeIds,
        });
      }

      if (caseSubjects.length > 0) {
        const caseSubjectIds = caseSubjects.map(
          (caseSubject: any) => caseSubject.id
        );
        searchDetails.push({
          type: "caseSubject",
          ids: caseSubjectIds,
        });
      }

      if (serviceSubServices.length > 0) {
        const serviceSubServiceIds = serviceSubServices.map(
          (serviceSubService: any) => serviceSubService.id
        );
        searchDetails.push({
          type: "serviceSubService",
          ids: serviceSubServiceIds,
        });
      }

      if (subServices.length > 0) {
        const subServiceIds = subServices.map(
          (subService: any) => subService.id
        );
        searchDetails.push({
          type: "subService",
          ids: subServiceIds,
        });
      }

      if (policyTypes.length > 0) {
        const policyTypeIds = policyTypes.map(
          (policyType: any) => policyType.id
        );
        searchDetails.push({
          type: "policyType",
          ids: policyTypeIds,
        });
      }

      if (channels.length > 0) {
        const channelIds = channels.map((channel: any) => channel.id);
        searchDetails.push({
          type: "channel",
          ids: channelIds,
        });
      }

      if (caseStatuses.length > 0) {
        const caseStatusIds = caseStatuses.map(
          (caseStatus: any) => caseStatus.id
        );
        searchDetails.push({
          type: "caseStatus",
          ids: caseStatusIds,
        });
      }

      if (activityStatuses.length > 0) {
        const activityStatusIds = activityStatuses.map(
          (activityStatus: any) => activityStatus.id
        );
        searchDetails.push({
          type: "activityStatus",
          ids: activityStatusIds,
        });
      }

      if (services.length > 0) {
        const serviceIds = services.map((service: any) => service.id);
        searchDetails.push({
          type: "service",
          ids: serviceIds,
        });
      }

      if (activityPaymentStatuses.length > 0) {
        const activityPaymentStatusIds = activityPaymentStatuses.map(
          (activityPaymentStatus: any) => activityPaymentStatus.id
        );
        searchDetails.push({
          type: "activityPaymentStatus",
          ids: activityPaymentStatusIds,
        });
      }

      if (subjects.length > 0) {
        const subjectIds = subjects.map((subject: any) => subject.id);
        searchDetails.push({
          type: "subject",
          ids: subjectIds,
        });
      }

      if (clients.length > 0) {
        const clientIds = clients.map((client: any) => client.id);
        searchDetails.push({
          type: "client",
          ids: clientIds,
        });
      }

      if (callFromDetails.length > 0) {
        const callFromDetailIds = callFromDetails.map(
          (callFromDetail: any) => callFromDetail.id
        );
        searchDetails.push({
          type: "callFrom",
          ids: callFromDetailIds,
        });
      }

      if (dispositions.length > 0) {
        const dispositionIds = dispositions.map(
          (disposition: any) => disposition.id
        );
        searchDetails.push({
          type: "disposition",
          ids: dispositionIds,
        });
      }

      if (languages.length > 0) {
        const languageIds = languages.map((language: any) => language.id);
        searchDetails.push({
          type: "language",
          ids: languageIds,
        });
      }

      return res.status(200).json({
        success: true,
        searchDetails,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //Used in case list and case sub service list pages for filtering.
  export async function crmListFilterData(req: Request, res: Response) {
    try {
      const payload = req.body;
      const [
        breakdownAreaStateCities,
        serviceSubServices,
        breakdownLocationCategoryCities,
        exceededExpectationSlaMins,
        caseSubjectDetails,
      ]: any = await Promise.all([
        payload.breakdownAreaStateIds?.length > 0
          ? City.findAll({
            attributes: ["id"],
            where: {
              stateId: {
                [Op.in]: payload.breakdownAreaStateIds,
              },
            },
            paranoid: false,
          })
          : [],

        payload.serviceIds?.length > 0
          ? SubService.findAll({
            attributes: ["id"],
            where: {
              serviceId: {
                [Op.in]: payload.serviceIds,
              },
            },
            paranoid: false,
          })
          : [],

        payload.breakdownLocationCategoryIds?.length > 0
          ? City.findAll({
            attributes: ["id"],
            where: {
              locationCategoryId: {
                [Op.in]: payload.breakdownLocationCategoryIds,
              },
              ...(payload.breakdownAreaStateIds?.length > 0
                ? {
                  stateId: {
                    [Op.in]: payload.breakdownAreaStateIds,
                  },
                }
                : {}), // IF STATES ARE SELECTED, THEN ONLY CITIES OF SELECTED STATES WILL BE FETCHED
            },
            paranoid: false,
          })
          : [],

        Config.findOne({
          attributes: ["id", "name"],
          where: {
            typeId: 74, //Exceeded Expectation SLA Mins
          },
        }),

        payload.caseSubjectNames?.length > 0
          ? CaseSubject.findAll({
            attributes: ["id"],
            where: {
              name: {
                [Op.in]: payload.caseSubjectNames,
              },
            },
            paranoid: false,
          })
          : [],
      ]);

      let breakdownAreaStateCityIds: any = [];
      if (breakdownAreaStateCities.length > 0) {
        breakdownAreaStateCityIds = breakdownAreaStateCities.map(
          (breakdownAreaStateCity: any) => breakdownAreaStateCity.id
        );
      }

      let serviceSubServiceIds: any = [];
      if (serviceSubServices.length > 0) {
        serviceSubServiceIds = serviceSubServices.map(
          (serviceSubService: any) => serviceSubService.id
        );
      }

      let breakdownLocationCategoryCityIds: any = [];
      if (breakdownLocationCategoryCities.length > 0) {
        breakdownLocationCategoryCityIds = breakdownLocationCategoryCities.map(
          (breakdownLocationCategoryCity: any) =>
            breakdownLocationCategoryCity.id
        );
      }

      let caseSubjectIds: any = [];
      if (caseSubjectDetails.length > 0) {
        caseSubjectIds = caseSubjectDetails.map(
          (caseSubjectDetail: any) => caseSubjectDetail.id
        );
      }

      let breakdownCitySlaSettings: any = [];
      if (payload.breakdownCities && payload.breakdownCities.length > 0) {
        const cityIds = payload.breakdownCities.map(
          (breakdownCity: any) => breakdownCity.id
        );

        const cities = await City.findAll({
          attributes: ["id", "locationTypeId"],
          where: {
            id: {
              [Op.in]: cityIds,
            },
          },
          paranoid: false,
        });

        const cityMap = cities.reduce((map: any, city: any) => {
          map[city.id] = city.locationTypeId;
          return map;
        }, {});

        // Fetch SLA settings for each breakdown city concurrently
        const slaPromises = payload.breakdownCities.map(
          async (breakdownCity: any) => {
            const locationTypeId = cityMap[breakdownCity.id];
            if (locationTypeId) {
              const slaSetting = await SlaSetting.findOne({
                attributes: ["id", "time"],
                where: {
                  caseTypeId: 31, // RSA
                  typeId: breakdownCity.typeId, //SLA TYPE ID
                  locationTypeId: locationTypeId,
                },
              });
              breakdownCity.slaTime = slaSetting
                ? slaSetting.dataValues.time
                : null;
            } else {
              breakdownCity.slaTime = null;
            }
            return breakdownCity;
          }
        );
        breakdownCitySlaSettings = await Promise.all(slaPromises);
      }

      return res.status(200).json({
        success: true,
        data: {
          breakdownAreaStateCityIds,
          serviceSubServiceIds,
          breakdownLocationCategoryCityIds,
          exceededExpectationSlaMins,
          caseSubjectIds,
          breakdownCitySlaSettings,
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

export default CaseDataController;
