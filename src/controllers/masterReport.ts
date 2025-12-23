import { Op } from "sequelize";
import moment from "moment-timezone";
import {
  ActivityAppStatus,
  ActivityFinanceStatus,
  ActivityStatus,
  AdditionalCharge,
  Address,
  Asp,
  AspActivityCancelReason,
  AspActivityRejectReason,
  AspActivityStatus,
  AspMechanic,
  CallCenter,
  CallCenterLocation,
  CaseCancelReason,
  CaseStatus,
  CaseSubject,
  City,
  Client,
  Config,
  ConfigType,
  Country,
  Dealer,
  DeliveryRequestPrice,
  FinancialYears,
  Inventory,
  Language,
  MembershipType,
  NewCaseEmailReceiver,
  PaymentMethod,
  RazorpayPaymentStatus,
  Region,
  SerialNumberCategories,
  SerialNumberGroupSerialNumberSegments,
  SerialNumberGroups,
  SerialNumberSegments,
  Service,
  ServiceOrganisation,
  State,
  SubService,
  Tax,
  VehicleMake,
  VehicleModel,
  VehicleType,
  District,
  NearestCity,
  Taluk,
  SlaSetting,
  SlaViolateReason,
} from "../database/models/index";
import { generateXLSXAndXLSExport } from "../middleware/excelMiddleware";
import { sla } from "../routes/masterRouter";

const computeSLAStatus = async (finalData: any, reportColumnIds: any) => {
  try {
    const slaSetting: any = await SlaSetting.findAll({});
    let aspDefaultTime = slaSetting.find((s: any) => s.typeId == 361);
    let agentDefaultTime = slaSetting.find((s: any) => s.typeId == 360);
    let dealerDefaultTime = slaSetting.find((s: any) => s.typeId == 363);
    for (let data of finalData) {
      if (
        data["Agent Time Difference of Pickup vs Assigned"] &&
        reportColumnIds.includes(107)
      ) {
        data["Agent SLA Status"] = "";
        const [agenthours, agentminutes, seconds] = data[
          "Agent Time Difference of Pickup vs Assigned"
        ]
          .split(":")
          .map(Number);
        let agentPickUpTimeDiffInMinutes = agenthours * 60 + agentminutes;
        if (agentPickUpTimeDiffInMinutes > agentDefaultTime.time / 60) {
          data["Agent SLA Status"] = "Delayed";
        } else if (agentPickUpTimeDiffInMinutes == agentDefaultTime.time / 60) {
          data["Agent SLA Status"] = "Ontime";
        } else if (agentPickUpTimeDiffInMinutes < agentDefaultTime.time / 60) {
          data["Agent SLA Status"] = "Before";
        }
      }
      if (
        data["Dealer Time Difference Payment Request Vs paid"] &&
        reportColumnIds.includes(112)
      ) {
        data["Dealer SLA Status"] = "";
        const [dealerhours, dealerminutes, seconds] = data[
          "Dealer Time Difference Payment Request Vs paid"
        ]
          .split(":")
          .map(Number);
        let dealerPickUpTimeDiffInMinutes = dealerhours * 60 + dealerminutes;
        if (dealerPickUpTimeDiffInMinutes > dealerDefaultTime.time / 60) {
          data["Dealer SLA Status"] = "Delayed";
        } else if (
          dealerPickUpTimeDiffInMinutes ==
          dealerDefaultTime.time / 60
        ) {
          data["Dealer SLA Status"] = "Ontime";
        } else if (
          dealerPickUpTimeDiffInMinutes <
          dealerDefaultTime.time / 60
        ) {
          data["Dealer SLA Status"] = "Before";
        }
      }
    }
    return finalData;
  } catch (error: any) {
    throw error;
  }
};
class MasterReportController {
  constructor() {}

