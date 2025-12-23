import { Op } from "sequelize";
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
  CaseStatus,
  Dealer,
  AdditionalCharge,
  ActivityAppStatus,
  AspMechanic,
  AspActivityRejectReason,
  AspActivityCancelReason,
  Inventory,
  CaseCancelReason,
  CallCenter,
  ActivityFinanceStatus,
  Disposition,
  Language,
  Service,
  ConditionOfVehicle,
  MailConfiguration,
  AspSubService,
  AspMechanicSubService,
  OwnPatrolVehicle,
  AspClient,
  AspRejectedCcDetailReason,
  NspFilter,
  OwnPatrolVehicleTechnicianLogs,
  PaymentMethod,
  OwnPatrolVehicleNewTechnicians,
  SlaSetting,
  Tax,
  SlaViolateReason,
  ServiceOrganisation,
} from "../database/models/index";
import sequelize from "sequelize";
import axios from "axios";
import emailNotification from "../lib/emailNotification";
import Utils from "../lib/utils";
const config = require("../config/config.json");

import dotenv from "dotenv";
import {
  getLastAttendedCocoTechnicians,
  getWorkStatusId,
  getNewCocoTechnicians,
} from "../controllers/aspMechanic";
dotenv.config();

export namespace AspDataController {
  //API with endpoint (Case Service);
  const caseServiceUrl = `${config.caseService.host}:${config.caseService.port}/${config.caseService.version}/${config.caseService.serviceAccess.case}`;
  const endpoint = config.caseService.endpoint;

  //API with endpoint (User Service);
  const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
  const userServiceEndpoint = config.userService.endpoint;