  public async masterReporting(req: any, res: any) {
    try {
      const payload = req.body;
      const mastersData = Object();
      const usersData = payload.userObject;
      const caseObject = payload.caseObject;
      const defaultMasters: any = {
        vehicleTypes: VehicleType,
        vehicleMakes: VehicleMake,
        vehicleModels: VehicleModel,
        caseSubjects: CaseSubject,
        caseStatuses: CaseStatus,
        activityStatuses: ActivityStatus,
        additionalCharges: AdditionalCharge,
        addresses: Address,
        callCenters: CallCenter,
        clients: Client,
        configs: Config,
        configTypes: ConfigType,
        countries: Country,
        deliveryRequestPrices: DeliveryRequestPrice,
        financialYears: FinancialYears,
        inventories: Inventory,
        languages: Language,
        membershipTypes: MembershipType,
        newCaseEmailReceivers: NewCaseEmailReceiver,
        paymentMethods: PaymentMethod,
        razorpayPaymentStatuses: RazorpayPaymentStatus,
        regions: Region,
        serialNumberCategories: SerialNumberCategories,
        serialNumberGroups: SerialNumberGroups,
        serialNumberGroupSerialNumberSegments:
          SerialNumberGroupSerialNumberSegments,
        serialNumberSegments: SerialNumberSegments,
        serviceOrganisations: ServiceOrganisation,
        services: Service,
        subServices: SubService,
        taxes: Tax,
        callCenterLocations: CallCenterLocation,
        activityAppStatuses: ActivityAppStatus,
        caseCancelReasons: CaseCancelReason,
        dealers: Dealer,
        states: State,
        cities: City,
        asps: Asp,
        aspActivityRejectReasons: AspActivityRejectReason,
        aspActivityCancelReasons: AspActivityCancelReason,
        aspMechanics: AspMechanic,
        activityFinanceStatuses: ActivityFinanceStatus,
        aspActivityStatuses: AspActivityStatus,
        districts: District,
        nearestCities: NearestCity,
        taluks: Taluk,
        slaViolateReasons: SlaViolateReason,
      };

      let tempMasters: any = Array.from(new Set(payload.masterTables.master)); //CONTAINS ALL THE MASTER TABLES
      for (const masters of tempMasters) {
        if (
          defaultMasters[masters] &&
          payload.tablePrimaryIds[masters] &&
          payload.tablePrimaryIds[masters].length > 0
        ) {
          //INCLUDE PARANOID IF PARANOID EXISTS IN MODEL
          const paranoidOption =
            defaultMasters[masters].options.paranoid !== undefined
              ? { paranoid: false }
              : {};
          let modelValue: any = await defaultMasters[masters].findAll({
            where: { id: payload.tablePrimaryIds[masters] },
            attributes: payload.tableColumns[masters],
            ...paranoidOption,
          });
          mastersData[masters] = modelValue; //PUSH MODEL OBJECTS TO MASTERS DATA
        }
      }

      const masterTableValues = Object();
      for (const masters in mastersData) {
        const dataObject = mastersData[masters].reduce(
          (accumulator: any, master: any) => {
            accumulator[master.id] = master.dataValues;
            return accumulator;
          },
          {}
        );
        masterTableValues[masters] = dataObject; //PUSH MODEL DATAVALUES AGAINST TABLE LIKE vehicleTypes: { '1': { id: 1, name: 'Light Commercial Vehicle' } },
      }
      const finalData = [107, 112].some((element) =>
        payload.reportColumnIds.includes(element)
      )
        ? await computeSLAStatus(payload.finalData, payload.reportColumnIds)
        : payload.finalData;
      const collection = payload.collection;
      const reportColumnIds = payload.reportColumnIds;

      const finalData1: any = [];
      for (const item of finalData) {
        let mappedData = Object();
        for (const reportColumnId of reportColumnIds) {
          let columnName = collection[reportColumnId][1]; //COLUMN NAME
          let hasMapping = collection[reportColumnId][2]; //MAPPING
          let targetTable = collection[reportColumnId][3]; //TARGET TABLE
          let targetColumn = collection[reportColumnId][4]; //TARGET COLUMN
          let fieldType = collection[reportColumnId][5]; //FIELD TYPE
          let fromService = collection[reportColumnId][6]; //FROM SERVICE
          let targetTableHasRelation = collection[reportColumnId][7]; //TARGET TABLE HAS RELATION
          let relationTable = collection[reportColumnId][8]; //TARGET TABLE RELATION TABLE
          let relationName = collection[reportColumnId][9]; //TARGET TABLE RELATION NAME
          let relationAttribute = collection[reportColumnId][10]; //TARGET TABLE RELATION ATTRIBUTES

          if (item[columnName] != null) {
            if (
              hasMapping &&
              fromService == "master" &&
              targetTableHasRelation
            ) {
              //INCLUDE PARANOID IF PARANOID EXISTS IN MODEL
              const targetModelParanoid =
                defaultMasters[targetTable].options.paranoid !== undefined
                  ? { paranoid: false }
                  : {};
              const relationModelParanoid =
                defaultMasters[relationTable].options.paranoid !== undefined
                  ? { paranoid: false }
                  : {};

              let targetModel = defaultMasters[targetTable];
              let relationTargetTableValue: any = await targetModel.findOne({
                where: {
                  id: masterTableValues[targetTable][item[columnName]]["id"],
                },
                ...targetModelParanoid,
                include: {
                  model: defaultMasters[relationTable],
                  attributes: [relationAttribute],
                  ...relationModelParanoid,
                },
              });

              mappedData[columnName] =
                relationTargetTableValue &&
                relationTargetTableValue[relationName]
                  ? relationTargetTableValue[relationName].dataValues[
                      relationAttribute
                    ]
                  : "";
            } else if (hasMapping && fromService == "master") {
              mappedData[columnName] =
                masterTableValues[targetTable][item[columnName]]?.[
                  targetColumn
                ];
            } else if (hasMapping && fromService == "user") {
              mappedData[columnName] =
                usersData[targetTable][item[columnName]]?.[targetColumn];
            } else if (hasMapping && fromService == "case") {
              mappedData[columnName] =
                caseObject[targetTable][item[columnName]]?.[targetColumn];
            } else {
              let data = "";
              if (fieldType == "dateTime") {
                data = dateTimeFunction(item[columnName]);
              } else if (fieldType == "date") {
                data = dateFunction(item[columnName]);
              } else if (fieldType == "boolean") {
                data = booleanFunction(item[columnName]);
              } else {
                data = item[columnName];
              }
              mappedData[columnName] = data;
            }
          } else {
            mappedData[columnName] = item[columnName];
          }
        }
        finalData1.push(mappedData);
      }

      if (finalData.length > 0) {
        let buffer = generateXLSXAndXLSExport(
          finalData1,
          Object.keys(finalData1[0]),
          "xlsx",
          "deliveryRequestReport"
        );
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        return res.status(200).json({
          success: true,
          message: "Data Fetched Successfully",
          format: "xlsx",
          data: buffer,
        });
      } else {
        return res.status(200).json({
          success: false,
          error: "No Records Found",
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
function dateTimeFunction(text: any) {
  return moment.tz(text, "Asia/Kolkata").format("DD-MM-YYYY hh:mm:ss A");
}
function dateFunction(text: any) {
  return moment.tz(text, "Asia/Kolkata").format("DD-MM-YYYY");
}
function booleanFunction(text: any) {
  return text == 0 ? "No" : "Yes";
}

export default new MasterReportController();