  //CASE LIST
  export async function getCaseData(req: Request, res: Response) {
    try {
      const inData = req.body.rows;
      const userTypeId = req.body.userTypeId;
      const roleId = req.body.roleId;

      if (inData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }
      const finalData: any = [];
      for (var i = 0; i < inData.length; i++) {
        let activityStatus: any;
        let aspActivityStatus: any;
        let estimatedTotalAmount = null;
        let estimatedTotalAmountPaid = null;
        let actualTotalAmount = null;
        let totalDifferenceAmount = null;
        let aspLiveLocationLat = null;
        let aspLiveLocationLong = null;
        let asp: any;
        let aspId = null;
        let activityId = null;
        let slaSetting = {};

        //SLA For Case
        let caseSla = await axios.post(
          `${caseServiceUrl}/${endpoint.case.getSlaListByCaseDetailId}`,
          { caseDetailId: inData[i].id }
        );
        if (caseSla.data && caseSla.data.data) {
          let slaName = await Config.findOne({
            where: { id: caseSla.data.data.slaConfigId },
            attributes: ["name"],
          });
          if (slaName) {
            caseSla.data.data.slaName = slaName.dataValues.name;
            delete caseSla.data.data.slaConfigId;
          }
          slaSetting = {
            ...caseSla.data.data,
          };
        }

        let caseStatus = await CaseStatus.findOne({
          where: { id: inData[i].statusId },
          attributes: ["id", "name"],
        });
        let caseSubject = await CaseSubject.findOne({
          where: { id: inData[i].subjectID },
          attributes: ["id", "name"],
        });
        let subService = await SubService.findOne({
          where: { id: inData[i].deliveryRequestSubServiceId },
          attributes: ["id", "name"],
        });

        let pickupDealer: any = inData[i]?.dealerId
          ? await Dealer.findOne({
            where: { id: inData[i].dealerId },
            attributes: [
              "id",
              "name",
              "lat",
              "long",
              "mobileNumber",
              "correspondenceAddress",
            ],
            paranoid: false,
          })
          : null;

        //IF SCHEME DEALER AND THE LOCATION TYPE IS CUSTOMER MEANS CHANGE THE PICKUP DETAILS
        if (
          !pickupDealer &&
          inData[i].deliveryRequestSchemeId == 22 &&
          inData[i].locationTypeId == 451 &&
          inData[i].pickupLatitude &&
          inData[i].pickupLongitude
        ) {
          pickupDealer = {
            dataValues: {
              name: null,
              mobileNumber: null,
              lat: inData[i].pickupLatitude,
              long: inData[i].pickupLongitude,
              correspondenceAddress: inData[i].deliveryRequestPickupLocation,
            },
          };
        }

        let dropDealer: any = inData[i]?.deliveryRequestDropDealerId
          ? await Dealer.findOne({
            where: { id: inData[i].deliveryRequestDropDealerId },
            attributes: [
              "id",
              "name",
              "lat",
              "long",
              "mobileNumber",
              "correspondenceAddress",
            ],
            paranoid: false,
          })
          : null;

        //IF SCHEME DEALER AND THE LOCATION TYPE IS CUSTOMER MEANS CHANGE THE DROP DETAILS
        if (
          !dropDealer &&
          inData[i].deliveryRequestSchemeId == 22 &&
          inData[i].locationTypeId == 451 &&
          inData[i].dropLatitude &&
          inData[i].dropLongitude
        ) {
          dropDealer = {
            dataValues: {
              name: null,
              mobileNumber: null,
              lat: inData[i].dropLatitude,
              long: inData[i].dropLongitude,
              correspondenceAddress: inData[i].deliveryRequestDropLocation,
            },
          };
        }

        //ACTIVE ACTIVITY
        if (inData[i].activities.length > 0) {
          activityStatus = await ActivityStatus.findOne({
            where: { id: inData[i].activities[0].activityStatusId },
            attributes: ["id", "name"],
          });
          aspActivityStatus = await AspActivityStatus.findOne({
            where: { id: inData[i].activities[0].aspActivityStatusId },
            attributes: ["id", "name"],
          });

          aspId = inData[i].activities[0].activityAspDetail.aspId;
          activityId = inData[i].activities[0].activityAspDetail.activityId;
          estimatedTotalAmount =
            inData[i].activities[0].activityAspDetail.estimatedTotalAmount;
          // ESTIMATED TOTAL AMOUNT PAID
          if (inData[i].activities[0].activityTransactions.length > 0) {
            estimatedTotalAmountPaid =
              inData[i].activities[0].activityTransactions[0].amount;
          }
          actualTotalAmount =
            inData[i].activities[0].activityAspDetail.actualTotalAmount;
          if (estimatedTotalAmountPaid && actualTotalAmount) {
            if (
              parseFloat(estimatedTotalAmountPaid) >
              parseFloat(actualTotalAmount)
            ) {
              totalDifferenceAmount =
                parseFloat(estimatedTotalAmountPaid) -
                parseFloat(actualTotalAmount);
            } else if (
              parseFloat(estimatedTotalAmountPaid) <
              parseFloat(actualTotalAmount)
            ) {
              totalDifferenceAmount =
                parseFloat(actualTotalAmount) -
                parseFloat(estimatedTotalAmountPaid);
            } else {
              totalDifferenceAmount = 0.0;
            }
          }

          asp = await Asp.findOne({
            where: { id: inData[i].activities[0].activityAspDetail.aspId },
            attributes: [
              "name",
              "contactNumber",
              "addressLineOne",
              "addressLineTwo",
              "latitude",
              "longitude",
            ],
            paranoid: false,
          });
          if (inData[i].activities[0].activityAspLiveLocations.length > 0) {
            aspLiveLocationLat =
              inData[i].activities[0].activityAspLiveLocations[0].latitude;
            aspLiveLocationLong =
              inData[i].activities[0].activityAspLiveLocations[0].longitude;
          }
        }
        await finalData.push({
          id: inData[i].id,
          caseNumber: inData[i].caseNumber,
          subject: caseSubject ? caseSubject.dataValues.name : null,
          subService: subService ? subService.dataValues.name : null,
          createdAt: moment
            .tz(inData[i].createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          deliveryRequestPickupDate: inData[i].deliveryRequestPickupDate
            ? moment
              .tz(inData[i].deliveryRequestPickupDate, "Asia/Kolkata")
              .format("DD/MM/YYYY")
            : null,
          deliveryRequestPickupTime: inData[i].deliveryRequestPickupTime,
          status: caseStatus ? caseStatus.dataValues.name : null,
          statusId: inData[i].statusId,
          aspId: aspId,
          activityId: activityId,
          activityStatusId: activityStatus
            ? activityStatus.dataValues.id
            : null,
          activityStatusName: activityStatus
            ? activityStatus.dataValues.name
            : null,
          aspActivityStatusId: aspActivityStatus
            ? aspActivityStatus.dataValues.id
            : null,
          aspActivityStatusName: aspActivityStatus
            ? aspActivityStatus.dataValues.name
            : null,
          deliveryRequestPickupDealerId: inData[i].dealerId,
          deliveryRequestDropDealerId: inData[i].deliveryRequestDropDealerId,
          estimatedTotalAmount: estimatedTotalAmount,
          estimatedTotalAmountPaid: estimatedTotalAmountPaid,
          actualTotalAmount: actualTotalAmount,
          totalDifferenceAmount: totalDifferenceAmount
            ? totalDifferenceAmount.toFixed(2)
            : null,
          hasTrackingLink:
            aspLiveLocationLat && aspLiveLocationLong ? true : false,
          aspLocation: {
            latitude: asp ? asp.dataValues.latitude : null,
            longitude: asp ? asp.dataValues.longitude : null,
            details: {
              aspName: asp ? asp.dataValues.name : null,
              aspContactNumber: asp ? asp.dataValues.contactNumber : null,
              addressLineOne: asp ? asp.dataValues.addressLineOne : null,
              addressLineTwo: asp ? asp.dataValues.addressLineTwo : null,
            },
          },
          pickupLocation: {
            latitude: pickupDealer ? pickupDealer.dataValues.lat : null,
            longitude: pickupDealer ? pickupDealer.dataValues.long : null,
            details: {
              pickUpContactName: pickupDealer
                ? pickupDealer.dataValues.name
                : null,
              pickUpContactNumber: pickupDealer
                ? pickupDealer.dataValues.mobileNumber
                : null,
              address: pickupDealer
                ? pickupDealer.dataValues.correspondenceAddress
                : null,
            },
          },
          dropLocation: {
            latitude: dropDealer ? dropDealer.dataValues.lat : null,
            longitude: dropDealer ? dropDealer.dataValues.long : null,
            details: {
              pickUpContactName: dropDealer ? dropDealer.dataValues.name : null,
              pickUpContactNumber: dropDealer
                ? dropDealer.dataValues.mobileNumber
                : null,
              address: dropDealer
                ? dropDealer.dataValues.correspondenceAddress
                : null,
            },
          },
          //AGENT || SUPER ADMIN || TEAM LEADER
          ...(userTypeId === 141 || roleId == 1 || roleId == 7
            ? { slaSetting }
            : {}),
        });
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
  //ACTIVITY LIST
  export async function getDataList(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (inData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData: any[] = [];

      await Promise.all(
        inData.map(async (data: any) => {
          const [
            asp,
            activityStatus,
            aspActivityStatus,
            activityAppStatus,
            dealerApprovalStatus,
            client,
            config,
            caseSubject,
            subService,
            vehicleType,
            vehicleMake,
            vehicleModel,
            caseStatus,
            caseSlas,
          ] = await Promise.all([
            Asp.findOne({
              where: { id: data.aspId },
              attributes: ["id", "code"],
              paranoid: false,
            }),
            ActivityStatus.findOne({
              where: { id: data.activity.activityStatusId },
              attributes: ["id", "name"],
            }),
            AspActivityStatus.findOne({
              where: { id: data.activity.aspActivityStatusId },
              attributes: ["id", "name"],
            }),
            ActivityAppStatus.findOne({
              where: { id: data.activity.activityAppStatusId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: data.activity.dealerApprovalStatusId },
              attributes: ["id", "name"],
            }),
            Client.findOne({
              where: { id: data.activity.caseDetail.clientId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: data.activity.caseDetail.typeId },
              attributes: ["id", "name"],
            }),
            CaseSubject.findOne({
              where: { id: data.activity.caseDetail.subjectID },
              attributes: ["id", "name"],
            }),
            SubService.findOne({
              where: { id: data.subServiceId },
              attributes: ["id", "name", "serviceId"],
            }),
            VehicleType.findOne({
              where: { id: data.activity.caseDetail.vehicleTypeId },
              attributes: ["id", "name"],
            }),
            VehicleMake.findOne({
              where: { id: data.activity.caseDetail.vehicleMakeId },
              attributes: ["id", "name"],
            }),
            VehicleModel.findOne({
              where: { id: data.activity.caseDetail.vehicleModelId },
              attributes: ["id", "name"],
            }),
            CaseStatus.findOne({
              where: { id: data.activity.caseDetail.statusId },
              attributes: ["id", "name"],
            }),
            axios.post(
              `${caseServiceUrl}/${endpoint.case.getAllSlaByCaseDetailId}`,
              { caseDetailId: data.activity.caseDetailId }
            ),
          ]);
          let caseType;
          if (data.activity.caseDetail.caseInformation) {
            caseType = await Config.findOne({
              where: {
                id: data.activity.caseDetail.caseInformation.caseTypeId,
              },
              attributes: ["id", "name"],
            });
          }

          let service;
          if (subService) {
            service = await Service.findOne({
              where: {
                id: subService.dataValues.serviceId,
              },
              attributes: ["id", "name"],
            });
          }

          let advancePaidActivityTransactions = [];
          if (data?.activity?.activityTransactions?.length > 0) {
            // DELIVERY REQUEST
            if (data.activity.caseDetail.typeId == 32) {
              advancePaidActivityTransactions =
                data.activity.activityTransactions.filter(
                  (activityTransaction: any) =>
                    activityTransaction.paymentTypeId == 170 &&
                    activityTransaction.transactionTypeId == 181 &&
                    activityTransaction.paymentStatusId == 191
                );
            } else if (data.activity.caseDetail.typeId == 31) {
              // RSA
              advancePaidActivityTransactions =
                data.activity.activityTransactions.filter(
                  (activityTransaction: any) =>
                    activityTransaction.paymentTypeId == 174 &&
                    activityTransaction.transactionTypeId == 181 &&
                    activityTransaction.paymentStatusId == 191
                );
            }
          }

          finalData.push({
            typeId: data.activity.caseDetail.typeId,
            activityId: data.activityId,
            aspId: data.aspId,
            aspCode: asp?.dataValues.code || null,
            activityStatusId: data.activity.activityStatusId,
            estimatedTotalKm: data.estimatedTotalKm,
            estimatedTotalDuration: data.estimatedTotalDuration,
            estimatedAspToBreakdownInfo:
              data.estimatedAspToBreakdownKm &&
                data.estimatedAspToBreakdownKmDuration
                ? data.activity.caseDetail.statusId != 4
                  ? `${parseFloat(
                    data.estimatedAspToBreakdownKm
                  )} KM to Breakdown (${data.estimatedAspToBreakdownKmDuration
                  })`
                  : `${parseFloat(
                    data.estimatedAspToBreakdownKm
                  )} KM to Breakdown`
                : null,
            activityStatus: activityStatus
              ? activityStatus.dataValues.name
              : null,
            aspActivityStatusId: data.activity.aspActivityStatusId,
            aspActivityStatus: aspActivityStatus
              ? aspActivityStatus.dataValues.name
              : null,
            activityAppStatusId: data.activity.activityAppStatusId,
            activityAppStatus: activityAppStatus
              ? activityAppStatus.dataValues.name
              : null,
            dealerApprovalStatusId: data.activity.dealerApprovalStatusId,
            dealerApprovalStatus: dealerApprovalStatus
              ? dealerApprovalStatus.dataValues.name
              : null,
            caseStatusId: data.activity.caseDetail.statusId,
            caseStatus: caseStatus ? caseStatus.dataValues.name : null,
            client: client ? client.dataValues.name : null,
            clientId: client ? client.dataValues.id : null,
            caseNumber: data.activity.caseDetail.caseNumber,
            vin: data.activity.caseDetail.vin
              ? data.activity.caseDetail.vin
              : null,
            registrationNumber: data.activity.caseDetail.registrationNumber
              ? data.activity.caseDetail.registrationNumber
              : null,
            configType: config ? config.dataValues.name : null,
            caseSubject: caseSubject ? caseSubject.dataValues.name : null,
            subService: subService ? subService.dataValues.name : null,
            subServiceId: subService ? subService.dataValues.id : null,
            service: service ? service.dataValues.name : null,
            serviceId: service ? service.dataValues.id : null,
            vehicleType: vehicleType ? vehicleType.dataValues.name : null,
            vehicleMake: vehicleMake ? vehicleMake.dataValues.name : null,
            vehicleModel: vehicleModel ? vehicleModel.dataValues.name : null,
            deliveryRequestPickupDate: data.activity.caseDetail
              .deliveryRequestPickupDate
              ? moment
                .tz(
                  data.activity.caseDetail.deliveryRequestPickupDate,
                  "Asia/Kolkata"
                )
                .format("DD/MM/YYYY")
              : null,
            deliveryRequestPickupTime:
              data.activity.caseDetail.deliveryRequestPickupTime,
            caseInformationId:
              data.activity.caseDetail.caseInformation?.id ?? null,
            caseTypeId: caseType ? caseType.dataValues.id : null,
            caseType: caseType ? caseType.dataValues.name : null,
            irateCustomer:
              data.activity.caseDetail.caseInformation?.irateCustomer ?? null,
            womenAssist:
              data.activity.caseDetail.caseInformation?.womenAssist ?? null,

            enableAspWaitingTimeInApp: data.activity.enableAspWaitingTimeInApp,
            isAspAcceptedCcDetail: data.activity.isAspAcceptedCcDetail,
            serviceStatus: data.activity.serviceStatus ?? null,
            advancePaymentMethodId:
              data.activity.advancePaymentMethodId ?? null,
            createdDate: data.activity.caseDetail.createdAt
              ? moment
                .tz(data.activity.caseDetail.createdAt, "Asia/Kolkata")
                .format("DD/MM/YYYY")
              : null,
            aspSlaStatus: await Utils.getAspSlaStatus(
              data.activity.caseDetail,
              data.activity,
              caseSlas,
              data.activity.crmSlas,
              advancePaidActivityTransactions
            ),
          });
        })
      );

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

  //CASE LIST - BuddyApp
  export async function getDataListBuddyApp(req: Request, res: Response) {
    try {
      const inData = req.body.rows || req.body; // Support both old format (array) and new format (object with rows and type)
      const type = req.body.type; // Get type parameter to check if it's "activeRequest"
      const rows = Array.isArray(inData) ? inData : (req.body.rows || []);

      if (rows.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData: any[] = [];

      await Promise.all(
        rows.map(async (data: any) => {
          const [
            asp,
            activityStatus,
            aspActivityStatus,
            caseSubject,
            subService,
            service,
            vehicleMake,
            vehicleModel,
            aspMechanic,
            caseStatus,
          ] = await Promise.all([
            Asp.findOne({
              where: { id: data.aspId },
              attributes: ["id", "name", "code", "workshopName", "contactNumber"],
              paranoid: false,
            }),
            ActivityStatus.findOne({
              where: { id: data.activity.activityStatusId },
              attributes: ["id", "name"],
            }),
            AspActivityStatus.findOne({
              where: { id: data.activity.aspActivityStatusId },
              attributes: ["id", "name"],
            }),
            CaseSubject.findOne({
              where: { id: data.activity.caseDetail.subjectID },
              attributes: ["id", "name"],
            }),
            SubService.findOne({
              where: { id: data.subServiceId },
              attributes: ["id", "name", "serviceId", "hasAspAssignment"],
              include: {
                model: Service,
                attributes: ["id", "name"],
                required: true,
              },
            }),
            Service.findOne({
              where: { id: data.serviceId },
              attributes: ["id", "name"],
            }),
            VehicleMake.findOne({
              where: { id: data.activity.caseDetail.vehicleMakeId },
              attributes: ["id", "name"],
            }),
            VehicleModel.findOne({
              where: { id: data.activity.caseDetail.vehicleModelId },
              attributes: ["id", "name"],
            }),
            AspMechanic.findOne({
              where: { id: data.aspMechanicId },
              attributes: ["id", "name", "contactNumber"],
              paranoid: false,
            }),
            CaseStatus.findOne({
              where: { id: data.activity.caseDetail.statusId },
              attributes: ["id", "name"],
            }),
          ]);

          // Calculate canProceed flag
          let canProceed = false;
          const isActiveRequest = type === "activeRequest";
          const customerNeedToPay = data.activity.customerNeedToPay;

          if (isActiveRequest) {
            // Free service: customerNeedToPay is 0
            if (customerNeedToPay === 0 || customerNeedToPay === false) {
              canProceed = true;
            }
            // Paid service: customerNeedToPay is 1 and advance payment is paid
            else if (customerNeedToPay === 1 || customerNeedToPay === true) {
              // If advance payment method is cash, then can proceed
              if (data.activity.advancePaymentMethodId == 1069) {
                canProceed = true;
              } else if (data.activity.advancePaymentMethodId == 1070) {
                // If advance payment method is online, then check if the advance payment is paid
                // For RSA (typeId == 31): paymentTypeId == 174, transactionTypeId == 181, paymentStatusId == 191, refundStatusId is null or failed
                const transactions = data.activity.activityTransactions || [];
                const advancePaidTransaction = transactions.find(
                  (txn: any) =>
                    txn.paymentTypeId == 174 &&
                    txn.transactionTypeId == 181 &&
                    txn.paymentStatusId == 191 &&
                    (txn.refundStatusId == null || txn.refundStatusId == 1303) // Refund status is null or failed
                );

                if (advancePaidTransaction) {
                  canProceed = true;
                }
              }
            }
          }

          finalData.push({
            activityId: data.activityId,
            caseId: data.activity.caseDetailId,
            caseNumber: data.activity.caseDetail.caseNumber,
            caseSubject: caseSubject ? caseSubject.dataValues.name : null,
            serviceId: service ? service.dataValues.id : null,
            serviceName: service ? service.dataValues.name : null,
            subServiceId: subService ? subService.dataValues.id : null,
            subServiceName: subService ? subService.dataValues.name : null,
            vehicleNumber: data.activity.caseDetail.registrationNumber
              ? data.activity.caseDetail.registrationNumber
              : null,
            vehicleMakeName: vehicleMake ? vehicleMake.dataValues.name : null,
            vehicleModelName: vehicleModel ? vehicleModel.dataValues.name : null,
            breakdownLocation: data.activity.caseDetail.caseInformation
              ? data.activity.caseDetail.caseInformation.breakdownLocation
              : null,
            breakdownLatitude: data.activity.caseDetail.caseInformation
              ? data.activity.caseDetail.caseInformation.breakdownLat
              : null,
            breakdownLongitude: data.activity.caseDetail.caseInformation
              ? data.activity.caseDetail.caseInformation.breakdownLong
              : null,
            customerName: data.activity.caseDetail.caseInformation
              ? data.activity.caseDetail.caseInformation.customerContactName
              : null,
            customerMobileNumber: data.activity.caseDetail.caseInformation
              ? data.activity.caseDetail.caseInformation.customerMobileNumber
              : null,
            aspId: data.aspId,
            aspCode: asp?.dataValues.code || null,
            aspName: asp?.dataValues.name || null,
            aspWorkshopName: asp?.dataValues.workshopName || null,
            aspContactNumber: asp?.dataValues.contactNumber || null,
            aspMechanicId: data.aspMechanicId,
            aspMechanicName: aspMechanic ? aspMechanic.dataValues.name : null,
            aspMechanicContactNumber: aspMechanic
              ? aspMechanic.dataValues.contactNumber
              : null,
            activityStatusId: data.activity.activityStatusId,
            activityStatusName: activityStatus
              ? activityStatus.dataValues.name
              : null,
            aspActivityStatusId: data.activity.aspActivityStatusId,
            aspActivityStatusName: aspActivityStatus
              ? aspActivityStatus.dataValues.name
              : null,
            aspServiceAcceptedAt: data.activity.aspServiceAcceptedAt
              ? moment
                .tz(data.activity.aspServiceAcceptedAt, "Asia/Kolkata")
                .format("DD/MM/YYYY hh:mm A")
              : null,
            customerNeedToPay: data.activity.customerNeedToPay,
            caseStatusId: data.activity.caseDetail.statusId,
            caseStatusName: caseStatus ? caseStatus.dataValues.name : null,
            caseCreatedDate: data.activity.caseDetail.createdAt
              ? moment
                .tz(data.activity.caseDetail.createdAt, "Asia/Kolkata")
                .format("DD/MM/YYYY")
              : null,
            canProceed: canProceed,
          });
        })
      );

      return res.status(200).json({
        success: true,
        message: "success",
        data: finalData,
      });
    } catch (error: any) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  // ACTIVITY DETAIL
  export async function fetchDataList(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData: any = [];
      const [
        caseSubject,
        subService,
        vehicleMake,
        vehicleModel,
        pickupLocationState,
        pickupLocationCity,
        dropLocationState,
        dropLocationCity,
        activityStatus,
        aspActivityStatus,
        activityAppStatus,
        financeStatus,
        dealerApprovalStatus,
        asp,
        aspMechanic,
        agent,
        activityFinanceStatuses,
        slaSettingDetails,
        breakdownAreaDetails,
        caseSlas,
        igstTaxDetail,
        slaViolationReasonDetail,
        activityAspLiveLocationResponse,
        hubCapInventoryLimit,
        speakerInventoryLimit,
        floorMatInventoryLimit,
        nonMembershipDetail
      ]: any = await Promise.all([
        CaseSubject.findOne({
          where: { id: inData.activity.caseDetail.subjectID },
          attributes: ["id", "name"],
        }),
        SubService.findOne({
          where: { id: inData.subServiceId },
          attributes: ["id", "name", "serviceId", "hasAspAssignment"],
          include: {
            model: Service,
            attributes: ["id", "name"],
            required: true,
          },
        }),
        VehicleMake.findOne({
          where: { id: inData.activity.caseDetail.vehicleMakeId },
          attributes: ["id", "name"],
        }),
        VehicleModel.findOne({
          where: { id: inData.activity.caseDetail.vehicleModelId },
          attributes: ["id", "name"],
        }),
        State.findOne({
          where: {
            id: inData.activity.caseDetail.deliveryRequestPickUpStateId,
          },
          attributes: ["id", "name"],
          paranoid: false,
        }),
        City.findOne({
          where: { id: inData.activity.caseDetail.deliveryRequestPickUpCityId },
          attributes: ["id", "name"],
          paranoid: false,
        }),
        State.findOne({
          where: { id: inData.activity.caseDetail.deliveryRequestDropStateId },
          attributes: ["id", "name"],
          paranoid: false,
        }),
        City.findOne({
          where: { id: inData.activity.caseDetail.deliveryRequestDropCityId },
          attributes: ["id", "name"],
          paranoid: false,
        }),
        ActivityStatus.findOne({
          where: { id: inData.activity.activityStatusId },
          attributes: ["id", "name"],
        }),
        AspActivityStatus.findOne({
          where: { id: inData.activity.aspActivityStatusId },
          attributes: ["id", "name"],
        }),
        ActivityAppStatus.findOne({
          where: { id: inData.activity.activityAppStatusId },
          attributes: ["id", "name"],
        }),
        ActivityFinanceStatus.findOne({
          where: { id: inData.activity.financeStatusId },
          attributes: ["id", "name"],
        }),
        Config.findOne({
          where: { id: inData.activity.dealerApprovalStatusId },
          attributes: ["id", "name"],
        }),
        Asp.findOne({
          where: { id: inData.aspId },
          attributes: {
            exclude: [
              "createdById",
              "updatedById",
              "deletedById",
              "createdAt",
              "updatedAt",
              "deletedAt",
            ],
          },
          paranoid: false,
        }),
        AspMechanic.findOne({
          where: { id: inData.aspMechanicId },
          attributes: {
            exclude: [
              "createdById",
              "updatedById",
              "deletedById",
              "createdAt",
              "updatedAt",
              "deletedAt",
            ],
          },
          paranoid: false,
        }),
        inData.activity.caseDetail.agentId
          ? axios
            .post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
              id: inData.activity.caseDetail.agentId,
            })
            .then((response) => response.data) // Ensure the promise resolves to the data directly
          : Promise.resolve(null), // Return a resolved promise with null value if agentId is not present
        ActivityFinanceStatus.findAll({
          where: {
            id: [2, 3],
          },
          attributes: ["id", "name"],
          order: [["id", "asc"]],
        }),
        SlaSetting.findAll({
          attributes: ["id", "typeId", "time", "locationTypeId"],
          where: { caseTypeId: inData.activity.caseDetail.typeId },
        }),

        inData.activity.caseDetail.caseInformation &&
          inData.activity.caseDetail.caseInformation.breakdownAreaId
          ? City.findOne({
            where: {
              id: inData.activity.caseDetail.caseInformation.breakdownAreaId,
            },
            attributes: ["id", "locationTypeId"],
            paranoid: false,
          })
          : Promise.resolve(null),

        axios.post(
          `${caseServiceUrl}/${endpoint.case.getAllSlaByCaseDetailId}`,
          { caseDetailId: inData.activity.caseDetailId }
        ),
        Tax.findOne({
          attributes: ["id", "percentage"],
          where: {
            id: 3, //IGST
          },
        }),

        inData.activity.slaViolationReasonId
          ? SlaViolateReason.findOne({
            attributes: ["id", "name"],
            where: {
              id: inData.activity.slaViolationReasonId,
            },
            paranoid: false,
          })
          : Promise.resolve(null),

        inData.activity.activityAspFromLocations.length > 0 &&
          inData.activity.activityAspToLocations.length > 0
          ? Utils.getGoogleDistanceDuration(
            inData.activity.activityAspFromLocations,
            inData.activity.activityAspToLocations,
            2
          )
          : Promise.resolve(null),

        Config.findOne({
          where: { typeId: 86 }, // HUB CAP INVENTORY LIMIT
          attributes: ["id", "name"],
        }),
        Config.findOne({
          where: { typeId: 87 }, // SPEAKER INVENTORY LIMIT
          attributes: ["id", "name"],
        }),
        Config.findOne({
          where: { typeId: 88 }, // FLOOR MAT INVENTORY LIMIT
          attributes: ["id", "name"],
        }),

        // Get membershipId from activityTransactions (non-membership transactions)
        // Check if activityTransactions exist in request data, otherwise check legacy nonMembershipId
        (() => {
          let membershipId = null;
          // First, try to get from activityTransactions (new approach)
          if (inData.activity.activityTransactions && inData.activity.activityTransactions.length > 0) {
            const nonMembershipTransaction = inData.activity.activityTransactions.find(
              (txn: any) => txn.paymentTypeId === 174 && txn.membershipId
            );
            if (nonMembershipTransaction) {
              membershipId = nonMembershipTransaction.membershipId;
            }
          }
          // Fallback to legacy nonMembershipId for backward compatibility
          if (!membershipId && inData.activity.nonMembershipId) {
            membershipId = inData.activity.nonMembershipId;
          }
          // Make API call if membershipId is available
          return membershipId ? axios.post(
            `${process.env.RSA_BASE_URL}/crm/get/nonMembership/cancellationInfo`,
            { nonMembershipId: membershipId }
          ) : Promise.resolve(null);
        })()
      ]);

      let pickupDealer: any = inData.activity.caseDetail.dealerId
        ? await Dealer.findOne({
          where: { id: inData.activity.caseDetail.dealerId },
          attributes: [
            "id",
            "code",
            "name",
            "mobileNumber",
            "email",
            "addressLineOne",
            "addressLineTwo",
            "correspondenceAddress",
            "area",
            "pincode",
            "lat",
            "long",
          ],
          paranoid: false,
        })
        : null;

      //IF SCHEME DEALER AND THE LOCATION TYPE IS CUSTOMER MEANS CHANGE THE PICKUP DETAILS
      if (
        !pickupDealer &&
        inData.activity.caseDetail.deliveryRequestSchemeId == 22 &&
        inData.activity.caseDetail.locationTypeId == 451 &&
        inData.activity.caseDetail.pickupLatitude &&
        inData.activity.caseDetail.pickupLongitude
      ) {
        pickupDealer = {
          id: null,
          code: null,
          name: null,
          mobileNumber: null,
          email: null,
          addressLineOne: null,
          addressLineTwo: null,
          correspondenceAddress:
            inData.activity.caseDetail.deliveryRequestPickUpLocation,
          area: null,
          pincode: null,
          lat: inData.activity.caseDetail.pickupLatitude,
          long: inData.activity.caseDetail.pickupLongitude,
        };
      }

      let dropDealer: any = inData.activity.caseDetail
        .deliveryRequestDropDealerId
        ? await Dealer.findOne({
          where: {
            id: inData.activity.caseDetail.deliveryRequestDropDealerId,
          },
          attributes: [
            "id",
            "code",
            "name",
            "mobileNumber",
            "email",
            "addressLineOne",
            "addressLineTwo",
            "correspondenceAddress",
            "area",
            "pincode",
            "lat",
            "long",
          ],
          paranoid: false,
        })
        : null;

      //IF SCHEME DEALER AND THE LOCATION TYPE IS CUSTOMER MEANS CHANGE THE DROP DETAILS
      if (
        !dropDealer &&
        inData.activity.caseDetail.deliveryRequestSchemeId == 22 &&
        inData.activity.caseDetail.locationTypeId == 451 &&
        inData.activity.caseDetail.dropLatitude &&
        inData.activity.caseDetail.dropLongitude
      ) {
        dropDealer = {
          id: null,
          code: null,
          name: null,
          mobileNumber: null,
          email: null,
          addressLineOne: null,
          addressLineTwo: null,
          correspondenceAddress:
            inData.activity.caseDetail.deliveryRequestDropLocation,
          area: null,
          pincode: null,
          lat: inData.activity.caseDetail.dropLatitude,
          long: inData.activity.caseDetail.dropLongitude,
        };
      }

      let aspRejectReason = null;
      if (inData.rejectReasonId && inData.rejectReasonId != null) {
        const aspActivityRejectReason = await AspActivityRejectReason.findByPk(
          inData.rejectReasonId
        );
        aspRejectReason = aspActivityRejectReason
          ? aspActivityRejectReason.dataValues.name
          : null;
      }

      let aspCancelReason = null;
      if (inData.cancelReasonId && inData.cancelReasonId != null) {
        const aspActivityCancelReason = await AspActivityCancelReason.findByPk(
          inData.cancelReasonId
        );
        aspCancelReason = aspActivityCancelReason
          ? aspActivityCancelReason.dataValues.name
          : null;
      }

      const chargesData: any = [];
      if (inData.activity.activityCharges.length > 0) {
        for (const activityCharge of inData.activity.activityCharges) {
          const charge = await AdditionalCharge.findOne({
            where: { id: activityCharge.chargeId },
          });
          if (charge) {
            await chargesData.push({
              id: activityCharge.id,
              typeId: activityCharge.typeId,
              chargeId: activityCharge.chargeId,
              chargeName: charge.dataValues.name,
              amount: activityCharge.amount,
            });
          }
        }
      }

      const inventoryData: any = [];
      if (inData.activity.activityInventories.length > 0) {
        for (const activityInventory of inData.activity.activityInventories) {
          const inventory = await Inventory.findOne({
            where: { id: activityInventory.inventoryId },
          });
          if (inventory) {
            await inventoryData.push({
              id: activityInventory.id,
              typeId: activityInventory.typeId,
              inventoryId: activityInventory.inventoryId,
              inventoryName: inventory.dataValues.name,
            });
          }
        }
      }

      const transactionData: any = [];
      let advancePaidActivityTransactions: any = [];
      if (inData.activity.activityTransactions.length > 0) {
        for (const activityTransaction of inData.activity
          .activityTransactions) {
          transactionData.push({
            id: activityTransaction.id,
            activityId: activityTransaction.activityId,
            dealerId: activityTransaction.dealerId,
            date: moment
              .tz(activityTransaction.date, "Asia/Kolkata")
              .format("DD/MM/YYYY"),
            paymentMethodId: activityTransaction.paymentMethodId,
            paymentTypeId: activityTransaction.paymentTypeId,
            transactionTypeId: activityTransaction.transactionTypeId,
            amount: activityTransaction.amount,
            paymentStatusId: activityTransaction.paymentStatusId,
            refundStatusId: activityTransaction.refundStatusId,
            refundId: activityTransaction.refundId,
            paidByDealerId: activityTransaction.paidByDealerId,
            createdAt: moment
              .tz(activityTransaction.createdAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A"),
            updatedAt: moment
              .tz(activityTransaction.updatedAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A"),
          });
        }

        // DELIVERY REQUEST
        if (inData.activity.caseDetail.typeId == 32) {
          advancePaidActivityTransactions =
            inData.activity.activityTransactions.filter(
              (activityTransaction: any) =>
                activityTransaction.paymentTypeId == 170 &&
                activityTransaction.transactionTypeId == 181 &&
                activityTransaction.paymentStatusId == 191 &&
                (activityTransaction.refundStatusId == null ||
                  activityTransaction.refundStatusId == 1303)
            );
        } else if (inData.activity.caseDetail.typeId == 31) {
          // RSA
          advancePaidActivityTransactions =
            inData.activity.activityTransactions.filter(
              (activityTransaction: any) =>
                activityTransaction.paymentTypeId == 174 &&
                activityTransaction.transactionTypeId == 181 &&
                activityTransaction.paymentStatusId == 191 &&
                (activityTransaction.refundStatusId == null ||
                  activityTransaction.refundStatusId == 1303)
            );
        }
      }

      const activityLogData: any = [];
      if (inData.activityLogs.length > 0) {
        for (const activityLog of inData.activityLogs) {
          let channel = null;
          let interactionTo = null;
          let callType = null;
          //INTERACTION TYPE
          if (activityLog.typeId == 242) {
            const channelExists = await Config.findOne({
              where: { id: activityLog.channelId },
            });
            channel = channelExists ? channelExists.dataValues.name : null;
            const interactionToExists = await Config.findOne({
              where: { id: activityLog.toId },
            });
            interactionTo = interactionToExists
              ? interactionToExists.dataValues.name
              : null;
            const callTypeExists = await Config.findOne({
              where: { id: activityLog.callTypeId },
            });
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
            createdAtInMilliSeconds: activityLog.createdAt
              ? moment.tz(activityLog.createdAt, "Asia/Kolkata").valueOf()
              : null,
          });
        }
      }

      let aspLiveLocationLat = null;
      let aspLiveLocationLong = null;
      if (inData.activity.activityAspLiveLocations.length > 0) {
        aspLiveLocationLat =
          inData.activity.activityAspLiveLocations[0].latitude;
        aspLiveLocationLong =
          inData.activity.activityAspLiveLocations[0].longitude;
      }

      let caseInformation: any = {};
      if (inData.activity.caseDetail.caseInformation) {
        caseInformation.caseTypeId =
          inData.activity.caseDetail.caseInformation.caseTypeId;
        caseInformation.serviceEligibilityId =
          inData.activity.caseDetail.caseInformation.serviceEligibilityId;
        caseInformation.policyNumber =
          inData.activity.caseDetail.caseInformation.policyNumber;
        caseInformation.policyTypeId =
          inData.activity.caseDetail.caseInformation.policyTypeId;
        caseInformation.policyStartDate =
          inData.activity.caseDetail.caseInformation.policyStartDate;
        caseInformation.policyEndDate =
          inData.activity.caseDetail.caseInformation.policyEndDate;
        caseInformation.customerContactName =
          inData.activity.caseDetail.caseInformation.customerContactName;
        caseInformation.customerMobileNumber =
          inData.activity.caseDetail.caseInformation.customerMobileNumber;
        caseInformation.customerCurrentContactName =
          inData.activity.caseDetail.caseInformation.customerCurrentContactName;
        caseInformation.customerCurrentMobileNumber =
          inData.activity.caseDetail.caseInformation.customerCurrentMobileNumber;
        caseInformation.customerAlternateMobileNumber =
          inData.activity.caseDetail.caseInformation.customerAlternateMobileNumber;
        caseInformation.voiceOfCustomer =
          inData.activity.caseDetail.caseInformation.voiceOfCustomer;
        caseInformation.breakdownLocation =
          inData.activity.caseDetail.caseInformation.breakdownLocation;
        caseInformation.breakdownLat =
          inData.activity.caseDetail.caseInformation.breakdownLat;
        caseInformation.breakdownLong =
          inData.activity.caseDetail.caseInformation.breakdownLong;
        caseInformation.dropLocation =
          inData.activity.caseDetail.caseInformation.dropLocation;
        caseInformation.dropDealerId =
          inData.activity.caseDetail.caseInformation.dropDealerId;
        caseInformation.dropLocationLat =
          inData.activity.caseDetail.caseInformation.dropLocationLat;
        caseInformation.dropLocationLong =
          inData.activity.caseDetail.caseInformation.dropLocationLong;
        caseInformation.runningKm =
          inData.activity.caseDetail.caseInformation.runningKm;
        caseInformation.breakdownAreaLocationTypeId = breakdownAreaDetails
          ? breakdownAreaDetails.locationTypeId
          : null;
      }

      const slaSettings = slaSettingDetails.map((slaSettingDetail: any) => ({
        ...slaSettingDetail.toJSON(),
        timeInMilliSeconds: slaSettingDetail.time * 1000,
      }));

      const extras = {
        activityFinanceStatuses,
        slaSettings,
      };

      let reimbursementDetails = null;
      if (inData.activity.reimbursementTransaction) {
        const [paymentMethod, paymentStatus]: any = await Promise.all([
          PaymentMethod.findOne({
            attributes: ["id", "name"],
            where: {
              id: inData.activity.reimbursementTransaction.paymentMethodId,
            },
            paranoid: false,
          }),
          Config.findOne({
            attributes: ["id", "name"],
            where: {
              id: inData.activity.reimbursementTransaction.paymentStatusId,
            },
          }),
        ]);

        reimbursementDetails = {
          paymentMethod: paymentMethod ? paymentMethod.name : null,
          paymentStatus: paymentStatus ? paymentStatus.name : null,
          ...inData.activity.reimbursementTransaction,
        };
      }

      const estimatedServiceCost = inData.estimatedServiceCost ?? 0;
      const estimatedAdditionalCharge = inData.estimatedAdditionalCharge ?? 0;
      const discountAmount = inData.discountAmount ?? 0;
      const estimatedTaxableValue =
        +estimatedServiceCost + +estimatedAdditionalCharge - +discountAmount;

      const actualServiceCost = inData.actualServiceCost ?? 0;
      const actualAdditionalCharge = inData.actualAdditionalCharge ?? 0;
      const actualClientWaitingCharge = inData.actualClientWaitingCharge ?? 0;
      const actualTaxableValue =
        +actualServiceCost +
        +actualAdditionalCharge +
        +actualClientWaitingCharge;

      if (asp && asp.rmId) {
        const rmDetails = await axios.post(
          `${userServiceUrl}/${userServiceEndpoint.getUser}`,
          {
            id: asp.rmId,
          }
        );
        if (rmDetails && rmDetails.data.success) {
          asp.rmName = rmDetails.data.user.name;
          asp.rmContactNumber = rmDetails.data.user.mobileNumber;
        }
      }

      let showLorryReceiptDownloadButton = false;
      // SHOW LORRY RECEIPT DOWNLOAD BUTTON ONCE DEALER MAKES THE ADVANCE PAYMENT
      if (
        inData.activity.caseDetail.typeId == 32 &&
        (inData.activity.caseDetail.statusId == 2 ||
          inData.activity.caseDetail.statusId == 4) &&
        (inData.activity.activityStatusId == 3 ||
          inData.activity.activityStatusId == 7 ||
          inData.activity.activityStatusId == 10 ||
          inData.activity.activityStatusId == 11 ||
          inData.activity.activityStatusId == 12)
      ) {
        showLorryReceiptDownloadButton = true;
      }

      await finalData.push({
        activityId: inData.activityId,
        service: subService ? subService.service.dataValues.name : null,
        serviceId: subService ? subService.dataValues.serviceId : null,
        subServiceId: subService ? subService.dataValues.id : null,
        subService: subService ? subService.dataValues.name : null,
        subServiceHasAspAssignment: subService
          ? subService.dataValues.hasAspAssignment
          : null,
        activityStatusId: inData.activity.activityStatusId,
        activityStatus: activityStatus ? activityStatus.dataValues.name : null,
        aspActivityStatusId: inData.activity.aspActivityStatusId,
        aspActivityStatus: aspActivityStatus
          ? aspActivityStatus.dataValues.name
          : null,
        activityAppStatusId: inData.activity.activityAppStatusId,
        activityAppStatus: activityAppStatus
          ? activityAppStatus.dataValues.name
          : null,
        financeStatusId: inData.activity.financeStatusId,
        financeStatus: financeStatus ? financeStatus.dataValues.name : null,
        dealerApprovalStatusId: inData.activity.dealerApprovalStatusId,
        dealerApprovalStatus: dealerApprovalStatus
          ? dealerApprovalStatus.dataValues.name
          : null,
        aspVehicleRegistrationNumber: inData.aspVehicleRegistrationNumber,
        estimatedOnlineKm: inData.estimatedOnlineKm,
        estimatedRouteDeviationKm: inData.estimatedRouteDeviationKm,
        estimatedTotalKm: inData.estimatedTotalKm,
        estimatedTotalDuration: inData.estimatedTotalDuration,
        estimatedAspToPickupKm: inData.estimatedAspToPickupKm,
        estimatedAspToPickupKmDuration: inData.estimatedAspToPickupKmDuration,
        estimatedPickupToDropKm: inData.estimatedPickupToDropKm,
        estimatedPickupToDropKmDuration: inData.estimatedPickupToDropKmDuration,
        estimatedAspToBreakdownKm: inData.estimatedAspToBreakdownKm,
        estimatedAspToBreakdownKmDuration:
          inData.estimatedAspToBreakdownKmDuration,
        estimatedAspToBreakdownInfo:
          inData.estimatedAspToBreakdownKm &&
            inData.estimatedAspToBreakdownKmDuration
            ? inData.activity.caseDetail.statusId != 4
              ? `${parseFloat(
                inData.estimatedAspToBreakdownKm
              )} KM to Breakdown (${inData.estimatedAspToBreakdownKmDuration
              })`
              : `${parseFloat(
                inData.estimatedAspToBreakdownKm
              )} KM to Breakdown`
            : null,
        estimatedBreakdownToAspKm: inData.estimatedBreakdownToAspKm,
        estimatedBreakdownToAspKmDuration:
          inData.estimatedBreakdownToAspKmDuration,
        estimatedBreakdownToDropKm: inData.estimatedBreakdownToDropKm,
        estimatedBreakdownToDropKmDuration:
          inData.estimatedBreakdownToDropKmDuration,
        estimatedDropToAspKm: inData.estimatedDropToAspKm,
        estimatedDropToAspKmDuration: inData.estimatedDropToAspKmDuration,
        estimatedServiceCost: inData.estimatedServiceCost ?? "0.00",
        estimatedAdditionalCharge: inData.estimatedAdditionalCharge,
        discountPercentage: inData.discountPercentage,
        discountAmount: inData.discountAmount,
        discountReasonId: inData.discountReasonId,
        discountReason: inData.discountReason,
        estimatedTaxableValue: estimatedTaxableValue
          ? estimatedTaxableValue.toFixed(2)
          : "0.00",
        estimatedTotalTax: inData.estimatedTotalTax ?? "0.00",
        estimatedTotalAmount: inData.estimatedTotalAmount ?? "0.00",
        actualTotalKm: inData.actualTotalKm,
        actualTotalKmReason: inData.actualTotalKmReason,
        actualServiceCost: inData.actualServiceCost ?? "0.00",
        actualAdditionalCharge: inData.actualAdditionalCharge,
        actualClientWaitingCharge: inData.actualClientWaitingCharge,
        actualTaxableValue: actualTaxableValue
          ? actualTaxableValue.toFixed(2)
          : "0.00",
        actualTotalTax: inData.actualTotalTax ?? "0.00",
        actualTotalAmount: inData.actualTotalAmount ?? "0.00",
        estimatedAspServiceCost: inData.estimatedAspServiceCost,
        estimatedAspTotalAmount: inData.estimatedAspTotalAmount,
        actualAspServiceCost: inData.actualAspServiceCost,
        actualAspWaitingCharge: inData.actualAspWaitingCharge,
        actualAspTotalAmount: inData.actualAspTotalAmount,
        activityNumber: inData.activity.activityNumber,
        aspWaitingTime: inData.activity.aspWaitingTime,
        enableAspWaitingTimeInApp: inData.activity.enableAspWaitingTimeInApp
          ? true
          : false,
        isAspAcceptedCcDetail: inData.activity.isAspAcceptedCcDetail,
        aspRejectedCcDetailReasonId:
          inData.activity.aspRejectedCcDetailReasonId,

        aspServiceAcceptedAt: inData.activity.aspServiceAcceptedAt
          ? moment
            .tz(inData.activity.aspServiceAcceptedAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        aspServiceAcceptedAtInMilliSeconds: inData.activity.aspServiceAcceptedAt
          ? moment
            .tz(inData.activity.aspServiceAcceptedAt, "Asia/Kolkata")
            .valueOf()
          : null,
        aspEndServiceAt: inData.activity.aspEndServiceAt
          ? moment
            .tz(inData.activity.aspEndServiceAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        sentApprovalAt: inData.activity.sentApprovalAt
          ? moment
            .tz(inData.activity.sentApprovalAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        sentApprovalAtInMilliSeconds: inData.activity.sentApprovalAt
          ? moment.tz(inData.activity.sentApprovalAt, "Asia/Kolkata").valueOf()
          : null,
        rejectReason: aspRejectReason,
        cancelReason: aspCancelReason,
        hasTrackingLink:
          aspLiveLocationLat && aspLiveLocationLong ? true : false,
        asp: asp,
        aspMechanic: aspMechanic,
        caseDetail: {
          id: inData.activity.caseDetail.id,
          typeId: inData.activity.caseDetail.typeId,
          caseNumber: inData.activity.caseDetail.caseNumber,
          clientId: inData.activity.caseDetail.clientId,
          agentId: inData.activity.caseDetail.agentId,
          agentName: agent?.user?.name || null,
          agentAssignedAt: inData.activity.caseDetail.agentAssignedAt
            ? moment
              .tz(inData.activity.caseDetail.agentAssignedAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A")
            : null,
          agentAssignedAtInMilliSeconds: inData.activity.caseDetail
            .agentAssignedAt
            ? moment
              .tz(inData.activity.caseDetail.agentAssignedAt, "Asia/Kolkata")
              .valueOf()
            : null,
          caseSubject: caseSubject ? caseSubject.dataValues.name : null,
          subServiceId: subService ? subService.dataValues.id : null,
          subService: subService ? subService.dataValues.name : null,
          registrationNumber: inData.activity.caseDetail.registrationNumber,
          vin: inData.activity.caseDetail.vin,
          vehicleMake: vehicleMake ? vehicleMake.dataValues.name : null,
          vehicleModel: vehicleModel ? vehicleModel.dataValues.name : null,
          statusId: inData.activity.caseDetail.statusId,
          pickupLocation:
            inData.activity.caseDetail.deliveryRequestPickUpLocation,
          pickupLocationState: pickupLocationState
            ? pickupLocationState.dataValues.name
            : null,
          pickupLocationStateId: pickupLocationState
            ? pickupLocationState.dataValues.id
            : null,
          pickupLocationCity: pickupLocationCity
            ? pickupLocationCity.dataValues.name
            : null,
          pickupLocationCityId: pickupLocationCity
            ? pickupLocationCity.dataValues.id
            : null,
          dropLocation: inData.activity.caseDetail.deliveryRequestDropLocation,
          dropLocationState: dropLocationState
            ? dropLocationState.dataValues.name
            : null,
          dropLocationStateId: dropLocationState
            ? dropLocationState.dataValues.id
            : null,
          dropLocationCity: dropLocationCity
            ? dropLocationCity.dataValues.name
            : null,
          dropLocationCityId: dropLocationCity
            ? dropLocationCity.dataValues.id
            : null,
          contactNameAtPickUp: inData.activity.caseDetail.contactNameAtPickUp,
          contactNumberAtPickUp:
            inData.activity.caseDetail.contactNumberAtPickUp,
          contactNameAtDrop: inData.activity.caseDetail.contactNameAtDrop,
          contactNumberAtDrop: inData.activity.caseDetail.contactNumberAtDrop,
          deliveryRequestPickupDate: inData.activity.caseDetail
            .deliveryRequestPickupDate
            ? moment
              .tz(
                inData.activity.caseDetail.deliveryRequestPickupDate,
                "Asia/Kolkata"
              )
              .format("DD/MM/YYYY")
            : null,
          deliveryRequestPickupTime:
            inData.activity.caseDetail.deliveryRequestPickupTime,
          description: inData.activity.caseDetail.description,
          createdDate: inData.activity.caseDetail.createdAt
            ? moment
              .tz(inData.activity.caseDetail.createdAt, "Asia/Kolkata")
              .format("DD-MM-YYYY")
            : null,
          caseCreatedDateTime: moment
            .tz(inData.activity.caseDetail.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          createdAtInMilliSeconds: inData.activity.caseDetail.createdAt
            ? moment
              .tz(inData.activity.caseDetail.createdAt, "Asia/Kolkata")
              .valueOf()
            : null,
          pickupDealer: pickupDealer,
          dropDealer: dropDealer,
          caseInformation: caseInformation,
          deliveryRequestSchemeId:
            inData.activity.caseDetail.deliveryRequestSchemeId,
          locationTypeId: inData.activity.caseDetail.locationTypeId,
        },
        chargesDetail: chargesData,
        inventoryDetail: inventoryData,
        transactions: transactionData,
        activityLogs: activityLogData,
        issueComments: inData.activity.issueComments,
        issueIdentificationAttachments: inData.activity
          .issueIdentificationAttachments
          ? inData.activity.issueIdentificationAttachments
          : null,
        serviceStartDateTime: inData.activity.serviceStartDateTime
          ? moment
            .tz(inData.activity.serviceStartDateTime, "Asia/Kolkata")
            .format("DD/MM/YYYY HH:mm:ss")
          : null,
        serviceResumeDateTime: inData.activity.serviceResumeDateTime
          ? moment
            .tz(inData.activity.serviceResumeDateTime, "Asia/Kolkata")
            .format("DD/MM/YYYY HH:mm:ss")
          : null,
        serviceEndDateTime: inData.activity.serviceEndDateTime
          ? moment
            .tz(inData.activity.serviceEndDateTime, "Asia/Kolkata")
            .format("DD/MM/YYYY HH:mm:ss")
          : null,
        serviceDuration: inData.activity.serviceDuration
          ? Utils.secondsToTime(inData.activity.serviceDuration)
          : null,
        serviceDurationInSeconds: inData.activity.serviceDuration
          ? inData.activity.serviceDuration
          : null,
        isServiceTimerRunning: inData.activity.isServiceTimerRunning,
        serviceStatus: inData.activity.serviceStatus,
        aspReachedToBreakdownAt: inData.activity.aspReachedToBreakdownAt
          ? moment
            .tz(inData.activity.aspReachedToBreakdownAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        aspReachedToBreakdownFormattedDateTime: inData.activity
          .aspReachedToBreakdownAt
          ? inData.activity.caseDetail.statusId == 4
            ? moment
              .tz(inData.activity.aspReachedToBreakdownAt, "Asia/Kolkata")
              .format("DD/MM/YYYY HH:mm:ss")
            : moment
              .tz(inData.activity.aspReachedToBreakdownAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A")
          : null,
        aspReachedToDropAt: inData.activity.aspReachedToDropAt
          ? moment
            .tz(inData.activity.aspReachedToDropAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        rsaActivityInventory: inData.activity.rsaActivityInventories
          ? inData.activity.rsaActivityInventories
          : null,
        rsaActivityInventoryAttachments: inData.activity
          .rsaActivityInventoryAttachments
          ? inData.activity.rsaActivityInventoryAttachments
          : null,
        additionalServiceRequested: inData.activity.additionalServiceRequested,
        custodyRequested: inData.activity.custodyRequested,
        isCustodySelf: inData.activity.isCustodySelf,
        isCustodyAspArrived: inData.activity.isCustodyAspArrived,
        cabAssistanceRequested: inData.activity.cabAssistanceRequested,
        isCabAssistanceSelf: inData.activity.isCabAssistanceSelf,
        isCustomerInvoiced: inData.activity.isCustomerInvoiced,
        customerInvoiceNumber: inData.activity.customerInvoiceNumber,
        agentPickedAt: inData.activity.agentPickedAt
          ? moment
            .tz(inData.activity.agentPickedAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        agentPickedAtInMilliSeconds: inData.activity.agentPickedAt
          ? moment.tz(inData.activity.agentPickedAt, "Asia/Kolkata").valueOf()
          : null,
        customerInvoiceDate: inData.activity.customerInvoiceDate
          ? moment
            .tz(inData.activity.customerInvoiceDate, "Asia/Kolkata")
            .format("DD/MM/YYYY")
          : null,
        customerInvoicePath: inData.activity.customerInvoicePath
          ? `${process.env.RSA_WEB_BASE_URL}${inData.activity.customerInvoicePath}`
          : null,
        remarks: inData.activity.remarks,
        otherServiceAttachments: inData.activity.otherServiceAttachments
          ? inData.activity.otherServiceAttachments
          : null,

        customerNeedToPay: inData.activity.customerNeedToPay,
        advancePaymentMethodId: inData.activity.advancePaymentMethodId,
        sendPaymentLinkTo: inData.activity.sendPaymentLinkTo,
        nonMembershipType: inData.activity.nonMembershipType,
        additionalChargeableKm: inData.activity.additionalChargeableKm,

        isReimbursement: inData.activity.isReimbursement,
        reimbursementComments: inData.activity.reimbursementComments,
        reimbursementDetails,
        extras,
        activityCreatedAtInMilliSeconds: inData.activity.createdAt
          ? moment.tz(inData.activity.createdAt, "Asia/Kolkata").valueOf()
          : null,
        isInitiallyCreated: inData.activity.isInitiallyCreated,
        isImmediateService: inData.activity.isImmediateService,
        serviceInitiatingAt: inData.activity.serviceInitiatingAt,
        serviceInitiatingAtInMilliSeconds: inData.activity.serviceInitiatingAt
          ? moment
            .tz(inData.activity.serviceInitiatingAt, "Asia/Kolkata")
            .valueOf()
          : null,
        serviceExpectedAt: inData.activity.serviceExpectedAt,
        slaViolateCheckBaseMilliSeconds:
          inData.activity.slaViolateCheckBaseMilliSeconds,
        aspSlaStatus: await Utils.getAspSlaStatus(
          inData.activity.caseDetail,
          inData.activity,
          caseSlas,
          inData.activity.crmSlas,
          advancePaidActivityTransactions
        ),
        igstTaxPercentage: igstTaxDetail ? igstTaxDetail.percentage : null,
        breakdownReachSlaStatus: inData.activity.breakdownReachSlaStatus
          ? inData.activity.breakdownReachSlaStatus
          : null,
        aspReachedToPickupAt: inData.activity.aspReachedToPickupAt
          ? moment
            .tz(inData.activity.aspReachedToPickupAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        aspReachedToPickupFormattedDateTime: inData.activity
          .aspReachedToPickupAt
          ? inData.activity.caseDetail.statusId == 4
            ? moment
              .tz(inData.activity.aspReachedToPickupAt, "Asia/Kolkata")
              .format("DD/MM/YYYY HH:mm:ss")
            : moment
              .tz(inData.activity.aspReachedToPickupAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A")
          : null,

        bdOrPickupReachSlaViolationReason: slaViolationReasonDetail
          ? slaViolationReasonDetail.dataValues.name
          : null,
        aspActualKmTravelled: activityAspLiveLocationResponse?.[0]
          ?.elements?.[0]?.distance?.value
          ? (
            activityAspLiveLocationResponse[0].elements[0].distance.value /
            1000
          ).toFixed(2) + " km"
          : "0 km",

        hubCapInventoryLimit: hubCapInventoryLimit?.dataValues?.name || "10",
        speakerInventoryLimit: speakerInventoryLimit?.dataValues?.name || "10",
        floorMatInventoryLimit:
          floorMatInventoryLimit?.dataValues?.name || "10",
        showLorryReceiptDownloadButton: showLorryReceiptDownloadButton,
        dealerAttachments: inData.activity.dealerAttachments
          ? inData.activity.dealerAttachments
          : null,
        dealerDocumentComments: inData.activity.dealerDocumentComments
          ? inData.activity.dealerDocumentComments
          : null,
        bankDetailAttachments: inData.activity.bankDetailAttachments
          ? inData.activity.bankDetailAttachments
          : null,
        digitalInventoryAttachments: inData.activity.digitalInventoryAttachments
          ? inData.activity.digitalInventoryAttachments
          : null,
        hasAdditionalKmForPayment: inData.activity.hasAdditionalKmForPayment,
        additionalKmForPayment: inData.activity.additionalKmForPayment,
        paymentForAdditionalKmCaptured:
          inData.activity.paymentForAdditionalKmCaptured,
        customerAgreedToAdditionalPayment:
          inData.activity.customerAgreedToAdditionalPayment,
        additionalPaymentRemarks: inData.activity.additionalPaymentRemarks,
        additionalKmEstimatedTotalAmount: inData.additionalKmEstimatedTotalAmount,
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

  // ACTIVITY DETAIL - BuddyApp
  export async function fetchDataListBuddyApp(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const [
        caseSubject,
        subService,
        service,
        vehicleMake,
        vehicleModel,
        activityStatus,
        aspActivityStatus,
        asp,
        aspMechanic,
        caseStatus,
      ]: any = await Promise.all([
        CaseSubject.findOne({
          where: { id: inData.activity.caseDetail.subjectID },
          attributes: ["id", "name"],
        }),
        SubService.findOne({
          where: { id: inData.subServiceId },
          attributes: ["id", "name", "serviceId", "hasAspAssignment"],
          include: {
            model: Service,
            attributes: ["id", "name"],
            required: true,
          },
        }),
        Service.findOne({
          where: { id: inData.serviceId },
          attributes: ["id", "name"],
        }),
        VehicleMake.findOne({
          where: { id: inData.activity.caseDetail.vehicleMakeId },
          attributes: ["id", "name"],
        }),
        VehicleModel.findOne({
          where: { id: inData.activity.caseDetail.vehicleModelId },
          attributes: ["id", "name"],
        }),
        ActivityStatus.findOne({
          where: { id: inData.activity.activityStatusId },
          attributes: ["id", "name"],
        }),
        AspActivityStatus.findOne({
          where: { id: inData.activity.aspActivityStatusId },
          attributes: ["id", "name"],
        }),
        Asp.findOne({
          where: { id: inData.aspId },
          attributes: ["id", "name", "code", "workshopName", "contactNumber"],
          paranoid: false,
        }),
        AspMechanic.findOne({
          where: { id: inData.aspMechanicId },
          attributes: ["id", "name", "contactNumber"],
          paranoid: false,
        }),
        CaseStatus.findOne({
          where: { id: inData.activity.caseDetail.statusId },
          attributes: ["id", "name"],
        }),
      ]);

      const finalData = {
        activityId: inData.activityId,
        caseId: inData.activity.caseDetailId,
        caseNumber: inData.activity.caseDetail.caseNumber,
        caseSubject: caseSubject ? caseSubject.dataValues.name : null,
        serviceId: service ? service.dataValues.id : null,
        serviceName: service ? service.dataValues.name : null,
        subServiceId: subService ? subService.dataValues.id : null,
        subServiceName: subService ? subService.dataValues.name : null,
        vehicleNumber: inData.activity.caseDetail.registrationNumber
          ? inData.activity.caseDetail.registrationNumber
          : null,
        vehicleMakeName: vehicleMake ? vehicleMake.dataValues.name : null,
        vehicleModelName: vehicleModel ? vehicleModel.dataValues.name : null,
        breakdownLocation: inData.activity.caseDetail.caseInformation
          ? inData.activity.caseDetail.caseInformation.breakdownLocation
          : null,
        breakdownLatitude: inData.activity.caseDetail.caseInformation
          ? inData.activity.caseDetail.caseInformation.breakdownLat
          : null,
        breakdownLongitude: inData.activity.caseDetail.caseInformation
          ? inData.activity.caseDetail.caseInformation.breakdownLong
          : null,
        customerName: inData.activity.caseDetail.caseInformation
          ? inData.activity.caseDetail.caseInformation.customerContactName
          : null,
        customerMobileNumber: inData.activity.caseDetail.caseInformation
          ? inData.activity.caseDetail.caseInformation.customerMobileNumber
          : null,
        aspId: inData.aspId,
        aspCode: asp?.dataValues.code || null,
        aspName: asp?.dataValues.name || null,
        aspWorkshopName: asp?.dataValues.workshopName || null,
        aspContactNumber: asp?.dataValues.contactNumber || null,
        aspMechanicId: inData.aspMechanicId,
        aspMechanicName: aspMechanic ? aspMechanic.dataValues.name : null,
        aspMechanicContactNumber: aspMechanic
          ? aspMechanic.dataValues.contactNumber
          : null,
        activityStatusId: inData.activity.activityStatusId,
        activityStatusName: activityStatus
          ? activityStatus.dataValues.name
          : null,
        aspActivityStatusId: inData.activity.aspActivityStatusId,
        aspActivityStatusName: aspActivityStatus
          ? aspActivityStatus.dataValues.name
          : null,
        aspServiceAcceptedAt: inData.activity.aspServiceAcceptedAt
          ? moment
            .tz(inData.activity.aspServiceAcceptedAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        customerNeedToPay: inData.activity.customerNeedToPay,
        caseStatusId: inData.activity.caseDetail.statusId,
        caseStatusName: caseStatus ? caseStatus.dataValues.name : null,
        caseCreatedDate: inData.activity.caseDetail.createdAt
          ? moment
            .tz(inData.activity.caseDetail.createdAt, "Asia/Kolkata")
            .format("DD/MM/YYYY")
          : null,
      };

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

  export async function searchMasterData(req: Request, res: Response) {
    try {
      const search = req.query.search;
      if (!search) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }
      return res.status(200).json({
        success: true,
        message: "success",
        data: await Utils.searchMasterData(search),
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET ACTIVITY SERVICE DETAIL
  export async function getServiceDetail(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData: any = [];
      const [
        activityStatus,
        aspActivityStatus,
        dealerApprovalStatus,
        asp,
        aspMechanic,
      ] = await Promise.all([
        ActivityStatus.findOne({
          where: { id: inData.activity.activityStatusId },
          attributes: ["id", "name"],
        }),
        AspActivityStatus.findOne({
          where: { id: inData.activity.aspActivityStatusId },
          attributes: ["id", "name"],
        }),
        Config.findOne({
          where: { id: inData.activity.dealerApprovalStatusId },
          attributes: ["id", "name"],
        }),
        Asp.findOne({
          where: { id: inData.aspId },
          paranoid: false,
        }),
        AspMechanic.findOne({
          where: { id: inData.aspMechanicId },
          paranoid: false,
        }),
      ]);

      const chargesData: any = [];
      if (inData.activity.activityCharges.length > 0) {
        for (const activityCharge of inData.activity.activityCharges) {
          const charge = await AdditionalCharge.findOne({
            where: { id: activityCharge.chargeId },
          });
          if (charge) {
            await chargesData.push({
              id: activityCharge.id,
              typeId: activityCharge.typeId,
              chargeId: activityCharge.chargeId,
              chargeName: charge.dataValues.name,
              amount: activityCharge.amount,
            });
          }
        }
      }

      let caseLocationDetails: any = {};
      //RSA
      if (inData.activity.caseDetail.typeId == 31) {
        caseLocationDetails = {
          breakdownLocation: inData.breakdownLocationData,
          dropLocation: inData.dropLocationData,
        };
      } else if (inData.activity.caseDetail.typeId == 32) {
        //VDM
        caseLocationDetails = {
          pickupLocation: inData.pickupLocationData,
          dropLocation: inData.dropLocationData,
        };
      }

      await finalData.push({
        activityId: inData.activityId,
        activityStatusId: inData.activity.activityStatusId,
        activityStatus: activityStatus ? activityStatus.dataValues.name : null,
        aspActivityStatusId: inData.activity.aspActivityStatusId,
        aspActivityStatus: aspActivityStatus
          ? aspActivityStatus.dataValues.name
          : null,
        dealerApprovalStatusId: inData.activity.dealerApprovalStatusId,
        dealerApprovalStatus: dealerApprovalStatus
          ? dealerApprovalStatus.dataValues.name
          : null,

        expectedServiceStartDateTime: inData.activity
          .expectedServiceStartDateTime
          ? moment
            .tz(inData.activity.expectedServiceStartDateTime, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        expectedServiceEndDateTime: inData.activity.expectedServiceEndDateTime
          ? moment
            .tz(inData.activity.expectedServiceEndDateTime, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A")
          : null,
        comments: inData.activity.comments,

        aspVehicleRegistrationNumber: inData.aspVehicleRegistrationNumber,
        estimatedOnlineKm: inData.estimatedOnlineKm,
        estimatedRouteDeviationKm: inData.estimatedRouteDeviationKm,
        estimatedTotalKm: inData.estimatedTotalKm,
        estimatedAspToPickupKm: inData.estimatedAspToPickupKm,
        estimatedAspToPickupKmDuration: inData.estimatedAspToPickupKmDuration,
        estimatedAspToBreakdownKm: inData.estimatedAspToBreakdownKm,
        estimatedAspToBreakdownKmDuration:
          inData.estimatedAspToBreakdownKmDuration,
        estimatedBreakdownToAspKm: inData.estimatedBreakdownToAspKm,
        estimatedBreakdownToAspKmDuration:
          inData.estimatedBreakdownToAspKmDuration,

        estimatedPickupToDropKm: inData.estimatedPickupToDropKm,
        estimatedPickupToDropKmDuration: inData.estimatedPickupToDropKmDuration,
        estimatedBreakdownToDropKm: inData.estimatedBreakdownToDropKm,
        estimatedBreakdownToDropKmDuration:
          inData.estimatedBreakdownToDropKmDuration,

        estimatedDropToAspKm: inData.estimatedDropToAspKm,
        estimatedDropToAspKmDuration: inData.estimatedDropToAspKmDuration,
        estimatedTotalDuration: inData.estimatedTotalDuration,
        estimatedServiceCost: inData.estimatedServiceCost,
        estimatedAdditionalCharge: inData.estimatedAdditionalCharge,
        estimatedTotalAmount: inData.estimatedTotalAmount,
        actualTotalKm: inData.actualTotalKm,
        actualServiceCost: inData.actualServiceCost,
        actualAdditionalCharge: inData.actualAdditionalCharge,
        actualTotalAmount: inData.actualTotalAmount,
        dealerId: inData.activity.caseDetail.dealerId,
        deliveryRequestDropDealerId:
          inData.activity.caseDetail.deliveryRequestDropDealerId,
        dropDealerId: inData.activity.caseDetail.caseInformation
          ? inData.activity.caseDetail.caseInformation.dropDealerId
          : null,
        asp: asp,
        aspMechanic: aspMechanic,
        chargesDetail: chargesData,
        aspLocation: inData.aspLocationData,
        // pickupLocation: inData.pickupLocationData,
        // dropLocation: inData.dropLocationData,
        ...caseLocationDetails,
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

  export async function getNspLocs(req: Request, res: Response) {
    try {
      const inData: any = req.query;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      let aspLimitQuery = 10;
      let aspHavingQuery = `distance <= ${process.env.DISTANCE}`;
      if (inData.filterId) {
        const nspFilterExists: any = await NspFilter.findOne({
          where: {
            id: inData.filterId,
          },
          attributes: ["id", "name", "limitQuery", "havingQuery"],
          paranoid: false,
        });
        if (!nspFilterExists) {
          return res.status(200).json({
            success: false,
            error: "Nsp Filter not found",
          });
        }

        aspLimitQuery = nspFilterExists.dataValues.limitQuery;
        aspHavingQuery = nspFilterExists.dataValues.havingQuery;
      }

      let [pickupDealer, dropDealer, getSubServiceRejectedAsps]: any =
        await Promise.all([
          inData.dealerId
            ? Dealer.findOne({
              where: { id: inData.dealerId },
              attributes: ["lat", "long"],
              paranoid: false,
            })
            : Promise.resolve(null),
          inData.dropDealerId
            ? Dealer.findOne({
              where: { id: inData.dropDealerId },
              attributes: ["lat", "long"],
              paranoid: false,
            })
            : Promise.resolve(null),
          axios.post(
            `${caseServiceUrl}/${endpoint.case.getSubServiceRejectedAsps}`,
            {
              caseDetailId: inData.caseDetailId,
              subServiceId: inData.subServiceId,
            }
          ),
        ]);

      // IF SCHEME DEALER AND THE LOCATION TYPE IS CUSTOMER MEANS CHANGE THE PICKUP DETAILS
      if (
        !pickupDealer &&
        inData.deliveryRequestSchemeId == 22 &&
        inData.locationTypeId == 451 &&
        inData.pickupLatitude &&
        inData.pickupLongitude
      ) {
        pickupDealer = {
          lat: inData.pickupLatitude,
          long: inData.pickupLongitude,
        };
      }

      // IF SCHEME DEALER AND THE LOCATION TYPE IS CUSTOMER MEANS CHANGE THE DROP DETAILS
      if (
        !dropDealer &&
        inData.deliveryRequestSchemeId == 22 &&
        inData.locationTypeId == 451 &&
        inData.dropLatitude &&
        inData.dropLongitude
      ) {
        dropDealer = {
          lat: inData.dropLatitude,
          long: inData.dropLongitude,
        };
      }

      const haversine = `(
        6371 * acos(
            cos(radians(${pickupDealer?.lat}))
            * cos(radians(latitude))
            * cos(radians(longitude) - radians(${pickupDealer?.long}))
            + sin(radians(${pickupDealer?.lat})) * sin(radians(latitude))
        )
      )`;

      let aspSearch: any = {};
      // Search
      if (inData.search) {
        aspSearch[Op.or] = [
          { name: { [Op.like]: `%${inData.search}%` } },
          { code: { [Op.like]: `%${inData.search}%` } },
          { workshopName: { [Op.like]: `%${inData.search}%` } },
        ];
        aspHavingQuery = "";
      } else {
        // // IGNORE REJECTED ASPS
        // if (getSubServiceRejectedAsps?.data?.data?.length > 0) {
        //   aspSearch.id = {
        //     [Op.notIn]: getSubServiceRejectedAsps.data.data,
        //   };
        // }
      }

      // Filter by clientId if provided - mandatory association
      let aspClientInclude: any = null;
      if (inData.clientId) {
        aspClientInclude = {
          model: AspClient,
          as: "clients",
          attributes: ["id", "clientId"],
          required: true,
          where: {
            clientId: inData.clientId,
          },
        };
      }

      // NEAREST ASP's FROM PICKUP LOCATION
      const aspPickupProviders: any = await Asp.findAll({
        where: aspSearch,
        attributes: [
          "id",
          "name",
          "code",
          "workshopName",
          "whatsAppNumber",
          "contactNumber",
          "rmId",
          "addressLineOne",
          "addressLineTwo",
          "latitude",
          "longitude",
          "hasMechanic",
          "isOwnPatrol",
          [sequelize.literal(haversine), "distance"],
        ],
        include: [
          {
            model: AspMechanic,
            attributes: [
              "id",
              "aspTypeId",
              "name",
              "code",
              "contactNumber",
              "alternateContactNumber",
              "workStatusId",
            ],
          },
          {
            model: State,
            attributes: ["id", "name"],
          },
          {
            model: City,
            attributes: ["id", "name"],
          },
          {
            model: AspSubService,
            as: "subServices",
            attributes: ["id"],
            where: {
              subServiceId: 1, //Vehicle Transfer
            },
          },
          ...(aspClientInclude ? [aspClientInclude] : []),
          {
            model: OwnPatrolVehicle,
            attributes: ["id", "vehicleRegistrationNumber"],
            required: false,
            include: [
              {
                model: OwnPatrolVehicleTechnicianLogs,
                attributes: ["id", "aspMechanicId"],
                required: false,
              },
            ],
          },
          {
            model: OwnPatrolVehicleNewTechnicians,
            as: "newTechnicians",
            attributes: ["id", "aspMechanicId"],
            required: false,
          },
        ],
        order: sequelize.col("distance"),
        having: sequelize.literal(aspHavingQuery),
        limit: aspLimitQuery,
      });
      let aspPickupCoordinates: any = [];
      for (let i = 0; i < aspPickupProviders.length; i++) {
        const lat = aspPickupProviders[i].dataValues.latitude;
        const lon = aspPickupProviders[i].dataValues.longitude;
        await aspPickupCoordinates.push({ lat, lon });
      }

      //PICKUP ASPs LAT, LONG
      const pickUpNearByAspList = aspPickupCoordinates.map(
        (object: any) => object.lat + "," + object.lon
      );

      //PICKUP LOCATION LAT, LONG
      const pickupOrigin = [`${pickupDealer?.lat + "," + pickupDealer?.long}`];

      //DROP LOCATION LAT, LONG
      const dropOrigin = [`${dropDealer?.lat + "," + dropDealer?.long}`];

      // Parallelize total distance calculations (ASP to P - Up , P - Up to D - Up, D - Up to Return staring ASP location);
      const [aspToPickup, pickupToDrop, dropToAsp]: any = await Promise.all([
        Utils.getGoogleDistanceDuration(pickUpNearByAspList, pickupOrigin, 1),
        Utils.getGoogleDistanceDuration(pickupOrigin, dropOrigin, 2),
        Utils.getGoogleDistanceDuration(dropOrigin, pickUpNearByAspList, 3),
      ]);

      const aspToPickupDistances = extractDistances(aspToPickup);
      const pickupToDropDistances = extractDistances(pickupToDrop);
      const dropToAspDistances = extractDistances(dropToAsp);

      // Combine the distance arrays into a single array
      const combinedDistances = aspToPickupDistances.map(
        (aspDistance: any, index: any) => {
          const pickupToDropDistance = pickupToDropDistances;
          const dropToAspDistance = dropToAspDistances[index];

          const asp = parseFloat(aspDistance);
          const pickup = parseFloat(pickupToDropDistance[0]);
          const drop = parseFloat(dropToAspDistance);

          if (!isNaN(asp) && !isNaN(pickup) && !isNaN(drop)) {
            return { totalDistance: `${(asp + pickup + drop).toFixed(2)} km` };
          } else {
            // console.error("Invalid distance values at", index, "th Index");
            return { totalDistance: null };
          }
        }
      );

      let data: any = aspToPickup;
      let aspPickList: any = [];
      for (let i = 0; i < aspPickupProviders.length; i++) {
        //CHECK ASP WILL WORK FOR THIS SUB SERVICE
        // const subServiceAspsResponse = await axios.post(
        //   `${process.env.RSA_BASE_URL}/crm/get/subService/asps`,
        //   {
        //     aspCode: aspPickupProviders[i].dataValues.code,
        //     serviceName: "Towing",
        //     subServiceName: "Vehicle Transfer",
        //   }
        // );
        // if (
        //   subServiceAspsResponse &&
        //   subServiceAspsResponse.data.success &&
        //   subServiceAspsResponse.data.aspSubServiceExists
        // ) {

        const aspData = {
          aspId: aspPickupProviders[i].dataValues.id,
          caseDetailId: inData.caseDetailId,
          subServiceId: 1, //Vehicle Transfer
        };
        const [getAspActivityDetail, getAspRejectedActivity, getAspWorkStatus, getAspCaseAssignedCount, getRmDetail]: any =
          await Promise.all([
            //CHECK ASP HAS ACTIVITY FOR CASE DETAIL AND GIVE ACTIVITY ID
            axios.post(
              `${caseServiceUrl}/${endpoint.case.getAspActivityId}`,
              aspData
            ),
            //CHECK ASP HAS REJECTED ACTIVITY FOR THE CASE AND SUB SERVICE
            axios.post(
              `${caseServiceUrl}/${endpoint.case.getAspRejectedActivity}`,
              aspData
            ),
            //GET ASP WORK STATUS BASED ON PICKUP DATE AND DRIVERS AVAILABILITY
            axios.post(`${caseServiceUrl}/${endpoint.case.getAspWorkStatus}`, {
              aspId: aspPickupProviders[i].dataValues.id,
              hasMechanic: aspPickupProviders[i].dataValues.hasMechanic,
              aspMechanics: aspPickupProviders[i].aspMechanics,
              serviceScheduledDate: inData.deliveryRequestPickupDate,
            }),
            // GET CASE ASSIGNED COUNT FOR SERVICE SCHEDULED DATE
            axios.post(
              `${caseServiceUrl}/${endpoint.case.getAspCaseAssignedCountForScheduledDate}`,
              {
                aspId: aspPickupProviders[i].dataValues.id,
                serviceScheduledDate: inData.deliveryRequestPickupDate,
              }
            ),
            // GET REGIONAL MANAGER DETAILS
            axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
              id: aspPickupProviders[i].dataValues.rmId,
            }),
          ]);

        // CHECK COCO TECHNICIAN IS IN SHIFT FOR THE COCO VEHICLE
        let cocoTechnicianInShift = false;
        if (
          aspPickupProviders[i].dataValues.isOwnPatrol &&
          aspPickupProviders[i].aspMechanics.length > 0
        ) {
          cocoTechnicianInShift = true;
        }

        //If coco asp is not having technicians means, we need to give last attended technicians against the vehicle.
        // let pickupLastAttendedTechnicianExists = false;
        // if (
        //   aspPickupProviders[i].dataValues.isOwnPatrol &&
        //   aspPickupProviders[i].aspMechanics.length == 0 &&
        //   aspPickupProviders[i].ownPatrolVehicle &&
        //   aspPickupProviders[i].ownPatrolVehicle
        //     .ownPatrolVehicleTechnicianLogs &&
        //   aspPickupProviders[i].ownPatrolVehicle.ownPatrolVehicleTechnicianLogs
        //     .length > 0
        // ) {
        //   pickupLastAttendedTechnicianExists = true;
        //   aspPickupProviders[i].dataValues.aspMechanics =
        //     await getLastAttendedCocoTechnicians(
        //       aspPickupProviders[i].ownPatrolVehicle
        //         .ownPatrolVehicleTechnicianLogs
        //     );
        // }

        //IF ASP IS OWN PATROL THEN GET NEW COCO TECHNICIANS IF EXISTS
        // if (
        //   aspPickupProviders[i].dataValues.isOwnPatrol &&
        //   aspPickupProviders[i].newTechnicians &&
        //   aspPickupProviders[i].newTechnicians.length > 0
        // ) {
        //   const newCocoTechnicians = await getNewCocoTechnicians(
        //     aspPickupProviders[i].dataValues.aspMechanics,
        //     aspPickupProviders[i].newTechnicians
        //   );

        //   if (newCocoTechnicians.length > 0) {
        //     // LAST ATTENDED TECHNICIANS ARE NOT EMPTY THEN INCLUDE EXISTING ASP MECHANICS AND ADD NEW COCO TECHNICIANS
        //     if (pickupLastAttendedTechnicianExists) {
        //       aspPickupProviders[i].dataValues.aspMechanics = [
        //         ...aspPickupProviders[i].dataValues.aspMechanics,
        //         ...newCocoTechnicians,
        //       ];
        //     } else if (
        //       aspPickupProviders[i].dataValues.aspMechanics.length == 0
        //     ) {
        //       // IF IN SHIFT OR LAST ATTENDED TECHNICIANS ARE EMPTY THEN ADD NEW COCO TECHNICIANS
        //       aspPickupProviders[i].dataValues.aspMechanics =
        //         newCocoTechnicians;
        //     }
        //   }
        // }

        //IF OWN PATROL ASP THEN GET COCO VEHICLE MATCHED MECHANICS
        if (aspPickupProviders[i].dataValues.isOwnPatrol && aspPickupProviders[i].ownPatrolVehicle) {
          const vehicleMatchedMechanics = await AspMechanic.findAll({
            where: {
              cocoVehicleId: aspPickupProviders[i].ownPatrolVehicle.id,
              aspTypeId: 771, // COCO
            },
            attributes: [
              "id",
              "aspTypeId",
              "name",
              "code",
              "contactNumber",
              "alternateContactNumber",
              "workStatusId",
            ],
          });

          aspPickupProviders[i].dataValues.aspMechanics = [
            ...aspPickupProviders[i].dataValues.aspMechanics,
            ...vehicleMatchedMechanics,
          ];
        }

        //GET ASP MECHANIC IN PROGRESS ACTIVITIES
        if (aspPickupProviders[i].dataValues.aspMechanics && aspPickupProviders[i].dataValues.aspMechanics.length > 0) {
          const aspMechanicIds = aspPickupProviders[i].dataValues.aspMechanics.map(
            (aspMechanic: any) => aspMechanic?.dataValues?.id
          ).filter((id: any) => id != null);

          if (aspMechanicIds.length > 0) {
            const aspMechanicInProgressResponse = await Utils.aspMechanicInProgressActivities(aspMechanicIds, inData.serviceScheduledDate);
            if (aspMechanicInProgressResponse.success && Array.isArray(aspMechanicInProgressResponse.data)) {
              for (const aspMechanic of aspPickupProviders[i].dataValues.aspMechanics) {
                if (aspMechanic?.dataValues?.id) {
                  const aspMechanicInProgressActivity = aspMechanicInProgressResponse.data.find(
                    (activity: any) => activity.aspMechanicId === aspMechanic.dataValues.id
                  );
                  if (aspMechanicInProgressActivity) {
                    aspMechanic.dataValues.assignedCount = aspMechanicInProgressActivity.assignedCount || 0;
                  }
                }
              }
            }
          }
        }

        // Only keep unique aspMechanics by id
        if (
          aspPickupProviders[i].dataValues.aspMechanics &&
          aspPickupProviders[i].dataValues.aspMechanics.length > 0
        ) {
          const uniqueMap = new Map();
          for (const aspMechanic of aspPickupProviders[i].dataValues.aspMechanics) {
            const id = aspMechanic?.dataValues?.id;
            if (id && !uniqueMap.has(id)) {
              uniqueMap.set(id, aspMechanic);
            }
          }
          aspPickupProviders[i].dataValues.aspMechanics = Array.from(uniqueMap.values());
        }

        //GET ASP MECHANIC WORK STATUS
        if (aspPickupProviders[i].dataValues.aspMechanics.length > 0) {
          for (const aspMechanic of aspPickupProviders[i].dataValues
            .aspMechanics) {
            aspMechanic.dataValues.workStatusId = await getWorkStatusId(
              aspMechanic,
              inData.deliveryRequestPickupDate
            );
          }
        }

        await aspPickList.push({
          ...aspPickupProviders[i].dataValues,
          rmName: getRmDetail.data.success ? getRmDetail.data.user.name : null,
          rmContactNumber: getRmDetail.data.success
            ? getRmDetail.data.user.mobileNumber
            : null,
          activityId: getAspActivityDetail.data.success
            ? getAspActivityDetail.data.data
            : null,
          rejectedActivityExists: getAspRejectedActivity?.data?.activityExists || false,
          distance: data[i]?.elements[0]?.distance?.text || null,
          duration: data[i]?.elements[0]?.duration?.text || null,
          estimatedTotalKm: combinedDistances[i]?.totalDistance || null,
          aspAvailable: getAspWorkStatus.data.success
            ? getAspWorkStatus.data.data.aspAvailable
            : null,
          displaySendRequestBtn: getAspWorkStatus.data.success
            ? getAspWorkStatus.data.data.displaySendRequestBtn
            : null,
          caseAssignedCount: getAspCaseAssignedCount.data.success
            ? getAspCaseAssignedCount.data.data || 0
            : 0,
          zmName: getRmDetail?.data?.user?.serviceZm?.name || null,
          zmContactNumber:
            getRmDetail?.data?.user?.serviceZm?.mobileNumber || null,
          nmName: getRmDetail?.data?.user?.serviceZm?.serviceNm?.name || null,
          nmContactNumber:
            getRmDetail?.data?.user?.serviceZm?.serviceNm?.mobileNumber || null,
          cocoTechnicianInShift: cocoTechnicianInShift,
        });
        // }
      }

      // NEAREST ASP's FROM DROP LOCATION
      const haversineDrop = `(
        6371 * acos(
            cos(radians(${dropDealer?.lat}))
            * cos(radians(latitude))
            * cos(radians(longitude) - radians(${dropDealer?.long}))
            + sin(radians(${dropDealer?.lat})) * sin(radians(latitude))
        )
      )`;

      const aspDropProviders: any = await Asp.findAll({
        where: aspSearch,
        attributes: [
          "id",
          "name",
          "code",
          "workshopName",
          "whatsAppNumber",
          "contactNumber",
          "rmId",
          "addressLineOne",
          "addressLineTwo",
          "latitude",
          "longitude",
          "hasMechanic",
          "isOwnPatrol",
          [sequelize.literal(haversineDrop), "distance"],
        ],
        include: [
          {
            model: AspMechanic,
            attributes: [
              "id",
              "aspTypeId",
              "name",
              "code",
              "contactNumber",
              "alternateContactNumber",
              "workStatusId",
            ],
          },
          {
            model: State,
            attributes: ["id", "name"],
          },
          {
            model: City,
            attributes: ["id", "name"],
          },
          {
            model: AspSubService,
            as: "subServices",
            attributes: ["id"],
            where: {
              subServiceId: 1, //Vehicle Transfer
            },
          },
          ...(aspClientInclude ? [aspClientInclude] : []),
          {
            model: OwnPatrolVehicle,
            attributes: ["id", "vehicleRegistrationNumber"],
            required: false,
            include: [
              {
                model: OwnPatrolVehicleTechnicianLogs,
                attributes: ["id", "aspMechanicId"],
                required: false,
              },
            ],
          },
          {
            model: OwnPatrolVehicleNewTechnicians,
            as: "newTechnicians",
            attributes: ["id", "aspMechanicId"],
            required: false,
          },
        ],
        order: sequelize.col("distance"),
        having: sequelize.literal(aspHavingQuery),
        limit: aspLimitQuery,
      });
      let aspDropCoordinates: any = [];
      for (let d = 0; d < aspDropProviders.length; d++) {
        const lat = aspDropProviders[d].dataValues.latitude;
        const lon = aspDropProviders[d].dataValues.longitude;
        await aspDropCoordinates.push({ lat, lon });
      }

      //DROP ASPs LAT, LONG
      const dropNearByAspList = aspDropCoordinates.map(
        (object: any) => object.lat + "," + object.lon
      );

      // Parallelize total distance calculations (ASP to P - Up , P - Up to D - Up, D - Up to Return staring ASP location);
      const [aspToPickup1, dropToAsp1]: any = await Promise.all([
        Utils.getGoogleDistanceDuration(dropNearByAspList, pickupOrigin, 1),
        Utils.getGoogleDistanceDuration(dropOrigin, dropNearByAspList, 3),
      ]);

      const aspToPickupDistances1 = extractDistances(aspToPickup1);
      const pickupToDropDistances1 = extractDistances(pickupToDrop);
      const dropToAspDistances1 = extractDistances(dropToAsp1);

      // Combine the distance arrays into a single array
      const combinedDistances1 = aspToPickupDistances1.map(
        (aspDistance1: any, index: any) => {
          const pickupToDropDistance1 = pickupToDropDistances1;
          const dropToAspDistance1 = dropToAspDistances1[index];

          const asp1 = parseFloat(aspDistance1);
          const pickup1 = parseFloat(pickupToDropDistance1[0]);
          const drop1 = parseFloat(dropToAspDistance1);

          if (!isNaN(asp1) && !isNaN(pickup1) && !isNaN(drop1)) {
            return {
              totalDistance: `${(asp1 + pickup1 + drop1).toFixed(2)} km`,
            };
          } else {
            // console.error("Invalid distance values at", index, "th Index");
            return {
              totalDistance: null,
            };
          }
        }
      );

      let dropData: any = await Utils.getGoogleDistanceDuration(
        dropNearByAspList,
        dropOrigin,
        1
      );
      let aspDropList: any = [];
      for (let dl = 0; dl < aspDropProviders.length; dl++) {
        //CHECK ASP WILL WORK FOR THIS SUB SERVICE
        // const subServiceAspsResponse = await axios.post(
        //   `${process.env.RSA_BASE_URL}/crm/get/subService/asps`,
        //   {
        //     aspCode: aspDropProviders[dl].dataValues.code,
        //     serviceName: "Towing",
        //     subServiceName: "Vehicle Transfer",
        //   }
        // );
        // if (
        //   subServiceAspsResponse &&
        //   subServiceAspsResponse.data.success &&
        //   subServiceAspsResponse.data.aspSubServiceExists
        // ) {

        const aspData = {
          aspId: aspDropProviders[dl].dataValues.id,
          caseDetailId: inData.caseDetailId,
          subServiceId: 1, //Vehicle Transfer
        };
        const [getAspActivityDetail, getAspRejectedActivity, getAspWorkStatus, getAspCaseAssignedCount, getRmDetail]: any =
          await Promise.all([
            //CHECK ASP HAS ACTIVITY FOR CASE DETAIL AND GIVE ACTIVITY ID
            axios.post(
              `${caseServiceUrl}/${endpoint.case.getAspActivityId}`,
              aspData
            ),
            //CHECK ASP HAS REJECTED ACTIVITY FOR THE CASE AND SUB SERVICE
            axios.post(
              `${caseServiceUrl}/${endpoint.case.getAspRejectedActivity}`,
              aspData
            ),
            //GET ASP WORK STATUS BASED ON PICKUP DATE AND DRIVERS AVAILABILITY
            axios.post(`${caseServiceUrl}/${endpoint.case.getAspWorkStatus}`, {
              aspId: aspDropProviders[dl].dataValues.id,
              hasMechanic: aspDropProviders[dl].dataValues.hasMechanic,
              aspMechanics: aspDropProviders[dl].aspMechanics,
              serviceScheduledDate: inData.deliveryRequestPickupDate,
            }),
            // GET CASE ASSIGNED COUNT FOR SERVICE SCHEDULED DATE
            axios.post(
              `${caseServiceUrl}/${endpoint.case.getAspCaseAssignedCountForScheduledDate}`,
              {
                aspId: aspDropProviders[dl].dataValues.id,
                serviceScheduledDate: inData.deliveryRequestPickupDate,
              }
            ),
            // GET REGIONAL MANAGER DETAILS
            axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
              id: aspDropProviders[dl].dataValues.rmId,
            }),
          ]);

        // CHECK COCO TECHNICIAN IS IN SHIFT FOR THE COCO VEHICLE
        let cocoTechnicianInShift = false;
        if (
          aspDropProviders[dl].dataValues.isOwnPatrol &&
          aspDropProviders[dl].aspMechanics.length > 0
        ) {
          cocoTechnicianInShift = true;
        }

        //If coco asp is not having technicians means, we need to give last attended technicians against the vehicle.
        // let dropLastAttendedTechnicianExists = false;
        // if (
        //   aspDropProviders[dl].dataValues.isOwnPatrol &&
        //   aspDropProviders[dl].aspMechanics.length == 0 &&
        //   aspDropProviders[dl].ownPatrolVehicle &&
        //   aspDropProviders[dl].ownPatrolVehicle
        //     .ownPatrolVehicleTechnicianLogs &&
        //   aspDropProviders[dl].ownPatrolVehicle.ownPatrolVehicleTechnicianLogs
        //     .length > 0
        // ) {
        //   dropLastAttendedTechnicianExists = true;
        //   aspDropProviders[dl].dataValues.aspMechanics =
        //     await getLastAttendedCocoTechnicians(
        //       aspDropProviders[dl].ownPatrolVehicle
        //         .ownPatrolVehicleTechnicianLogs
        //     );
        // }

        //IF ASP IS OWN PATROL THEN GET NEW COCO TECHNICIANS IF EXISTS
        // if (
        //   aspDropProviders[dl].dataValues.isOwnPatrol &&
        //   aspDropProviders[dl].newTechnicians &&
        //   aspDropProviders[dl].newTechnicians.length > 0
        // ) {
        //   const newCocoTechnicians = await getNewCocoTechnicians(
        //     aspDropProviders[dl].dataValues.aspMechanics,
        //     aspDropProviders[dl].newTechnicians
        //   );

        //   if (newCocoTechnicians.length > 0) {
        //     // LAST ATTENDED TECHNICIANS ARE NOT EMPTY THEN INCLUDE EXISTING ASP MECHANICS AND ADD NEW COCO TECHNICIANS
        //     if (dropLastAttendedTechnicianExists) {
        //       aspDropProviders[dl].dataValues.aspMechanics = [
        //         ...aspDropProviders[dl].dataValues.aspMechanics,
        //         ...newCocoTechnicians,
        //       ];
        //     } else if (
        //       aspDropProviders[dl].dataValues.aspMechanics.length == 0
        //     ) {
        //       // IF IN SHIFT OR LAST ATTENDED TECHNICIANS ARE EMPTY THEN ADD NEW COCO TECHNICIANS
        //       aspDropProviders[dl].dataValues.aspMechanics = newCocoTechnicians;
        //     }
        //   }
        // }

        //IF OWN PATROL ASP THEN GET COCO VEHICLE MATCHED MECHANICS
        if (aspDropProviders[dl].dataValues.isOwnPatrol && aspDropProviders[dl].ownPatrolVehicle) {
          const vehicleMatchedMechanics = await AspMechanic.findAll({
            where: {
              cocoVehicleId: aspDropProviders[dl].ownPatrolVehicle.id,
              aspTypeId: 771, // COCO
            },
            attributes: [
              "id",
              "aspTypeId",
              "name",
              "code",
              "contactNumber",
              "alternateContactNumber",
              "workStatusId",
            ],
          });

          aspDropProviders[dl].dataValues.aspMechanics = [
            ...aspDropProviders[dl].dataValues.aspMechanics,
            ...vehicleMatchedMechanics,
          ];
        }

        //GET ASP MECHANIC IN PROGRESS ACTIVITIES
        if (aspDropProviders[dl].dataValues.aspMechanics && aspDropProviders[dl].dataValues.aspMechanics.length > 0) {
          const aspMechanicIds = aspDropProviders[dl].dataValues.aspMechanics.map(
            (aspMechanic: any) => aspMechanic?.dataValues?.id
          ).filter((id: any) => id != null);

          if (aspMechanicIds.length > 0) {
            const aspMechanicInProgressResponse = await Utils.aspMechanicInProgressActivities(aspMechanicIds, inData.serviceScheduledDate);
            if (aspMechanicInProgressResponse.success && Array.isArray(aspMechanicInProgressResponse.data)) {
              for (const aspMechanic of aspDropProviders[dl].dataValues.aspMechanics) {
                if (aspMechanic?.dataValues?.id) {
                  const aspMechanicInProgressActivity = aspMechanicInProgressResponse.data.find(
                    (activity: any) => activity.aspMechanicId === aspMechanic.dataValues.id
                  );
                  if (aspMechanicInProgressActivity) {
                    aspMechanic.dataValues.assignedCount = aspMechanicInProgressActivity.assignedCount || 0;
                  }
                }
              }
            }
          }
        }

        // Only keep unique aspMechanics by id
        if (
          aspDropProviders[dl].dataValues.aspMechanics &&
          aspDropProviders[dl].dataValues.aspMechanics.length > 0
        ) {
          const uniqueMap = new Map();
          for (const aspMechanic of aspDropProviders[dl].dataValues.aspMechanics) {
            const id = aspMechanic?.dataValues?.id;
            if (id && !uniqueMap.has(id)) {
              uniqueMap.set(id, aspMechanic);
            }
          }
          aspDropProviders[dl].dataValues.aspMechanics = Array.from(uniqueMap.values());
        }

        //GET ASP MECHANIC WORK STATUS
        if (aspDropProviders[dl].dataValues.aspMechanics.length > 0) {
          for (const aspMechanic of aspDropProviders[dl].dataValues
            .aspMechanics) {
            aspMechanic.dataValues.workStatusId = await getWorkStatusId(
              aspMechanic,
              inData.deliveryRequestPickupDate
            );
          }
        }

        await aspDropList.push({
          ...aspDropProviders[dl].dataValues,
          rmName: getRmDetail.data.success ? getRmDetail.data.user.name : null,
          rmContactNumber: getRmDetail.data.success
            ? getRmDetail.data.user.mobileNumber
            : null,
          activityId: getAspActivityDetail.data.success
            ? getAspActivityDetail.data.data
            : null,
          rejectedActivityExists: getAspRejectedActivity?.data?.activityExists || false,
          distance: dropData[dl]?.elements[0]?.distance?.text || null,
          duration: dropData[dl]?.elements[0]?.duration?.text || null,
          estimatedTotalKm: combinedDistances1[dl]?.totalDistance || null,
          aspAvailable: getAspWorkStatus.data.success
            ? getAspWorkStatus.data.data.aspAvailable
            : null,
          displaySendRequestBtn: getAspWorkStatus.data.success
            ? getAspWorkStatus.data.data.displaySendRequestBtn
            : null,
          caseAssignedCount: getAspCaseAssignedCount.data.success
            ? getAspCaseAssignedCount.data.data || 0
            : 0,
          zmName: getRmDetail?.data?.user?.serviceZm?.name || null,
          zmContactNumber:
            getRmDetail?.data?.user?.serviceZm?.mobileNumber || null,
          nmName: getRmDetail?.data?.user?.serviceZm?.serviceNm?.name || null,
          nmContactNumber:
            getRmDetail?.data?.user?.serviceZm?.serviceNm?.mobileNumber || null,
          cocoTechnicianInShift: cocoTechnicianInShift,
        });
        // }
      }
      return res.status(200).json({
        success: true,
        message: "success",
        data: {
          pickupProviders: {
            pickupDealerPoints: pickupDealer,
            nearByProviders:
              inData.filterId && inData.filterId == "8" ? [] : aspPickList,
          },
          dropProviders: {
            dropDealerPoints: dropDealer,
            nearByProviders:
              inData.filterId && inData.filterId == "7" ? [] : aspDropList,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getCaseInfoData(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (!inData || inData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData = await Promise.all(
        inData.map(async (item: any) => {
          const [
            caseStatus,
            caseSubject,
            service,
            caseType,
            accidentType,
            channel,
            policyType,
          ] = await Promise.all([
            CaseStatus.findOne({
              where: { id: item.caseDetail.statusId },
              attributes: ["id", "name"],
              paranoid: false,
            }),
            CaseSubject.findOne({
              where: { id: item.caseDetail.subjectID },
              attributes: ["id", "name"],
              paranoid: false,
            }),
            Service.findOne({
              where: { id: item.serviceId },
              attributes: ["id", "name"],
              paranoid: false,
            }),
            Config.findOne({
              where: { id: item.caseTypeId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: item.accidentTypeId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: item.channelId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: item.policyTypeId },
              attributes: ["id", "name"],
            }),
          ]);

          // Process refund status with priority logic
          // Priority: If any pending (1301) or failed (1303) exists, show that; otherwise show processed (1302)
          let refundStatusId = null;
          let refundStatusName = null;

          // Get activities from caseDetail (nested structure from CaseInformation -> CaseDetails -> Activities)
          const activities = item.caseDetail?.activities || [];

          if (activities.length > 0) {
            const refundStatusIds: number[] = [];

            // Collect all refund status IDs from all activities and transactions
            for (const activity of activities) {
              if (activity?.activityTransactions && activity.activityTransactions.length > 0) {
                for (const transaction of activity.activityTransactions) {
                  if (transaction?.refundStatusId) {
                    refundStatusIds.push(transaction.refundStatusId);
                  }
                }
              }
            }

            // Apply priority logic: pending (1301) or failed (1303) first, then processed (1302)
            if (refundStatusIds.length > 0) {
              // Check for pending (1301) or failed (1303) first
              const pendingOrFailed = refundStatusIds.find(
                (id) => id === 1301 || id === 1303
              );

              if (pendingOrFailed) {
                refundStatusId = pendingOrFailed;
              } else {
                // If no pending/failed, use processed (1302) if it exists
                const processed = refundStatusIds.find((id) => id === 1302);
                if (processed) {
                  refundStatusId = processed;
                } else {
                  // If no processed, use the first available status
                  refundStatusId = refundStatusIds[0];
                }
              }

              // Fetch refund status name from Config
              if (refundStatusId) {
                const refundStatusConfig = await Config.findOne({
                  where: { id: refundStatusId, typeId: 93 }, // typeId 93 is Refund Statuses
                  attributes: ["id", "name"],
                });
                if (refundStatusConfig) {
                  refundStatusName = refundStatusConfig.dataValues.name;
                }
              }
            }
          }

          return {
            id: item.id,
            caseDetailId: item.caseDetailId,
            customerContactName: item.customerContactName,
            customerMobileNumber: item.customerMobileNumber,
            customerCurrentContactName: item.customerCurrentContactName,
            customerCurrentMobileNumber: item.customerCurrentMobileNumber,
            caseType: caseType?.dataValues.name || null,
            accidentType: accidentType?.dataValues.name || null,
            channel: channel?.dataValues.name || null,
            policyType: policyType?.dataValues.name || null,
            customerType: {
              irateCustomer: item.irateCustomer,
              womenAssist: item.womenAssist,
            },
            service: service?.dataValues.name || null,
            caseDetail: {
              caseNumber: item.caseDetail.caseNumber,
              subject: caseSubject?.dataValues.name || null,
              vin: item.caseDetail.vin,
              registrationNumber: item.caseDetail.registrationNumber,
              createdAt: moment
                .tz(item.caseDetail.createdAt, "Asia/Kolkata")
                .format("DD/MM/YYYY hh:mm A"),
              status: caseStatus?.dataValues.name || null,
              statusId: item.caseDetail.statusId,
              psfStatus: item.caseDetail.psfStatus || null,
            },
            refundStatus: refundStatusId
              ? {
                refundStatusId: refundStatusId,
                refundStatusName: refundStatusName,
              }
              : null,
            activities: activities,
          };
        })
      );

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

  export async function getNspLocationsForCrm(req: Request, res: Response) {
    try {
      const inData: any = req.body;
      if (!inData) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      let aspLimitQuery = 10;
      let aspHavingQuery = `distance <= ${process.env.CRM_NEAREST_ASP_DISTANCE}`;
      if (inData.filterId) {
        const nspFilterExists: any = await NspFilter.findOne({
          where: {
            id: inData.filterId,
          },
          attributes: ["id", "name", "limitQuery", "havingQuery"],
          paranoid: false,
        });
        if (!nspFilterExists) {
          return res.status(200).json({
            success: false,
            error: "Nsp Filter not found",
          });
        }

        aspLimitQuery = nspFilterExists.dataValues.limitQuery;
        aspHavingQuery = nspFilterExists.dataValues.havingQuery;
      }

      const getSubServiceRejectedAsps = await axios.post(
        `${caseServiceUrl}/${endpoint.case.getSubServiceRejectedAsps}`,
        {
          caseDetailId: inData.caseDetailId,
          subServiceId: inData.subServiceId,
        }
      );

      let aspSearch: any = {};

      // Search
      if (inData.search) {
        aspSearch[Op.or] = [
          { name: { [Op.like]: `%${inData.search}%` } },
          { code: { [Op.like]: `%${inData.search}%` } },
          { workshopName: { [Op.like]: `%${inData.search}%` } },
        ];
        aspHavingQuery = "";
      } else {
        // // IGNORE REJECTED ASPS
        // if (getSubServiceRejectedAsps?.data?.data?.length > 0) {
        //   aspSearch.id = {
        //     [Op.notIn]: getSubServiceRejectedAsps.data.data,
        //   };
        // }
      }

      if (inData.isOwnPatrol && inData.isOwnPatrol == 1) {
        aspSearch.isOwnPatrol = 1; //COCO ASP ONLY
      }

      // Filter by clientId if provided - mandatory association
      let aspClientInclude: any = null;
      if (inData.clientId) {
        aspClientInclude = {
          model: AspClient,
          as: "clients",
          attributes: ["id", "clientId"],
          required: true,
          where: {
            clientId: inData.clientId,
          },
        };
      }

      // FOR MAIL CONFIGURATION
      // const { serviceId, subServiceId } = inData;
      // const [service, subService, mailConfigurations] = await Promise.all([
      //   serviceId &&
      //     Service.findOne({
      //       where: { id: serviceId },
      //       attributes: ["id", "name"],
      //       paranoid: false,
      //     }),
      //   subServiceId &&
      //     SubService.findOne({
      //       where: { id: subServiceId },
      //       attributes: ["id", "name"],
      //       paranoid: false,
      //     }),
      //   MailConfiguration.findOne({
      //     where: { configId: 501 }, // ASP Unavailability Alert
      //     attributes: ["id", "toEmail", "ccEmail"],
      //   }),
      // ]);

      // if (serviceId && !service) {
      //   return res.status(200).json({
      //     success: false,
      //     error: "Service not found",
      //   });
      // }

      // if (subServiceId && !subService) {
      //   return res.status(200).json({
      //     success: false,
      //     error: "Sub service not found",
      //   });
      // }

      // const serviceName = service?.dataValues?.name;
      // const subServiceName = subService?.dataValues?.name;

      const breakDownLatLong = {
        dataValues: {
          lat: inData.breakdownLat,
          long: inData.breakdownLong,
        },
      };

      // Check if any filters are applied
      const hasFilters = !!(inData.filterId || inData.search);

      // If filters are applied, use existing logic (ASP master location)
      // Otherwise, use current location logic for COCO vehicles with active shift
      const haversine = hasFilters
        ? `(
          6371 * acos(
              cos(radians(${breakDownLatLong?.dataValues.lat}))
              * cos(radians(latitude))
              * cos(radians(longitude) - radians(${breakDownLatLong?.dataValues.long}))
              + sin(radians(${breakDownLatLong?.dataValues.lat})) * sin(radians(latitude))
          )
        )`
        : `(
            6371 * acos(
                cos(radians(${breakDownLatLong?.dataValues.lat}))
                * cos(radians(
                    CASE 
                      WHEN asp.isOwnPatrol = 1
                          AND asp.lastLocationAttendanceLogId IS NOT NULL 
                          AND asp.lastLatitude IS NOT NULL 
                      THEN asp.lastLatitude
                      ELSE asp.latitude 
                    END
                ))
                * cos(radians(
                    CASE 
                      WHEN asp.isOwnPatrol = 1
                          AND asp.lastLocationAttendanceLogId IS NOT NULL 
                          AND asp.lastLongitude IS NOT NULL 
                      THEN asp.lastLongitude
                      ELSE asp.longitude 
                    END
                ) - radians(${breakDownLatLong?.dataValues.long}))
                + sin(radians(${breakDownLatLong?.dataValues.lat})) * sin(radians(
                    CASE 
                      WHEN asp.isOwnPatrol = 1
                          AND asp.lastLocationAttendanceLogId IS NOT NULL 
                          AND asp.lastLatitude IS NOT NULL 
                      THEN asp.lastLatitude
                      ELSE asp.latitude 
                    END
                ))
            )
        )`;

      let aspBreakdownNearbyList: any = [];

      // NEAREST ASP's FROM BREAKDOWN LOCATION
      const aspBreakdownNearbyProviders: any = await Asp.findAll({
        where: aspSearch,
        attributes: [
          "id",
          "name",
          "code",
          "workshopName",
          "whatsAppNumber",
          "contactNumber",
          "rmId",
          "addressLineOne",
          "addressLineTwo",
          "latitude",
          "longitude",
          "lastLatitude",
          "lastLongitude",
          "lastLocationAttendanceLogId",
          "hasMechanic",
          "isOwnPatrol",
          [sequelize.literal(haversine), "distance"],
        ],
        include: [
          {
            model: AspMechanic,
            attributes: [
              "id",
              "aspTypeId",
              "name",
              "code",
              "contactNumber",
              "alternateContactNumber",
              "workStatusId",
            ],
          },
          {
            model: State,
            attributes: ["id", "name"],
          },
          {
            model: City,
            attributes: ["id", "name"],
          },
          {
            model: AspSubService,
            as: "subServices",
            attributes: ["id"],
            where: {
              subServiceId: inData.subServiceId,
            },
          },
          ...(aspClientInclude ? [aspClientInclude] : []),
          {
            model: OwnPatrolVehicle,
            attributes: [
              "id",
              "vehicleRegistrationNumber"
            ],
            required: false,
            include: [
              {
                model: OwnPatrolVehicleTechnicianLogs,
                attributes: ["id", "aspMechanicId"],
                required: false,
              },
            ],
          },
          {
            model: OwnPatrolVehicleNewTechnicians,
            as: "newTechnicians",
            attributes: ["id", "aspMechanicId"],
            required: false,
          },
        ],
        order: sequelize.col("distance"),
        having: sequelize.literal(aspHavingQuery),
        limit: aspLimitQuery,
      });

      let aspBreakdownCoordinates: any = [];
      for (let i = 0; i < aspBreakdownNearbyProviders.length; i++) {
        // EXISTING LOGIC
        // const lat = aspBreakdownNearbyProviders[i].dataValues.latitude;
        // const lon = aspBreakdownNearbyProviders[i].dataValues.longitude;

        // NEW LOGIC
        const asp = aspBreakdownNearbyProviders[i];
        // If filters are applied, use ASP master location
        // Otherwise, use lastLatitude and lastLongitude if attendanceLogId exists, otherwise use master location
        let lat = asp.dataValues.latitude;
        let lon = asp.dataValues.longitude;

        if (!hasFilters) {
          if (
            asp.dataValues.isOwnPatrol == 1 &&
            asp.dataValues.lastLocationAttendanceLogId !== null &&
            asp.dataValues.lastLatitude !== null &&
            asp.dataValues.lastLongitude !== null
          ) {
            lat = asp.dataValues.lastLatitude;
            lon = asp.dataValues.lastLongitude;
          }
        }

        await aspBreakdownCoordinates.push({ lat, lon });
      }

      // BREAKDOWN ASPs LAT, LONG
      const breakdownNearByAspList = aspBreakdownCoordinates.map(
        (object: any) => object.lat + "," + object.lon
      );

      // BREAKDOWN LOCATION LAT, LONG
      const breakdownOrigin = [
        `${breakDownLatLong?.dataValues.lat},${breakDownLatLong?.dataValues.long}`,
      ];

      // MECHANICAL SERVICE OR CUSTODY SUB SERVICE (subServiceId === 24)
      if ((inData.serviceId && inData.serviceId === 2) || (inData.subServiceId && inData.subServiceId === 24)) {
        const [aspToBreakdown, breakdownToAsp]: any = await Promise.all([
          Utils.getGoogleDistanceDuration(
            breakdownNearByAspList,
            breakdownOrigin,
            1
          ),
          Utils.getGoogleDistanceDuration(
            breakdownOrigin,
            breakdownNearByAspList,
            3
          ),
        ]);

        const aspToBreakdownDistances = extractDistances(aspToBreakdown);
        const breakdownToAspDistances = extractDistances(breakdownToAsp);

        // Combine the distance arrays into a single array
        const combinedDistances = aspToBreakdownDistances.map(
          (aspDistance: any, index: any) => {
            const breakdownToAspDistance = breakdownToAspDistances[index];

            const aspToBreakdown = parseFloat(aspDistance);
            const breakdownToAsp = parseFloat(breakdownToAspDistance);

            if (!isNaN(aspToBreakdown) && !isNaN(breakdownToAsp)) {
              return {
                totalDistance: `${(aspToBreakdown + breakdownToAsp).toFixed(
                  2
                )} km`,
              };
            } else {
              // console.error("Invalid distance values at", index, "th Index");
              return { totalDistance: null };
            }
          }
        );

        let data: any = aspToBreakdown;
        for (let i = 0; i < aspBreakdownNearbyProviders.length; i++) {
          //CHECK ASP WILL WORK FOR THIS SUB SERVICE
          // const subServiceAspsResponse = await axios.post(
          //   `${process.env.RSA_BASE_URL}/crm/get/subService/asps`,
          //   {
          //     aspCode: aspBreakdownNearbyProviders[i].dataValues.code,
          //     serviceName: serviceName,
          //     subServiceName: subServiceName,
          //   }
          // );
          // if (
          //   subServiceAspsResponse &&
          //   subServiceAspsResponse.data.success &&
          //   subServiceAspsResponse.data.aspSubServiceExists
          // ) {

          const aspData = {
            aspId: aspBreakdownNearbyProviders[i].dataValues.id,
            caseDetailId: inData.caseDetailId,
            subServiceId: inData.subServiceId,
          };
          const [getAspActivityDetail, getAspRejectedActivity, getAspWorkStatus, getAspCaseAssignedCount, getRmDetail]: any =
            await Promise.all([
              // CHECK ASP HAS ACTIVITY FOR CASE DETAIL AND GIVE ACTIVITY ID
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspActivityId}`,
                aspData
              ),
              //CHECK ASP HAS REJECTED ACTIVITY FOR THE CASE AND SUB SERVICE
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspRejectedActivity}`,
                aspData
              ),
              // GET ASP WORK STATUS BASED ON SERVICE SCHEDULED DATE AND DRIVERS AVAILABILITY
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspWorkStatus}`,
                {
                  aspId: aspBreakdownNearbyProviders[i].dataValues.id,
                  hasMechanic:
                    aspBreakdownNearbyProviders[i].dataValues.hasMechanic,
                  aspMechanics:
                    aspBreakdownNearbyProviders[i].dataValues.aspMechanics,
                  serviceScheduledDate: inData.serviceScheduledDate,
                }
              ),
              // GET CASE ASSIGNED COUNT FOR SERVICE SCHEDULED DATE
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspCaseAssignedCountForScheduledDate}`,
                {
                  aspId: aspBreakdownNearbyProviders[i].dataValues.id,
                  serviceScheduledDate: inData.serviceScheduledDate,
                }
              ),
              // GET REGIONAL MANAGER DETAILS
              axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
                id: aspBreakdownNearbyProviders[i].dataValues.rmId,
              }),
            ]);

          // CHECK COCO TECHNICIAN IS IN SHIFT FOR THE COCO VEHICLE
          let cocoTechnicianInShift = false;
          if (
            aspBreakdownNearbyProviders[i].dataValues.isOwnPatrol &&
            aspBreakdownNearbyProviders[i].aspMechanics.length > 0
          ) {
            cocoTechnicianInShift = true;
          }

          //If coco asp is not having technicians means, we need to give last attended technicians against the vehicle.
          // let breakdownLastAttendedTechnicianExists = false;
          // if (
          //   aspBreakdownNearbyProviders[i].dataValues.isOwnPatrol &&
          //   aspBreakdownNearbyProviders[i].aspMechanics.length == 0 &&
          //   aspBreakdownNearbyProviders[i].ownPatrolVehicle &&
          //   aspBreakdownNearbyProviders[i].ownPatrolVehicle
          //     .ownPatrolVehicleTechnicianLogs &&
          //   aspBreakdownNearbyProviders[i].ownPatrolVehicle
          //     .ownPatrolVehicleTechnicianLogs.length > 0
          // ) {
          //   breakdownLastAttendedTechnicianExists = true;
          //   aspBreakdownNearbyProviders[i].dataValues.aspMechanics =
          //     await getLastAttendedCocoTechnicians(
          //       aspBreakdownNearbyProviders[i].ownPatrolVehicle
          //         .ownPatrolVehicleTechnicianLogs
          //     );
          // }

          //IF ASP IS OWN PATROL THEN GET NEW COCO TECHNICIANS IF EXISTS
          // if (
          //   aspBreakdownNearbyProviders[i].dataValues.isOwnPatrol &&
          //   aspBreakdownNearbyProviders[i].newTechnicians &&
          //   aspBreakdownNearbyProviders[i].newTechnicians.length > 0
          // ) {
          //   const newCocoTechnicians = await getNewCocoTechnicians(
          //     aspBreakdownNearbyProviders[i].dataValues.aspMechanics,
          //     aspBreakdownNearbyProviders[i].newTechnicians
          //   );

          //   if (newCocoTechnicians.length > 0) {
          //     // LAST ATTENDED TECHNICIANS ARE NOT EMPTY THEN INCLUDE EXISTING ASP MECHANICS AND ADD NEW COCO TECHNICIANS
          //     if (breakdownLastAttendedTechnicianExists) {
          //       aspBreakdownNearbyProviders[i].dataValues.aspMechanics = [
          //         ...aspBreakdownNearbyProviders[i].dataValues.aspMechanics,
          //         ...newCocoTechnicians,
          //       ];
          //     } else if (
          //       aspBreakdownNearbyProviders[i].dataValues.aspMechanics.length ==
          //       0
          //     ) {
          //       // IF IN SHIFT OR LAST ATTENDED TECHNICIANS ARE EMPTY THEN ADD NEW COCO TECHNICIANS
          //       aspBreakdownNearbyProviders[i].dataValues.aspMechanics =
          //         newCocoTechnicians;
          //     }
          //   }
          // }

          //IF OWN PATROL ASP THEN GET COCO VEHICLE MATCHED MECHANICS
          if (aspBreakdownNearbyProviders[i].dataValues.isOwnPatrol && aspBreakdownNearbyProviders[i].ownPatrolVehicle) {
            const vehicleMatchedMechanics = await AspMechanic.findAll({
              where: {
                cocoVehicleId: aspBreakdownNearbyProviders[i].ownPatrolVehicle.id,
                aspTypeId: 771, // COCO
              },
              attributes: [
                "id",
                "aspTypeId",
                "name",
                "code",
                "contactNumber",
                "alternateContactNumber",
                "workStatusId",
              ],
            });

            aspBreakdownNearbyProviders[i].dataValues.aspMechanics = [
              ...aspBreakdownNearbyProviders[i].dataValues.aspMechanics,
              ...vehicleMatchedMechanics,
            ];
          }

          //GET ASP MECHANIC IN PROGRESS ACTIVITIES
          if (aspBreakdownNearbyProviders[i].dataValues.aspMechanics && aspBreakdownNearbyProviders[i].dataValues.aspMechanics.length > 0) {
            const aspMechanicIds = aspBreakdownNearbyProviders[i].dataValues.aspMechanics
              .map((aspMechanic: any) => aspMechanic?.dataValues?.id)
              .filter((id: any) => id != null); // Filter out any null/undefined IDs

            if (aspMechanicIds.length > 0) {
              const aspMechanicInProgressResponse = await Utils.aspMechanicInProgressActivities(aspMechanicIds, inData.serviceScheduledDate);
              if (aspMechanicInProgressResponse.success && Array.isArray(aspMechanicInProgressResponse.data)) {
                for (const aspMechanic of aspBreakdownNearbyProviders[i].dataValues.aspMechanics) {
                  if (aspMechanic?.dataValues?.id) {
                    const aspMechanicInProgressActivity = aspMechanicInProgressResponse.data.find(
                      (activity: any) => activity.aspMechanicId === aspMechanic.dataValues.id
                    );
                    if (aspMechanicInProgressActivity) {
                      aspMechanic.dataValues.assignedCount = aspMechanicInProgressActivity.assignedCount || 0;
                    }
                  }
                }
              }
            }
          }

          // Only keep unique aspMechanics by id
          if (
            aspBreakdownNearbyProviders[i].dataValues.aspMechanics &&
            aspBreakdownNearbyProviders[i].dataValues.aspMechanics.length > 0
          ) {
            const uniqueMap = new Map();
            for (const aspMechanic of aspBreakdownNearbyProviders[i].dataValues.aspMechanics) {
              const id = aspMechanic?.dataValues?.id;
              if (id && !uniqueMap.has(id)) {
                uniqueMap.set(id, aspMechanic);
              }
            }
            aspBreakdownNearbyProviders[i].dataValues.aspMechanics = Array.from(uniqueMap.values());
          }

          //GET ASP MECHANIC WORK STATUS
          if (
            aspBreakdownNearbyProviders[i].dataValues.aspMechanics.length > 0
          ) {
            for (const aspMechanic of aspBreakdownNearbyProviders[i].dataValues
              .aspMechanics) {
              aspMechanic.dataValues.workStatusId = await getWorkStatusId(
                aspMechanic,
                inData.serviceScheduledDate
              );
            }
          }

          await aspBreakdownNearbyList.push({
            ...aspBreakdownNearbyProviders[i].dataValues,
            rmName: getRmDetail.data.success
              ? getRmDetail.data.user.name
              : null,
            rmContactNumber: getRmDetail.data.success
              ? getRmDetail.data.user.mobileNumber
              : null,
            activityId: getAspActivityDetail.data.success
              ? getAspActivityDetail.data.data
              : null,
            isTechnicianAssigned: getAspActivityDetail.data.success
              ? getAspActivityDetail.data.isTechnicianAssigned
              : false,
            rejectedActivityExists: getAspRejectedActivity?.data?.activityExists || false,
            distance: data[i]?.elements[0]?.distance?.text || null,
            duration: data[i]?.elements[0]?.duration?.text || null,
            estimatedTotalKm: combinedDistances[i]?.totalDistance || null,
            aspAvailable: getAspWorkStatus.data.success
              ? getAspWorkStatus.data.data.aspAvailable
              : null,
            displaySendRequestBtn: getAspWorkStatus.data.success
              ? getAspWorkStatus.data.data.displaySendRequestBtn
              : null,
            caseAssignedCount: getAspCaseAssignedCount.data.success
              ? getAspCaseAssignedCount.data.data || 0
              : 0,
            zmName: getRmDetail?.data?.user?.serviceZm?.name || null,
            zmContactNumber:
              getRmDetail?.data?.user?.serviceZm?.mobileNumber || null,
            nmName: getRmDetail?.data?.user?.serviceZm?.serviceNm?.name || null,
            nmContactNumber:
              getRmDetail?.data?.user?.serviceZm?.serviceNm?.mobileNumber ||
              null,
            cocoTechnicianInShift: cocoTechnicianInShift,
          });
          // }
        }

        //NEED TO ENABLE AFTER CONFIRMATION
        //BREAKDOWN ASPS NOT AVAILABLE AT THE BREAKDOWN LOCATION SEND EMAIL TO BUSINESS TEAM
        // if (aspBreakdownNearbyList.length == 0 && mailConfigurations) {
        //   const emailData = {
        //     subject: "Breakdown ASP'S Unavailability Alert",
        //     templateFileName: "breakdown-drop-asp-unavailability-alert.html",
        //     toEmail: mailConfigurations.dataValues.toEmail.split(","),
        //     ccEmail: mailConfigurations.dataValues.ccEmail
        //       ? mailConfigurations.dataValues.ccEmail.split(",")
        //       : null,
        //     content: `The ASP is unavailable at the breakdown location(${inData.breakdownLocation}) for this case ${inData.caseNumber}. Kindly take appropriate action.`,
        //     portalLogoUrl: `${process.env.API_GATEWAY_URL}images/portalLogo.png`,
        //   };
        //   const sendMailResponse = await emailNotification(emailData);
        //   if (!sendMailResponse.success) {
        //     return res.status(200).json({
        //       success: false,
        //       error: sendMailResponse.error,
        //     });
        //   }
        // }

        return res.status(200).json({
          success: true,
          message: "success",
          data: {
            breakdownProviders: {
              breakdownLocation: inData.breakdownLocation,
              breakdownPoints: breakDownLatLong.dataValues,
              nearByProviders:
                inData.filterId && inData.filterId == "2"
                  ? []
                  : aspBreakdownNearbyList,
            },
            dropProviders: null,
          },
        });
      } else if (inData.serviceId && inData.serviceId === 1) {
        //TOWING SERVICE
        if (
          !inData.dropLocation ||
          !inData.dropLocationLat ||
          !inData.dropLocationLong
        ) {
          return res.status(200).json({
            success: false,
            error: "Drop location not found",
          });
        }

        // DROP LOCATION LAT, LONG
        const dropOrigin = [
          `${inData.dropLocationLat},${inData.dropLocationLong}`,
        ];

        const [aspToBreakdown, breakdownToDrop, dropToAsp]: any =
          await Promise.all([
            Utils.getGoogleDistanceDuration(
              breakdownNearByAspList,
              breakdownOrigin,
              1
            ),
            Utils.getGoogleDistanceDuration(breakdownOrigin, dropOrigin, 2),
            Utils.getGoogleDistanceDuration(
              dropOrigin,
              breakdownNearByAspList,
              3
            ),
          ]);

        const aspToBreakdownDistances = extractDistances(aspToBreakdown);
        const breakdownToDropDistances = extractDistances(breakdownToDrop);
        const dropToAspDistances = extractDistances(dropToAsp);

        // Combine the distance arrays into a single array
        const combinedDistances = aspToBreakdownDistances.map(
          (aspDistance: any, index: any) => {
            const breakdownToDropDistance = breakdownToDropDistances[0];
            const dropToAspDistance = dropToAspDistances[index];

            const asp = parseFloat(aspDistance);
            const breakdown = parseFloat(breakdownToDropDistance);
            const drop = parseFloat(dropToAspDistance);

            if (!isNaN(asp) && !isNaN(breakdown) && !isNaN(drop)) {
              return {
                totalDistance: `${(asp + breakdown + drop).toFixed(2)} km`,
              };
            } else {
              // console.error("Invalid distance values at", index, "th Index");
              return {
                totalDistance: null,
              };
            }
          }
        );

        let data: any = aspToBreakdown;
        for (let i = 0; i < aspBreakdownNearbyProviders.length; i++) {
          // const subServiceAspsResponse = await axios.post(
          //   `${process.env.RSA_BASE_URL}/crm/get/subService/asps`,
          //   {
          //     aspCode: aspBreakdownNearbyProviders[i].dataValues.code,
          //     serviceName: serviceName,
          //     subServiceName: subServiceName,
          //   }
          // );
          // if (
          //   subServiceAspsResponse &&
          //   subServiceAspsResponse.data.success &&
          //   subServiceAspsResponse.data.aspSubServiceExists
          // ) {

          const aspData = {
            aspId: aspBreakdownNearbyProviders[i].dataValues.id,
            caseDetailId: inData.caseDetailId,
            subServiceId: inData.subServiceId,
          };
          const [getAspActivityDetail, getAspRejectedActivity, getAspWorkStatus, getAspCaseAssignedCount, getRmDetail]: any =
            await Promise.all([
              // CHECK ASP HAS ACTIVITY FOR CASE DETAIL AND GIVE ACTIVITY ID
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspActivityId}`,
                aspData
              ),
              //CHECK ASP HAS REJECTED ACTIVITY FOR THE CASE AND SUB SERVICE
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspRejectedActivity}`,
                aspData
              ),
              // GET ASP WORK STATUS BASED ON SERVICE SCHEDULED DATE AND DRIVERS AVAILABILITY
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspWorkStatus}`,
                {
                  aspId: aspBreakdownNearbyProviders[i].dataValues.id,
                  hasMechanic:
                    aspBreakdownNearbyProviders[i].dataValues.hasMechanic,
                  aspMechanics:
                    aspBreakdownNearbyProviders[i].dataValues.aspMechanics,
                  serviceScheduledDate: inData.serviceScheduledDate,
                }
              ),
              // GET CASE ASSIGNED COUNT FOR SERVICE SCHEDULED DATE
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspCaseAssignedCountForScheduledDate}`,
                {
                  aspId: aspBreakdownNearbyProviders[i].dataValues.id,
                  serviceScheduledDate: inData.serviceScheduledDate,
                }
              ),
              // GET REGIONAL MANAGER DETAILS
              axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
                id: aspBreakdownNearbyProviders[i].dataValues.rmId,
              }),
            ]);

          // CHECK COCO TECHNICIAN IS IN SHIFT FOR THE COCO VEHICLE
          let cocoTechnicianInShift = false;
          if (
            aspBreakdownNearbyProviders[i].dataValues.isOwnPatrol &&
            aspBreakdownNearbyProviders[i].aspMechanics.length > 0
          ) {
            cocoTechnicianInShift = true;
          }

          //If coco asp is not having technicians means, we need to give last attended technicians against the vehicle.
          // let breakdownLastAttendedTechnicianExists = false;
          // if (
          //   aspBreakdownNearbyProviders[i].dataValues.isOwnPatrol &&
          //   aspBreakdownNearbyProviders[i].aspMechanics.length == 0 &&
          //   aspBreakdownNearbyProviders[i].ownPatrolVehicle &&
          //   aspBreakdownNearbyProviders[i].ownPatrolVehicle
          //     .ownPatrolVehicleTechnicianLogs &&
          //   aspBreakdownNearbyProviders[i].ownPatrolVehicle
          //     .ownPatrolVehicleTechnicianLogs.length > 0
          // ) {
          //   breakdownLastAttendedTechnicianExists = true;
          //   aspBreakdownNearbyProviders[i].dataValues.aspMechanics =
          //     await getLastAttendedCocoTechnicians(
          //       aspBreakdownNearbyProviders[i].ownPatrolVehicle
          //         .ownPatrolVehicleTechnicianLogs
          //     );
          // }

          //IF ASP IS OWN PATROL THEN GET NEW COCO TECHNICIANS IF EXISTS
          // if (
          //   aspBreakdownNearbyProviders[i].dataValues.isOwnPatrol &&
          //   aspBreakdownNearbyProviders[i].newTechnicians &&
          //   aspBreakdownNearbyProviders[i].newTechnicians.length > 0
          // ) {
          //   const newCocoTechnicians = await getNewCocoTechnicians(
          //     aspBreakdownNearbyProviders[i].dataValues.aspMechanics,
          //     aspBreakdownNearbyProviders[i].newTechnicians
          //   );

          //   if (newCocoTechnicians.length > 0) {
          //     // LAST ATTENDED TECHNICIANS ARE NOT EMPTY THEN INCLUDE EXISTING ASP MECHANICS AND ADD NEW COCO TECHNICIANS
          //     if (breakdownLastAttendedTechnicianExists) {
          //       aspBreakdownNearbyProviders[i].dataValues.aspMechanics = [
          //         ...aspBreakdownNearbyProviders[i].dataValues.aspMechanics,
          //         ...newCocoTechnicians,
          //       ];
          //     } else if (
          //       aspBreakdownNearbyProviders[i].dataValues.aspMechanics.length ==
          //       0
          //     ) {
          //       // IF IN SHIFT OR LAST ATTENDED TECHNICIANS ARE EMPTY THEN ADD NEW COCO TECHNICIANS
          //       aspBreakdownNearbyProviders[i].dataValues.aspMechanics =
          //         newCocoTechnicians;
          //     }
          //   }
          // }


          //IF OWN PATROL ASP THEN GET COCO VEHICLE MATCHED MECHANICS
          if (aspBreakdownNearbyProviders[i].dataValues.isOwnPatrol && aspBreakdownNearbyProviders[i].ownPatrolVehicle) {
            const vehicleMatchedMechanics = await AspMechanic.findAll({
              where: {
                cocoVehicleId: aspBreakdownNearbyProviders[i].ownPatrolVehicle.id,
                aspTypeId: 771, // COCO
              },
              attributes: [
                "id",
                "aspTypeId",
                "name",
                "code",
                "contactNumber",
                "alternateContactNumber",
                "workStatusId",
              ],
            });

            aspBreakdownNearbyProviders[i].dataValues.aspMechanics = [
              ...aspBreakdownNearbyProviders[i].dataValues.aspMechanics,
              ...vehicleMatchedMechanics,
            ];
          }

          //GET ASP MECHANIC IN PROGRESS ACTIVITIES
          if (aspBreakdownNearbyProviders[i].dataValues.aspMechanics && aspBreakdownNearbyProviders[i].dataValues.aspMechanics.length > 0) {
            const aspMechanicIds = aspBreakdownNearbyProviders[i].dataValues.aspMechanics
              .map((aspMechanic: any) => aspMechanic?.dataValues?.id)
              .filter((id: any) => id != null); // Filter out any null/undefined IDs

            if (aspMechanicIds.length > 0) {
              const aspMechanicInProgressResponse = await Utils.aspMechanicInProgressActivities(aspMechanicIds, inData.serviceScheduledDate);
              if (aspMechanicInProgressResponse.success && Array.isArray(aspMechanicInProgressResponse.data)) {
                for (const aspMechanic of aspBreakdownNearbyProviders[i].dataValues.aspMechanics) {
                  if (aspMechanic?.dataValues?.id) {
                    const aspMechanicInProgressActivity = aspMechanicInProgressResponse.data.find(
                      (activity: any) => activity.aspMechanicId === aspMechanic.dataValues.id
                    );
                    if (aspMechanicInProgressActivity) {
                      aspMechanic.dataValues.assignedCount = aspMechanicInProgressActivity.assignedCount || 0;
                    }
                  }
                }
              }
            }
          }

          // Only keep unique aspMechanics by id
          if (
            aspBreakdownNearbyProviders[i].dataValues.aspMechanics &&
            aspBreakdownNearbyProviders[i].dataValues.aspMechanics.length > 0
          ) {
            const uniqueMap = new Map();
            for (const aspMechanic of aspBreakdownNearbyProviders[i].dataValues.aspMechanics) {
              const id = aspMechanic?.dataValues?.id;
              if (id && !uniqueMap.has(id)) {
                uniqueMap.set(id, aspMechanic);
              }
            }
            aspBreakdownNearbyProviders[i].dataValues.aspMechanics = Array.from(uniqueMap.values());
          }

          //GET ASP MECHANIC WORK STATUS
          if (
            aspBreakdownNearbyProviders[i].dataValues.aspMechanics.length > 0
          ) {
            for (const aspMechanic of aspBreakdownNearbyProviders[i].dataValues
              .aspMechanics) {
              aspMechanic.dataValues.workStatusId = await getWorkStatusId(
                aspMechanic,
                inData.serviceScheduledDate
              );
            }
          }

          await aspBreakdownNearbyList.push({
            ...aspBreakdownNearbyProviders[i].dataValues,
            rmName: getRmDetail.data.success
              ? getRmDetail.data.user.name
              : null,
            rmContactNumber: getRmDetail.data.success
              ? getRmDetail.data.user.mobileNumber
              : null,
            activityId: getAspActivityDetail.data.success
              ? getAspActivityDetail.data.data
              : null,
            isTechnicianAssigned: getAspActivityDetail.data.success
              ? getAspActivityDetail.data.isTechnicianAssigned
              : false,
            rejectedActivityExists: getAspRejectedActivity?.data?.activityExists || false,
            distance: data[i]?.elements[0]?.distance?.text || null,
            duration: data[i]?.elements[0]?.duration?.text || null,
            estimatedTotalKm: combinedDistances[i]?.totalDistance || null,
            aspAvailable: getAspWorkStatus.data.success
              ? getAspWorkStatus.data.data.aspAvailable
              : null,
            displaySendRequestBtn: getAspWorkStatus.data.success
              ? getAspWorkStatus.data.data.displaySendRequestBtn
              : null,
            caseAssignedCount: getAspCaseAssignedCount.data.success
              ? getAspCaseAssignedCount.data.data || 0
              : 0,
            zmName: getRmDetail?.data?.user?.serviceZm?.name || null,
            zmContactNumber:
              getRmDetail?.data?.user?.serviceZm?.mobileNumber || null,
            nmName: getRmDetail?.data?.user?.serviceZm?.serviceNm?.name || null,
            nmContactNumber:
              getRmDetail?.data?.user?.serviceZm?.serviceNm?.mobileNumber ||
              null,
            cocoTechnicianInShift: cocoTechnicianInShift,
          });
          // }
        }

        // NEAREST ASP's FROM DROP LOCATION
        // If filters are applied, use existing logic (ASP master location)
        // Otherwise, use current location logic for COCO vehicles with active shift
        const haversineDrop = hasFilters
          ? `(
            6371 * acos(
                cos(radians(${inData.dropLocationLat}))
                * cos(radians(latitude))
                * cos(radians(longitude) - radians(${inData.dropLocationLong}))
                + sin(radians(${inData.dropLocationLat})) * sin(radians(latitude))
            )
        )`
          : `(
            6371 * acos(
                cos(radians(${inData.dropLocationLat}))
                * cos(radians(
                    CASE 
                      WHEN asp.isOwnPatrol = 1
                          AND asp.lastLocationAttendanceLogId IS NOT NULL 
                          AND asp.lastLatitude IS NOT NULL 
                      THEN asp.lastLatitude
                      ELSE asp.latitude 
                    END
                ))
                * cos(radians(
                    CASE 
                      WHEN asp.isOwnPatrol = 1
                          AND asp.lastLocationAttendanceLogId IS NOT NULL 
                          AND asp.lastLongitude IS NOT NULL 
                      THEN asp.lastLongitude
                      ELSE asp.longitude 
                    END
                ) - radians(${inData.dropLocationLong}))
                + sin(radians(${inData.dropLocationLat})) * sin(radians(
                    CASE 
                      WHEN asp.isOwnPatrol = 1
                          AND asp.lastLocationAttendanceLogId IS NOT NULL 
                          AND asp.lastLatitude IS NOT NULL 
                      THEN asp.lastLatitude
                      ELSE asp.latitude 
                    END
                ))
            )
        )`;

        const aspDropProviders: any = await Asp.findAll({
          where: aspSearch,
          attributes: [
            "id",
            "name",
            "code",
            "workshopName",
            "whatsAppNumber",
            "contactNumber",
            "rmId",
            "addressLineOne",
            "addressLineTwo",
            "latitude",
            "longitude",
            "lastLatitude",
            "lastLongitude",
            "lastLocationAttendanceLogId",
            "hasMechanic",
            "isOwnPatrol",
            [sequelize.literal(haversineDrop), "distance"],
          ],
          include: [
            {
              model: AspMechanic,
              attributes: [
                "id",
                "aspTypeId",
                "name",
                "code",
                "contactNumber",
                "alternateContactNumber",
                "workStatusId",
              ],
            },
            {
              model: State,
              attributes: ["id", "name"],
            },
            {
              model: City,
              attributes: ["id", "name"],
            },
            {
              model: AspSubService,
              as: "subServices",
              attributes: ["id"],
              where: {
                subServiceId: inData.subServiceId,
              },
            },
            ...(aspClientInclude ? [aspClientInclude] : []),
            {
              model: OwnPatrolVehicle,
              attributes: [
                "id",
                "vehicleRegistrationNumber"
              ],
              required: false,
              include: [
                {
                  model: OwnPatrolVehicleTechnicianLogs,
                  attributes: ["id", "aspMechanicId"],
                  required: false,
                },
              ],
            },
            {
              model: OwnPatrolVehicleNewTechnicians,
              as: "newTechnicians",
              attributes: ["id", "aspMechanicId"],
              required: false,
            },
          ],
          order: sequelize.col("distance"),
          having: sequelize.literal(aspHavingQuery),
          limit: aspLimitQuery,
        });

        let aspDropCoordinates: any = [];
        for (let d = 0; d < aspDropProviders.length; d++) {
          // EXISTING LOGIC
          // const lat = aspDropProviders[d].latitude;
          // const lon = aspDropProviders[d].longitude;

          // NEW LOGIC
          const asp = aspDropProviders[d];
          // If filters are applied, use ASP master location
          // Otherwise, use lastLatitude and lastLongitude if attendanceLogId exists, otherwise use master location
          let lat = asp.dataValues.latitude;
          let lon = asp.dataValues.longitude;

          if (!hasFilters) {
            if (
              asp.dataValues.isOwnPatrol == 1 &&
              asp.dataValues.lastLocationAttendanceLogId !== null &&
              asp.dataValues.lastLatitude !== null &&
              asp.dataValues.lastLongitude !== null
            ) {
              lat = asp.dataValues.lastLatitude;
              lon = asp.dataValues.lastLongitude;
            }
          }

          await aspDropCoordinates.push({ lat, lon });
        }

        // DROP ASPs LAT, LONG
        const dropNearByAspList = aspDropCoordinates.map(
          (object: any) => object.lat + "," + object.lon
        );

        // Parallelize total distance calculations (ASP to P - Up , P - Up to D - Up, D - Up to Return staring ASP location);
        const [aspToBreakdown1, dropToAsp1]: any = await Promise.all([
          Utils.getGoogleDistanceDuration(
            dropNearByAspList,
            breakdownOrigin,
            1
          ),
          Utils.getGoogleDistanceDuration(dropOrigin, dropNearByAspList, 3),
        ]);

        const aspToBreakdownDistances1 = extractDistances(aspToBreakdown1);
        const breakdownToDropDistances1 = extractDistances(breakdownToDrop);
        const dropToAspDistances1 = extractDistances(dropToAsp1);

        // Combine the distance arrays into a single array
        const combinedDistances1 = aspToBreakdownDistances1.map(
          (aspDistance1: any, index: any) => {
            const breakdownToDropDistance1 = breakdownToDropDistances1[0];
            const dropToAspDistance1 = dropToAspDistances1[index];

            const asp1 = parseFloat(aspDistance1);
            const breakdown1 = parseFloat(breakdownToDropDistance1);
            const drop1 = parseFloat(dropToAspDistance1);

            if (!isNaN(asp1) && !isNaN(breakdown1) && !isNaN(drop1)) {
              return {
                totalDistance: `${(asp1 + breakdown1 + drop1).toFixed(2)} km`,
              };
            } else {
              // console.error("Invalid distance values at", index, "th Index");
              return {
                totalDistance: null,
              };
            }
          }
        );

        let dropData: any = await Utils.getGoogleDistanceDuration(
          dropNearByAspList,
          dropOrigin,
          1
        );
        let aspDropList: any = [];
        for (let dl = 0; dl < aspDropProviders.length; dl++) {
          // const subServiceAspsResponse = await axios.post(
          //   `${process.env.RSA_BASE_URL}/crm/get/subService/asps`,
          //   {
          //     aspCode: aspDropProviders[dl].dataValues.code,
          //     serviceName: serviceName,
          //     subServiceName: subServiceName,
          //   }
          // );
          // if (
          //   subServiceAspsResponse &&
          //   subServiceAspsResponse.data.success &&
          //   subServiceAspsResponse.data.aspSubServiceExists
          // ) {

          const aspData = {
            aspId: aspDropProviders[dl].dataValues.id,
            caseDetailId: inData.caseDetailId,
            subServiceId: inData.subServiceId,
          };
          const [getAspActivityDetail, getAspRejectedActivity, getAspWorkStatus, getAspCaseAssignedCount, getRmDetail]: any =
            await Promise.all([
              // CHECK ASP HAS ACTIVITY FOR CASE DETAIL AND GIVE ACTIVITY ID
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspActivityId}`,
                aspData
              ),
              //CHECK ASP HAS REJECTED ACTIVITY FOR THE CASE AND SUB SERVICE
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspRejectedActivity}`,
                aspData
              ),
              // GET ASP WORK STATUS BASED ON PICKUP DATE AND DRIVERS AVAILABILITY
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspWorkStatus}`,
                {
                  aspId: aspDropProviders[dl].dataValues.id,
                  hasMechanic: aspDropProviders[dl].dataValues.hasMechanic,
                  aspMechanics: aspDropProviders[dl].dataValues.aspMechanics,
                  serviceScheduledDate: inData.serviceScheduledDate,
                }
              ),
              // GET CASE ASSIGNED COUNT FOR SERVICE SCHEDULED DATE
              axios.post(
                `${caseServiceUrl}/${endpoint.case.getAspCaseAssignedCountForScheduledDate}`,
                {
                  aspId: aspDropProviders[dl].dataValues.id,
                  serviceScheduledDate: inData.serviceScheduledDate,
                }
              ),
              // GET REGIONAL MANAGER DETAILS
              axios.post(`${userServiceUrl}/${userServiceEndpoint.getUser}`, {
                id: aspDropProviders[dl].dataValues.rmId,
              }),
            ]);

          // CHECK COCO TECHNICIAN IS IN SHIFT FOR THE COCO VEHICLE
          let cocoTechnicianInShift = false;
          if (
            aspDropProviders[dl].dataValues.isOwnPatrol &&
            aspDropProviders[dl].aspMechanics.length > 0
          ) {
            cocoTechnicianInShift = true;
          }

          //If coco asp is not having technicians means, we need to give last attended technicians against the vehicle.
          // let dropLastAttendedTechnicianExists = false;
          // if (
          //   aspDropProviders[dl].dataValues.isOwnPatrol &&
          //   aspDropProviders[dl].aspMechanics.length == 0 &&
          //   aspDropProviders[dl].ownPatrolVehicle &&
          //   aspDropProviders[dl].ownPatrolVehicle
          //     .ownPatrolVehicleTechnicianLogs &&
          //   aspDropProviders[dl].ownPatrolVehicle.ownPatrolVehicleTechnicianLogs
          //     .length > 0
          // ) {
          //   dropLastAttendedTechnicianExists = true;
          //   aspDropProviders[dl].dataValues.aspMechanics =
          //     await getLastAttendedCocoTechnicians(
          //       aspDropProviders[dl].ownPatrolVehicle
          //         .ownPatrolVehicleTechnicianLogs
          //     );
          // }

          //IF ASP IS OWN PATROL THEN GET NEW COCO TECHNICIANS IF EXISTS
          // if (
          //   aspDropProviders[dl].dataValues.isOwnPatrol &&
          //   aspDropProviders[dl].newTechnicians &&
          //   aspDropProviders[dl].newTechnicians.length > 0
          // ) {
          //   const newCocoTechnicians = await getNewCocoTechnicians(
          //     aspDropProviders[dl].dataValues.aspMechanics,
          //     aspDropProviders[dl].newTechnicians
          //   );

          //   if (newCocoTechnicians.length > 0) {
          //     // LAST ATTENDED TECHNICIANS ARE NOT EMPTY THEN INCLUDE EXISTING ASP MECHANICS AND ADD NEW COCO TECHNICIANS
          //     if (dropLastAttendedTechnicianExists) {
          //       aspDropProviders[dl].dataValues.aspMechanics = [
          //         ...aspDropProviders[dl].dataValues.aspMechanics,
          //         ...newCocoTechnicians,
          //       ];
          //     } else if (
          //       aspDropProviders[dl].dataValues.aspMechanics.length == 0
          //     ) {
          //       // IF IN SHIFT OR LAST ATTENDED TECHNICIANS ARE EMPTY THEN ADD NEW COCO TECHNICIANS
          //       aspDropProviders[dl].dataValues.aspMechanics =
          //         newCocoTechnicians;
          //     }
          //   }
          // }

          //IF OWN PATROL ASP THEN GET COCO VEHICLE MATCHED MECHANICS
          if (aspDropProviders[dl].dataValues.isOwnPatrol && aspDropProviders[dl].ownPatrolVehicle) {
            const vehicleMatchedMechanics = await AspMechanic.findAll({
              where: {
                cocoVehicleId: aspDropProviders[dl].ownPatrolVehicle.id,
                aspTypeId: 771, // COCO
              },
              attributes: [
                "id",
                "aspTypeId",
                "name",
                "code",
                "contactNumber",
                "alternateContactNumber",
                "workStatusId",
              ],
            });

            aspDropProviders[dl].dataValues.aspMechanics = [
              ...aspDropProviders[dl].dataValues.aspMechanics,
              ...vehicleMatchedMechanics,
            ];
          }

          //GET ASP MECHANIC IN PROGRESS ACTIVITIES
          if (aspDropProviders[dl].dataValues.aspMechanics && aspDropProviders[dl].dataValues.aspMechanics.length > 0) {
            const aspMechanicIds = aspDropProviders[dl].dataValues.aspMechanics
              .map((aspMechanic: any) => aspMechanic?.dataValues?.id)
              .filter((id: any) => id != null); // Filter out any null/undefined IDs

            if (aspMechanicIds.length > 0) {
              const aspMechanicInProgressResponse = await Utils.aspMechanicInProgressActivities(aspMechanicIds, inData.serviceScheduledDate);
              if (aspMechanicInProgressResponse.success && Array.isArray(aspMechanicInProgressResponse.data)) {
                for (const aspMechanic of aspDropProviders[dl].dataValues.aspMechanics) {
                  if (aspMechanic?.dataValues?.id) {
                    const aspMechanicInProgressActivity = aspMechanicInProgressResponse.data.find(
                      (activity: any) => activity.aspMechanicId === aspMechanic.dataValues.id
                    );
                    if (aspMechanicInProgressActivity) {
                      aspMechanic.dataValues.assignedCount = aspMechanicInProgressActivity.assignedCount || 0;
                    }
                  }
                }
              }
            }
          }

          // Only keep unique aspMechanics by id
          if (
            aspDropProviders[dl].dataValues.aspMechanics &&
            aspDropProviders[dl].dataValues.aspMechanics.length > 0
          ) {
            const uniqueMap = new Map();
            for (const aspMechanic of aspDropProviders[dl].dataValues.aspMechanics) {
              const id = aspMechanic?.dataValues?.id;
              if (id && !uniqueMap.has(id)) {
                uniqueMap.set(id, aspMechanic);
              }
            }
            aspDropProviders[dl].dataValues.aspMechanics = Array.from(uniqueMap.values());
          }

          //GET ASP MECHANIC WORK STATUS
          if (aspDropProviders[dl].dataValues.aspMechanics.length > 0) {
            for (const aspMechanic of aspDropProviders[dl].dataValues
              .aspMechanics) {
              aspMechanic.dataValues.workStatusId = await getWorkStatusId(
                aspMechanic,
                inData.serviceScheduledDate
              );
            }
          }

          await aspDropList.push({
            ...aspDropProviders[dl].dataValues,
            rmName: getRmDetail.data.success
              ? getRmDetail.data.user.name
              : null,
            rmContactNumber: getRmDetail.data.success
              ? getRmDetail.data.user.mobileNumber
              : null,
            activityId: getAspActivityDetail.data.success
              ? getAspActivityDetail.data.data
              : null,
            isTechnicianAssigned: getAspActivityDetail.data.success
              ? getAspActivityDetail.data.isTechnicianAssigned
              : false,
            rejectedActivityExists: getAspRejectedActivity?.data?.activityExists || false,
            distance: dropData[dl]?.elements[0]?.distance?.text || null,
            duration: dropData[dl]?.elements[0]?.duration?.text || null,
            estimatedTotalKm: combinedDistances1[dl]?.totalDistance || null,
            aspAvailable: getAspWorkStatus.data.success
              ? getAspWorkStatus.data.data.aspAvailable
              : null,
            displaySendRequestBtn: getAspWorkStatus.data.success
              ? getAspWorkStatus.data.data.displaySendRequestBtn
              : null,
            caseAssignedCount: getAspCaseAssignedCount.data.success
              ? getAspCaseAssignedCount.data.data || 0
              : 0,
            zmName: getRmDetail?.data?.user?.serviceZm?.name || null,
            zmContactNumber:
              getRmDetail?.data?.user?.serviceZm?.mobileNumber || null,
            nmName: getRmDetail?.data?.user?.serviceZm?.serviceNm?.name || null,
            nmContactNumber:
              getRmDetail?.data?.user?.serviceZm?.serviceNm?.mobileNumber ||
              null,
            cocoTechnicianInShift: cocoTechnicianInShift,
          });
          // }
        }

        //NEED TO ENABLE
        //BREAKDOWN ASPS NOT AVAILABLE AT THE BREAKDOWN LOCATION SEND EMAIL TO BUSINESS TEAM
        // if (aspBreakdownNearbyList.length == 0 && mailConfigurations) {
        //   const emailData = {
        //     subject: "Breakdown ASP'S Unavailability Alert",
        //     templateFileName: "breakdown-drop-asp-unavailability-alert.html",
        //     toEmail: mailConfigurations.dataValues.toEmail.split(","),
        //     ccEmail: mailConfigurations.dataValues.ccEmail
        //       ? mailConfigurations.dataValues.ccEmail.split(",")
        //       : null,
        //     content: `The ASP is unavailable at the breakdown location(${inData.breakDownAddress}) for this case ${inData.caseNumber}. Kindly take appropriate action.`,
        //     portalLogoUrl: `${process.env.API_GATEWAY_URL}images/portalLogo.png`,
        //   };

        //   const sendMailResponse = await emailNotification(emailData);
        //   if (!sendMailResponse.success) {
        //     return res.status(200).json({
        //       success: false,
        //       error: sendMailResponse.error,
        //     });
        //   }
        // }

        //NEED TO ENABLE
        //DROP ASPS NOT AVAILABLE AT THE DROP LOCATION SEND EMAIL TO BUSINESS TEAM
        // if (aspDropList.length == 0 && mailConfigurations) {
        //   const emailData = {
        //     subject: "Drop ASP'S Unavailability Alert",
        //     templateFileName: "breakdown-drop-asp-unavailability-alert.html",
        //     toEmail: mailConfigurations.dataValues.toEmail.split(","),
        //     ccEmail: mailConfigurations.dataValues.ccEmail
        //       ? mailConfigurations.dataValues.ccEmail.split(",")
        //       : null,
        //     content: `The ASP is unavailable at the drop location(${dropDealer.dataValues.correspondenceAddress}) for this case ${inData.caseNumber}. Kindly take appropriate action.`,
        //     portalLogoUrl: `${process.env.API_GATEWAY_URL}images/portalLogo.png`,
        //   };

        //   const sendMailResponse = await emailNotification(emailData);
        //   if (!sendMailResponse.success) {
        //     return res.status(200).json({
        //       success: false,
        //       error: sendMailResponse.error,
        //     });
        //   }
        // }

        return res.status(200).json({
          success: true,
          message: "success",
          data: {
            breakdownProviders: {
              breakdownLocation: inData.breakdownLocation,
              breakdownPoints: breakDownLatLong.dataValues,
              nearByProviders:
                inData.filterId && inData.filterId == "2"
                  ? []
                  : aspBreakdownNearbyList,
            },
            dropProviders: {
              dropLocation: inData.dropLocation,
              dropLocationPoints: {
                lat: inData.dropLocationLat,
                long: inData.dropLocationLong,
              },
              nearByProviders:
                inData.filterId && inData.filterId == "1" ? [] : aspDropList,
            },
          },
        });
      } else {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  export async function getMasterDetail(req: Request, res: Response) {
    try {
      const payload = req.body;
      const {
        cancelReasonId,
        callCenterId,
        clientId,
        vehicleMakeId,
        vehicleModelId,
        subjectId,
        pickupDealerId,
        pickupDealerStateId,
        pickupDealerCityId,
        dropDealerId,
        dropDealerStateId,
        dropDealerCityId,
        caseStatusId,
        financeStatusId,
        deliveryRequestSubServiceId,
        aspActivityStatusId,
        aspActivityRejectReasonId,
        activityStatusId,
        aspId,
        aspRejectedCcDetailReasonId,
        breakdownCityId,
        subServiceId,
        advancePaymentMethodId,
        advancePaymentPaidToId,
      } = payload;

      const cancelReasonData = cancelReasonId
        ? await Utils.findByModelId(CaseCancelReason, cancelReasonId, [
          "id",
          "name",
        ])
        : null;
      const callCenterData = callCenterId
        ? await Utils.findByModelId(CallCenter, callCenterId, [
          "id",
          "name",
          "address",
        ])
        : null;
      const clientData = clientId
        ? await Utils.findByModelId(Client, clientId, ["id", "name"])
        : null;
      const vehicleMakeData = vehicleMakeId
        ? await Utils.findByModelId(VehicleMake, vehicleMakeId, ["id", "name"])
        : null;
      const vehicleModelData = vehicleModelId
        ? await Utils.findByModelId(VehicleModel, vehicleModelId, [
          "id",
          "name",
          "vehicleMakeId",
          "vehicleTypeId",
        ])
        : null;
      const subjectData = subjectId
        ? await Utils.findByModelId(CaseSubject, subjectId, [
          "id",
          "name",
          "clientId",
        ])
        : null;
      const pickupDealerData = pickupDealerId
        ? await Utils.findByModelId(Dealer, pickupDealerId, [
          "id",
          "code",
          "name",
          "lat",
          "long",
        ])
        : null;
      const pickupDealerStateData = pickupDealerStateId
        ? await Utils.findByModelId(State, pickupDealerStateId, [
          "id",
          "code",
          "name",
          "countryId",
        ])
        : null;
      const pickupDealerCityData = pickupDealerCityId
        ? await Utils.findByModelId(City, pickupDealerCityId, [
          "id",
          "name",
          "stateId",
        ])
        : null;
      const dropDealerData = dropDealerId
        ? await Utils.findByModelId(Dealer, dropDealerId, [
          "id",
          "code",
          "name",
          "lat",
          "long",
        ])
        : null;
      const dropDealerStateData = dropDealerStateId
        ? await Utils.findByModelId(State, dropDealerStateId, [
          "id",
          "code",
          "name",
          "countryId",
        ])
        : null;
      const dropDealerCityData = dropDealerCityId
        ? await Utils.findByModelId(City, dropDealerCityId, [
          "id",
          "name",
          "stateId",
        ])
        : null;
      const caseStatusData = caseStatusId
        ? await Utils.findByModelId(CaseStatus, caseStatusId, ["id", "name"])
        : null;
      const financeStatusData = financeStatusId
        ? await Utils.findByModelId(ActivityFinanceStatus, financeStatusId, [
          "id",
          "name",
        ])
        : null;
      const deliveryRequestSubServiceData = deliveryRequestSubServiceId
        ? await Utils.findByModelId(SubService, deliveryRequestSubServiceId, [
          "id",
          "name",
          "serviceId",
        ])
        : null;
      const aspActivityStatusData = aspActivityStatusId
        ? await Utils.findByModelId(AspActivityStatus, aspActivityStatusId, [
          "id",
          "name",
        ])
        : null;
      const aspActivityRejectReasonData = aspActivityRejectReasonId
        ? await Utils.findByModelId(
          AspActivityRejectReason,
          aspActivityRejectReasonId,
          ["id", "name"]
        )
        : null;
      const activityStatusData = activityStatusId
        ? await Utils.findByModelId(ActivityStatus, activityStatusId, [
          "id",
          "name",
        ])
        : null;
      const aspData = aspId
        ? await Utils.findByModelId(Asp, aspId, [
          "id",
          "code",
          "name",
          "addressLineOne",
          "addressLineTwo",
        ])
        : null;
      const aspRejectedCcDetailReasonData = aspRejectedCcDetailReasonId
        ? await Utils.findByModelId(
          AspRejectedCcDetailReason,
          aspRejectedCcDetailReasonId,
          ["id", "name"]
        )
        : null;
      const breakdownCityData = breakdownCityId
        ? await Utils.findByModelId(
          City,
          breakdownCityId,
          ["id", "name", "locationTypeId", "locationCategoryId", "stateId"],
          [
            {
              model: Config,
              as: "locationType",
              attributes: ["id", "name"],
            },
            {
              model: Config,
              as: "locationCategory",
              attributes: ["id", "name"],
            },
            {
              model: State,
              as: "state",
              attributes: ["id", "name"],
            },
          ]
        )
        : null;
      const subServiceData = subServiceId
        ? await Utils.findByModelId(SubService, subServiceId, [
          "id",
          "name",
          "serviceId",
        ])
        : null;
      const advancePaymentMethodData = advancePaymentMethodId
        ? await Utils.findByModelId(Config, advancePaymentMethodId, [
          "id",
          "name",
        ])
        : null;
      const advancePaymentPaidToData = advancePaymentPaidToId
        ? await Utils.findByModelId(Config, advancePaymentPaidToId, [
          "id",
          "name",
        ])
        : null;

      if (cancelReasonId && !cancelReasonData) {
        return res.status(200).json({
          success: false,
          error: "Case cancel reason not found",
        });
      }
      if (callCenterId && !callCenterData) {
        return res.status(200).json({
          success: false,
          error: "Call center not found",
        });
      }
      if (clientId && !clientData) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }
      if (vehicleMakeId && !vehicleMakeData) {
        return res.status(200).json({
          success: false,
          error: "Vehicle make not found",
        });
      }
      if (vehicleModelId && !vehicleModelData) {
        return res.status(200).json({
          success: false,
          error: "Vehicle model not found",
        });
      }
      if (subjectId && !subjectData) {
        return res.status(200).json({
          success: false,
          error: "Case subject not found",
        });
      }
      if (pickupDealerId && !pickupDealerData) {
        return res.status(200).json({
          success: false,
          error: "Pickup dealer not found",
        });
      }
      if (pickupDealerStateId && !pickupDealerStateData) {
        return res.status(200).json({
          success: false,
          error: "Pickup dealer state not found",
        });
      }
      if (pickupDealerCityId && !pickupDealerCityData) {
        return res.status(200).json({
          success: false,
          error: "Pickup dealer city not found",
        });
      }
      if (dropDealerId && !dropDealerData) {
        return res.status(200).json({
          success: false,
          error: "Drop dealer not found",
        });
      }
      if (dropDealerStateId && !dropDealerStateData) {
        return res.status(200).json({
          success: false,
          error: "Drop dealer state not found",
        });
      }
      if (dropDealerCityId && !dropDealerCityData) {
        return res.status(200).json({
          success: false,
          error: "Drop dealer city not found",
        });
      }
      if (caseStatusId && !caseStatusData) {
        return res.status(200).json({
          success: false,
          error: "Case status not found",
        });
      }
      if (financeStatusId && !financeStatusData) {
        return res.status(200).json({
          success: false,
          error: "Finance status not found",
        });
      }
      if (deliveryRequestSubServiceId && !deliveryRequestSubServiceData) {
        return res.status(200).json({
          success: false,
          error: "Sub service not found",
        });
      }
      if (aspActivityStatusId && !aspActivityStatusData) {
        return res.status(200).json({
          success: false,
          error: "ASP activity status not found",
        });
      }
      if (aspActivityRejectReasonId && !aspActivityRejectReasonData) {
        return res.status(200).json({
          success: false,
          error: "Asp activity reject reason not found",
        });
      }
      if (activityStatusId && !activityStatusData) {
        return res.status(200).json({
          success: false,
          error: "Activity status not found",
        });
      }
      if (aspId && !aspData) {
        return res.status(200).json({
          success: false,
          error: "Asp not found",
        });
      }
      if (aspRejectedCcDetailReasonId && !aspRejectedCcDetailReasonData) {
        return res.status(200).json({
          success: false,
          error: "ASP Rejected CC Detail Reason not found",
        });
      }
      if (breakdownCityId && !breakdownCityData) {
        return res.status(200).json({
          success: false,
          error: "Breakdown city not found",
        });
      }
      if (subServiceId && !subServiceData) {
        return res.status(200).json({
          success: false,
          error: "Sub service not found",
        });
      }
      if (advancePaymentMethodId && !advancePaymentMethodData) {
        return res.status(200).json({
          success: false,
          error: "Advance payment method not found",
        });
      }
      if (advancePaymentPaidToId && !advancePaymentPaidToData) {
        return res.status(200).json({
          success: false,
          error: "Advance payment paid to not found",
        });
      }

      const data = {
        cancelReason: cancelReasonData,
        callCenter: callCenterData,
        client: clientData,
        vehicleMake: vehicleMakeData,
        vehicleModel: vehicleModelData,
        subject: subjectData,
        pickupDealer: pickupDealerData,
        pickupDealerState: pickupDealerStateData,
        pickupDealerCity: pickupDealerCityData,
        dropDealer: dropDealerData,
        dropDealerState: dropDealerStateData,
        dropDealerCity: dropDealerCityData,
        caseStatus: caseStatusData,
        financeStatus: financeStatusData,
        deliveryRequestSubService: deliveryRequestSubServiceData,
        aspActivityStatus: aspActivityStatusData,
        aspActivityRejectReason: aspActivityRejectReasonData,
        activityStatus: activityStatusData,
        asp: aspData,
        aspRejectedCcDetailReason: aspRejectedCcDetailReasonData,
        breakdownCity: breakdownCityData,
        subService: subServiceData,
        advancePaymentMethod: advancePaymentMethodData,
        advancePaymentPaidTo: advancePaymentPaidToData,
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

  export async function aspOverAllMapView(req: Request, res: Response) {
    try {
      const payload = req.body;
      const validatorRules = {
        lat: "required|string",
        long: "required|string",
        subServiceIds: "array",
        "subServiceIds.*": "required",
        radius: "required|string",
        searchKey: "string",
        // Filter parameters - all optional
        startDate: "string",
        endDate: "string",
        statusIds: "array",
        caseSubjectNames: "array",
        stateIds: "array",
        slaStatusIds: "array",
        clientIds: "array",
        caseNumber: "string",
        unAssignmentReasonIds: "array",
        serviceIds: "array",
        aspActivityStatusIds: "array",
        activityStatusIds: "array",
        serviceOrganisationIds: "array",
        aspCode: "string",
        apiUserIds: "array",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let where = Object();
      let having = null;
      let order = null;
      if (payload.searchKey) {
        where[Op.or] = [
          { code: { [Op.like]: `%${payload.searchKey}%` } },
          { name: { [Op.like]: `%${payload.searchKey}%` } },
          { workshopName: { [Op.like]: `%${payload.searchKey}%` } },
        ];
      }

      // ASP Code filter
      if (payload.aspCode) {
        where.code = { [Op.like]: `%${payload.aspCode}%` };
      }

      // State filter
      if (payload.stateIds && payload.stateIds.length > 0) {
        where.stateId = {
          [Op.in]: payload.stateIds,
        };
      }

      // Filter only Own Patrol ASPs (COCO ASPs) - Map View specific requirement
      where.isOwnPatrol = 1;

      const attributes: any = [
        "id",
        "code",
        "name",
        "email",
        "workshopName",
        "whatsAppNumber",
        "contactNumber",
        "addressLineOne",
        "addressLineTwo",
        "latitude",
        "longitude",
        "hasMechanic",
        "isOwnPatrol",
      ];

      const haversine = `(
          6371 * acos(
              cos(radians(${payload.lat}))
              * cos(radians(asp.latitude))
              * cos(radians(asp.longitude) - radians(${payload.long}))
              + sin(radians(${payload.lat})) * sin(radians(asp.latitude))
          )
        )`;
      attributes.push([sequelize.literal(haversine), "distance"]);

      // Uncomment this when the radius filter is required
      // if (payload.radius) {
      //   having = sequelize.literal(`distance <= ${payload.radius}`);
      // }
      order = sequelize.col("distance");

      const options: any = {
        where,
        attributes,
      };
      if (having) {
        options.having = having;
      }
      if (order) {
        options.order = order;
      }

      // Build OwnPatrolVehicle where clause for Service Organisation filter
      const ownPatrolVehicleWhere: any = {};
      if (payload.serviceOrganisationIds && payload.serviceOrganisationIds.length > 0) {
        ownPatrolVehicleWhere.serviceOrganisationId = {
          [Op.in]: payload.serviceOrganisationIds,
        };
      }

      options.include = [
        {
          model: AspMechanic,
          attributes: [
            "id",
            "aspTypeId",
            "name",
            "code",
            "contactNumber",
            "alternateContactNumber",
            "workStatusId",
          ],
        },
        {
          model: OwnPatrolVehicle,
          attributes: ["id", "vehicleRegistrationNumber", "vehicleTypeId"],
          required: Object.keys(ownPatrolVehicleWhere).length > 0, // Make required if filtering by serviceOrganisationId
          where: Object.keys(ownPatrolVehicleWhere).length > 0 ? ownPatrolVehicleWhere : undefined,
          include: [
            {
              model: VehicleType,
              as: "vehicleType",
              attributes: ["id", "name"],
              required: false,
            },
          ],
        },
      ];

      if (payload.subServiceIds && payload.subServiceIds.length > 0) {
        options.include.push({
          model: AspSubService,
          as: "subServices",
          attributes: ["id", "subServiceId"],
          required: true,
          where: {
            subServiceId: payload.subServiceIds,
          },
        });
      }

      // Filter by clientIds using AspClient relationship
      if (payload.clientIds && payload.clientIds.length > 0) {
        options.include.push({
          model: AspClient,
          as: "clients",
          attributes: ["id", "clientId"],
          required: true,
          where: {
            clientId: {
              [Op.in]: payload.clientIds,
            },
          },
        });
      }

      // Filter by serviceIds using AspSubService -> SubService relationship
      if (payload.serviceIds && payload.serviceIds.length > 0) {
        options.include.push({
          model: AspSubService,
          as: "subServices",
          attributes: ["id", "subServiceId"],
          required: true,
          include: [
            {
              model: SubService,
              as: "subService",
              attributes: ["id", "serviceId"],
              required: true,
              where: {
                serviceId: {
                  [Op.in]: payload.serviceIds,
                },
              },
            },
          ],
        });
      }

      let asps = await Asp.findAll(options);
      if (asps.length == 0) {
        return res.status(200).json({
          success: false,
          error: "No COCO Vehicle found",
        });
      }

      const aspLoginDetail: any = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.rsaAspOverAllMapViewLoginDetail}`,
        {
          asps: asps,
          startDate: payload.startDate,
          endDate: payload.endDate,
        }
      );
      if (!aspLoginDetail.data.success) {
        return res.status(200).json(aspLoginDetail.data);
      }

      // Prepare filter parameters to pass to Case Service for status filtering
      const statusFilterParams: any = {};
      if (payload.aspActivityStatusIds && payload.aspActivityStatusIds.length > 0) {
        statusFilterParams.aspActivityStatusIds = payload.aspActivityStatusIds;
      }
      if (payload.activityStatusIds && payload.activityStatusIds.length > 0) {
        statusFilterParams.activityStatusIds = payload.activityStatusIds;
      }
      // Un-Assignment Reasons (mapped to rejectReasonId in ActivityAspDetails)
      if (payload.unAssignmentReasonIds && payload.unAssignmentReasonIds.length > 0) {
        statusFilterParams.unAssignmentReasonIds = payload.unAssignmentReasonIds;
      }
      // Case-related filters - filter ASPs based on their assigned cases
      if (payload.statusIds && payload.statusIds.length > 0) {
        statusFilterParams.statusIds = payload.statusIds;
      }
      // Pass caseSubjectNames to case service - it will convert to IDs internally
      if (payload.caseSubjectNames && payload.caseSubjectNames.length > 0) {
        statusFilterParams.caseSubjectNames = payload.caseSubjectNames;
      }
      if (payload.caseNumber) {
        statusFilterParams.caseNumber = payload.caseNumber;
      }
      // SLA Status filter
      if (payload.slaStatusIds && payload.slaStatusIds.length > 0) {
        statusFilterParams.slaStatusIds = payload.slaStatusIds;
      }

      const aspStatusDetail = await axios.post(
        `${caseServiceUrl}/${endpoint.case.rsaAspOverAllMapViewStatusDetail}`,
        {
          asps: aspLoginDetail.data.data,
          ...statusFilterParams, // Pass filter parameters for status-based filtering
          startDate: payload.startDate,
          endDate: payload.endDate,
        }
      );
      if (!aspStatusDetail.data.success) {
        return res.status(200).json(aspStatusDetail.data);
      }

      // Get cocoVehicleId from ASP to OwnPatrolVehicle relationship instead of attendance
      // Map ASP IDs to their OwnPatrolVehicle records from the initial query
      const aspToVehicleMap = new Map();
      asps.forEach((asp: any) => {
        // Handle both array and single object cases
        const vehicle = Array.isArray(asp.ownPatrolVehicle)
          ? asp.ownPatrolVehicle[0]
          : asp.ownPatrolVehicle;

        if (vehicle) {
          aspToVehicleMap.set(asp.id, {
            id: vehicle.id,
            vehicleRegistrationNumber: vehicle.vehicleRegistrationNumber,
            vehicleTypeId: vehicle.vehicleTypeId,
            vehicleType: vehicle.vehicleType ? vehicle.vehicleType.name : null,
          });
        }
      });

      // Map vehicle information to ASPs from status detail response
      aspStatusDetail.data.data.forEach((asp: any) => {
        //COCO ASP
        if (asp.isOwnPatrol) {
          const vehicleInfo = aspToVehicleMap.get(asp.id);
          if (vehicleInfo) {
            asp.vehicleRegistrationNumber = vehicleInfo.vehicleRegistrationNumber;
            asp.vehicleTypeId = vehicleInfo.vehicleTypeId;
            asp.vehicleType = vehicleInfo.vehicleType;
          }
        }
      });

      return res.status(200).json({
        success: true,
        data: aspStatusDetail.data.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getOverAllMapViewAspMechanics(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const validatorRules = {
        aspId: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let where = Object();
      where.aspId = payload.aspId;

      const attributes: any = [
        "id",
        "code",
        "name",
        "email",
        "contactNumber",
        "alternateContactNumber",
        "latitude",
        "longitude",
        "address",
      ];

      const options: any = {
        where,
        attributes,
      };
      const aspMechanics = await AspMechanic.findAll(options);
      if (aspMechanics.length == 0) {
        return res.status(200).json({
          success: false,
          error: "ASP Mechanic not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: aspMechanics,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function technicianOverAllMapView(req: Request, res: Response) {
    try {
      const payload = req.body;
      const validatorRules = {
        lat: "required|string",
        long: "required|string",
        subServiceIds: "array",
        "subServiceIds.*": "required",
        radius: "required|string",
        searchKey: "string",
        // Filter parameters - all optional
        startDate: "string",
        endDate: "string",
        statusIds: "array",
        caseSubjectNames: "array",
        stateIds: "array",
        slaStatusIds: "array",
        clientIds: "array",
        caseNumber: "string",
        unAssignmentReasonIds: "array",
        serviceIds: "array",
        aspActivityStatusIds: "array",
        activityStatusIds: "array",
        serviceOrganisationIds: "array",
        aspCode: "string",
        apiUserIds: "array",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let where: any = {};
      let having = null;
      let order = null;
      if (payload.searchKey) {
        where[Op.or] = [
          { code: { [Op.like]: `%${payload.searchKey}%` } },
          { name: { [Op.like]: `%${payload.searchKey}%` } },
        ];
      }

      // Filter only COCO technicians (aspTypeId = 771)
      where.aspTypeId = 771;

      const attributes: any = [
        "id",
        "code",
        "name",
        "email",
        "contactNumber",
        "alternateContactNumber",
        "latitude",
        "longitude",
        "address",
        "aspTypeId",
        "cocoVehicleId",
        "cityId",
      ];

      const haversine = `(
          6371 * acos(
              cos(radians(${payload.lat}))
              * cos(radians(aspMechanic.latitude))
              * cos(radians(aspMechanic.longitude) - radians(${payload.long}))
              + sin(radians(${payload.lat})) * sin(radians(aspMechanic.latitude))
          )
        )`;
      attributes.push([sequelize.literal(haversine), "distance"]);

      // Uncomment this when the radius filter is required
      // if (payload.radius) {
      //   having = sequelize.literal(`distance <= ${payload.radius}`);
      // }
      order = sequelize.col("distance");

      const options: any = {
        where,
        attributes,
      };
      if (having) {
        options.having = having;
      }
      if (order) {
        options.order = order;
      }

      // Build OwnPatrolVehicle where clause for Service Organisation filter
      const ownPatrolVehicleWhere: any = {};
      if (payload.serviceOrganisationIds && payload.serviceOrganisationIds.length > 0) {
        ownPatrolVehicleWhere.serviceOrganisationId = {
          [Op.in]: payload.serviceOrganisationIds,
        };
      }

      // Build ASP where clause for aspCode filter
      const aspWhere: any = {};
      if (payload.aspCode) {
        aspWhere.code = { [Op.like]: `%${payload.aspCode}%` };
      }

      // Build City where clause for stateIds filter
      const cityWhere: any = {};
      if (payload.stateIds && payload.stateIds.length > 0) {
        cityWhere.stateId = {
          [Op.in]: payload.stateIds,
        };
      }

      // Build AspClient where clause for clientIds filter
      const aspClientWhere: any = {};
      if (payload.clientIds && payload.clientIds.length > 0) {
        aspClientWhere.clientId = {
          [Op.in]: payload.clientIds,
        };
      }

      options.include = [
        {
          model: City,
          as: "city",
          attributes: ["id", "name", "stateId"],
          required: Object.keys(cityWhere).length > 0,
          where: Object.keys(cityWhere).length > 0 ? cityWhere : undefined,
          paranoid: false,
        },
        {
          model: OwnPatrolVehicle,
          as: "cocoVehicle",
          attributes: ["id", "vehicleRegistrationNumber", "vehicleTypeId", "aspId"],
          required: Object.keys(ownPatrolVehicleWhere).length > 0 || Object.keys(aspWhere).length > 0 || Object.keys(aspClientWhere).length > 0, // Make required if filtering by serviceOrganisationId or aspCode or clientIds
          where: Object.keys(ownPatrolVehicleWhere).length > 0 ? ownPatrolVehicleWhere : undefined,
          include: [
            {
              model: VehicleType,
              as: "vehicleType",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: Asp,
              attributes: ["id", "code", "name"],
              required: Object.keys(aspWhere).length > 0 || Object.keys(aspClientWhere).length > 0,
              where: Object.keys(aspWhere).length > 0 ? aspWhere : undefined,
              paranoid: false,
              ...(Object.keys(aspClientWhere).length > 0 ? {
                include: [
                  {
                    model: AspClient,
                    as: "clients",
                    attributes: ["id", "clientId"],
                    required: true,
                    where: aspClientWhere,
                  },
                ],
              } : {}),
            },
          ],
        },
      ];

      // Filter by subServiceIds using AspMechanicSubService relationship
      if (payload.subServiceIds && payload.subServiceIds.length > 0) {
        options.include.push({
          model: AspMechanicSubService,
          as: "aspMechanicSubServices",
          attributes: ["id", "subServiceId"],
          required: true,
          where: {
            subServiceId: {
              [Op.in]: payload.subServiceIds,
            },
          },
        });
      }

      // Filter by serviceIds using AspMechanicSubService -> SubService relationship
      if (payload.serviceIds && payload.serviceIds.length > 0) {
        options.include.push({
          model: AspMechanicSubService,
          as: "aspMechanicSubServices",
          attributes: ["id", "subServiceId"],
          required: true,
          include: [
            {
              model: SubService,
              as: "subService",
              attributes: ["id", "serviceId"],
              required: true,
              where: {
                serviceId: {
                  [Op.in]: payload.serviceIds,
                },
              },
            },
          ],
        });
      }

      let technicians = await AspMechanic.findAll(options);
      if (technicians.length == 0) {
        return res.status(200).json({
          success: false,
          error: "No COCO Technician found",
        });
      }

      // Add stateId to each technician from city relationship
      technicians.forEach((technician: any) => {
        if (technician.city) {
          technician.stateId = technician.city.stateId;
        }
        // Add vehicle information from cocoVehicle relationship
        if (technician.cocoVehicle) {
          const vehicle = Array.isArray(technician.cocoVehicle)
            ? technician.cocoVehicle[0]
            : technician.cocoVehicle;
          if (vehicle) {
            technician.vehicleRegistrationNumber = vehicle.vehicleRegistrationNumber;
            technician.vehicleTypeId = vehicle.vehicleTypeId;
            technician.vehicleType = vehicle.vehicleType ? vehicle.vehicleType.name : null;
          }
        }
      });

      const technicianLoginDetail: any = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.rsaTechnicianOverAllMapViewLoginDetail}`,
        {
          technicians: technicians,
          startDate: payload.startDate,
          endDate: payload.endDate,
        }
      );
      if (!technicianLoginDetail.data.success) {
        return res.status(200).json(technicianLoginDetail.data);
      }

      // Prepare filter parameters to pass to Case Service for status filtering
      const statusFilterParams: any = {};
      if (payload.aspActivityStatusIds && payload.aspActivityStatusIds.length > 0) {
        statusFilterParams.aspActivityStatusIds = payload.aspActivityStatusIds;
      }
      if (payload.activityStatusIds && payload.activityStatusIds.length > 0) {
        statusFilterParams.activityStatusIds = payload.activityStatusIds;
      }
      // Un-Assignment Reasons (mapped to rejectReasonId in ActivityAspDetails)
      if (payload.unAssignmentReasonIds && payload.unAssignmentReasonIds.length > 0) {
        statusFilterParams.unAssignmentReasonIds = payload.unAssignmentReasonIds;
      }
      // Case-related filters - filter technicians based on their assigned cases
      if (payload.statusIds && payload.statusIds.length > 0) {
        statusFilterParams.statusIds = payload.statusIds;
      }
      // Pass caseSubjectNames to case service - it will convert to IDs internally
      if (payload.caseSubjectNames && payload.caseSubjectNames.length > 0) {
        statusFilterParams.caseSubjectNames = payload.caseSubjectNames;
      }
      if (payload.caseNumber) {
        statusFilterParams.caseNumber = payload.caseNumber;
      }
      // SLA Status filter
      if (payload.slaStatusIds && payload.slaStatusIds.length > 0) {
        statusFilterParams.slaStatusIds = payload.slaStatusIds;
      }

      const technicianStatusDetail = await axios.post(
        `${caseServiceUrl}/${endpoint.case.rsaTechnicianOverAllMapViewStatusDetail}`,
        {
          technicians: technicianLoginDetail.data.data,
          ...statusFilterParams, // Pass filter parameters for status-based filtering
          startDate: payload.startDate,
          endDate: payload.endDate,
        }
      );
      if (!technicianStatusDetail.data.success) {
        return res.status(200).json(technicianStatusDetail.data);
      }

      return res.status(200).json({
        success: true,
        data: technicianStatusDetail.data.data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getCaseSubServiceData(req: Request, res: Response) {
    try {
      const inData = req.body;

      if (inData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData = [];
      for (const item of inData) {
        const promises = [
          ActivityStatus.findOne({
            where: { id: item.activityStatusId },
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
          CaseStatus.findOne({
            where: { id: item.caseDetailStatusId },
            attributes: ["id", "name"],
            paranoid: false,
          }),
        ];

        if (
          item.activity &&
          item.activity.crmSlas &&
          item.activity.crmSlas[0]
        ) {
          const slaConfig: any = await Config.findOne({
            where: { id: item.activity.crmSlas[0].slaConfigId },
            attributes: ["name"],
          });
          item.activity.crmSlas[0].slaConfigName =
            slaConfig?.dataValues.name || null;
        }

        const [
          activityStatus,
          caseSubject,
          subService,
          caseType,
          accidentType,
          channel,
          policyType,
          caseStatus,
        ] = await Promise.all(promises);

        finalData.push({
          id: item.id,
          caseNumber: item.caseNumber,
          caseDetailId: item.caseDetailId,
          caseStatusId: caseStatus?.dataValues.id || null,
          caseStatus: caseStatus?.dataValues.name || null,
          subject: caseSubject?.dataValues.name || null,
          activityStatusId: activityStatus?.dataValues.id || null,
          activityStatus: activityStatus?.dataValues.name || null,
          activityAgentPickedAt: item.activityAgentPickedAt
            ? moment
              .tz(item.activityAgentPickedAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A")
            : "",
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
          activityCreatedAt: moment
            .tz(item.activityCreatedAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          crmSla: item.activity?.crmSlas ? item.activity.crmSlas[0] : null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "success",
        data: finalData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getCaseSubServiceGridData(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (inData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData = [];
      for (const item of inData) {
        const promises = [
          ActivityStatus.findOne({
            where: { id: item.activityStatusId },
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
          CaseStatus.findOne({
            where: { id: item.caseDetailStatusId },
            attributes: ["id", "name"],
            paranoid: false,
          }),
          AspActivityStatus.findOne({
            where: { id: item.aspActivityStatusId },
            attributes: ["id", "name"],
            paranoid: false,
          }),
          ActivityAppStatus.findOne({
            where: { id: item.activityAppStatusId },
            attributes: ["id", "name"],
            paranoid: false,
          }),
        ];

        if (
          item.activity &&
          item.activity.crmSlas &&
          item.activity.crmSlas[0]
        ) {
          const slaConfig: any = await Config.findOne({
            where: { id: item.activity.crmSlas[0].slaConfigId },
            attributes: ["name"],
          });
          item.activity.crmSlas[0].slaConfigName =
            slaConfig?.dataValues.name || null;
        }

        const [
          activityStatus,
          caseSubject,
          subService,
          caseType,
          accidentType,
          channel,
          policyType,
          caseStatus,
          aspActivityStatus,
          activityAppStatus,
        ] = await Promise.all(promises);

        finalData.push({
          id: item.id,
          caseDetailId: item.caseDetailId,
          caseNumber: item.caseNumber,
          caseStatusId: caseStatus?.dataValues.id || null,
          caseStatus: caseStatus?.dataValues.name || null,
          subject: caseSubject?.dataValues.name || null,
          activityStatusId: activityStatus?.dataValues.id || null,
          activityStatus: activityStatus?.dataValues.name || null,
          aspActivityStatusId: aspActivityStatus?.dataValues.id || null,
          aspActivityStatus: aspActivityStatus?.dataValues.name || null,
          activityAppStatusId: activityAppStatus?.dataValues.id || null,
          activityAppStatus: activityAppStatus?.dataValues.name || null,
          activityAgentPickedAt: item.activityAgentPickedAt
            ? moment
              .tz(item.activityAgentPickedAt, "Asia/Kolkata")
              .format("DD/MM/YYYY hh:mm A")
            : "",
          vin: item.caseVin,
          registrationNumber: item.caseRegistrationNumber,
          customerContactName: item.caseCustomerContactName,
          customerMobileNumber: item.caseCustomerMobileNumber,
          customerCurrentContactName: item.caseCustomerCurrentContactName,
          customerCurrentMobileNumber: item.caseCustomerCurrentMobileNumber,
          voiceOfCustomer: item.caseVoiceOfCustomer,
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
          activityCreatedAt: moment
            .tz(item.activityCreatedAt, "Asia/Kolkata")
            .format("DD/MM/YYYY hh:mm A"),
          crmSla: item.activity?.crmSlas ? item.activity.crmSlas[0] : null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "success",
        data: finalData,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  export async function getCaseInfoGridData(req: Request, res: Response) {
    try {
      const inData = req.body;
      if (!inData || inData.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const finalData = await Promise.all(
        inData.map(async (item: any) => {
          const [
            caseStatus,
            caseSubject,
            service,
            caseType,
            accidentType,
            channel,
            policyType,
          ] = await Promise.all([
            CaseStatus.findOne({
              where: { id: item.caseDetail.statusId },
              attributes: ["id", "name"],
              paranoid: false,
            }),
            CaseSubject.findOne({
              where: { id: item.caseDetail.subjectID },
              attributes: ["id", "name"],
              paranoid: false,
            }),
            Service.findOne({
              where: { id: item.serviceId },
              attributes: ["id", "name"],
              paranoid: false,
            }),
            Config.findOne({
              where: { id: item.caseTypeId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: item.accidentTypeId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: item.channelId },
              attributes: ["id", "name"],
            }),
            Config.findOne({
              where: { id: item.policyTypeId },
              attributes: ["id", "name"],
            }),
          ]);

          return {
            id: item.id,
            caseDetailId: item.caseDetailId,
            customerContactName: item.customerContactName,
            customerMobileNumber: item.customerMobileNumber,
            customerCurrentContactName: item.customerCurrentContactName,
            customerCurrentMobileNumber: item.customerCurrentMobileNumber,
            caseType: caseType?.dataValues.name || null,
            accidentType: accidentType?.dataValues.name || null,
            channel: channel?.dataValues.name || null,
            policyType: policyType?.dataValues.name || null,
            customerType: {
              irateCustomer: item.irateCustomer,
              womenAssist: item.womenAssist,
            },
            service: service?.dataValues.name || null,
            voiceOfCustomer: item.voiceOfCustomer,
            caseDetail: {
              caseNumber: item.caseDetail.caseNumber,
              subject: caseSubject?.dataValues.name || null,
              vin: item.caseDetail.vin,
              registrationNumber: item.caseDetail.registrationNumber,
              createdAt: moment
                .tz(item.caseDetail.createdAt, "Asia/Kolkata")
                .format("DD/MM/YYYY hh:mm A"),
              status: caseStatus?.dataValues.name || null,
              statusId: item.caseDetail.statusId,
            },
          };
        })
      );

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

  //Master details listing for filtering used in case sub service list page.
  export async function getCaseSubServiceListFilterData(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const userPermissions = payload.authUserData.permissions;
      const userId = payload.authUserData.id;
      const getCaseFilterData = await Utils.getCaseFilterData(
        userPermissions,
        userId
      );
      const caseStatuses = getCaseFilterData.caseStatuses;
      const caseSubjects = getCaseFilterData.caseSubjects;
      const services = getCaseFilterData.services;
      const activityStatuses = getCaseFilterData.activityStatuses;
      const aspActivityStatuses = getCaseFilterData.aspActivityStatuses;
      const states = getCaseFilterData.states;
      const locationCategories = getCaseFilterData.locationCategories;
      const clients = getCaseFilterData.clients;

      const slaStatuses = [
        {
          id: 1,
          name: "Achieved",
        },
        {
          id: 2,
          name: "Not Achieved",
        },
        {
          id: 3,
          name: "Exceeded Expectation",
        },
        {
          id: 4,
          name: "Performance Inprogress",
        },
      ];

      const data = {
        caseStatuses,
        caseSubjects,
        services,
        activityStatuses,
        aspActivityStatuses,
        slaStatuses,
        states,
        locationCategories,
        clients,
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
  }

  //Master details listing for filtering used in case list page.
  export async function getCaseListFilterData(req: Request, res: Response) {
    try {
      const payload = req.body;
      const userPermissions = payload.authUserData.permissions;
      const userId = payload.authUserData.id;
      const getCaseFilterData = await Utils.getCaseFilterData(
        userPermissions,
        userId
      );
      const caseStatuses = getCaseFilterData.caseStatuses;
      const caseSubjects = getCaseFilterData.caseSubjects;
      const services = getCaseFilterData.services;
      const states = getCaseFilterData?.states || [];
      const locationCategories = getCaseFilterData?.locationCategories || [];
      const clients = getCaseFilterData?.clients || [];

      const data = {
        caseStatuses,
        caseSubjects,
        services,
        states,
        locationCategories,
        clients,
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
  }

  //Master details listing for filtering used in reimbursement list page.
  export async function getReimbursementListFilterData(
    req: Request,
    res: Response
  ) {
    try {
      const payload = req.body;
      const userPermissions = payload.authUserData.permissions;
      const userId = payload.authUserData.id;
      const getCaseFilterData = await Utils.getCaseFilterData(
        userPermissions,
        userId
      );
      const caseStatuses = getCaseFilterData.caseStatuses;
      const caseSubjects = getCaseFilterData.caseSubjects;
      const services = getCaseFilterData.services;
      const states = getCaseFilterData?.states || [];
      const locationCategories = getCaseFilterData?.locationCategories || [];
      const clients = getCaseFilterData?.clients || [];

      const data = {
        caseStatuses,
        caseSubjects,
        services,
        states,
        locationCategories,
        clients,
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
  }

  //Master details listing for filtering used in map view page.
  export async function getMapViewFilterData(req: Request, res: Response) {
    try {
      const payload = req.body;
      const userPermissions = payload.authUserData.permissions;
      const userId = payload.authUserData.id;
      const getCaseFilterData = await Utils.getCaseFilterData(
        userPermissions,
        userId
      );
      const caseStatuses = getCaseFilterData.caseStatuses;
      const caseSubjects = getCaseFilterData.caseSubjects;
      const services = getCaseFilterData.services;
      const activityStatuses = getCaseFilterData.activityStatuses;
      const aspActivityStatuses = getCaseFilterData.aspActivityStatuses;
      const states = getCaseFilterData?.states || [];
      const clients = getCaseFilterData?.clients || [];

      const slaStatuses = [
        {
          id: 1,
          name: "Achieved",
        },
        {
          id: 2,
          name: "Not Achieved",
        },
        {
          id: 3,
          name: "Exceeded Expectation",
        },
        {
          id: 4,
          name: "Performance Inprogress",
        },
      ];

      // Get Service Organisations
      const serviceOrganisations = await ServiceOrganisation.findAll({
        attributes: ["id", "name"],
        order: [["id", "ASC"]],
        paranoid: false,
      });

      // Get Un-Assignment Reasons (using AspActivityRejectReason as un-assignment reasons)
      const unAssignmentReasons = await AspActivityRejectReason.findAll({
        attributes: ["id", "name"],
        order: [["id", "ASC"]],
        paranoid: false,
      });

      // Get Vehicle Case Filters (using NspFilter with specific typeId if needed)
      const vehicleCaseFilters = await NspFilter.findAll({
        attributes: ["id", "name"],
        order: [["id", "ASC"]],
        paranoid: false,
      });

      // Get API Users (users with API access - this might need to be fetched from User Service)
      // For now, returning empty array - this should be implemented based on your user service structure
      const apiUsers: any[] = [];

      const data = {
        caseStatuses,
        caseSubjects,
        services,
        activityStatuses,
        aspActivityStatuses,
        slaStatuses,
        states,
        clients,
        serviceOrganisations,
        unAssignmentReasons,
        vehicleCaseFilters,
        apiUsers,
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
  }
}

const extractDistances = (data: any) => {
  return data.flatMap((iterator: any) => {
    if (iterator.elements) {
      return iterator.elements.flatMap((element: any) => {
        if (element.distance && element.distance.value) {
          return Math.round(element.distance.value / 1000);
        } else {
          // console.error(
          //   "Invalid response structure - distance.value is missing."
          // );
          return null;
        }
      });
    } else {
      // console.error("Invalid response structure - elements is missing.");
      return null;
    }
  });
};

export default AspDataController;
