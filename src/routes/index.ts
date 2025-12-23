import bodyParser from "body-parser";
import {
  config,
  configType,
  vehicleType,
  vehicleMake,
  vehicleModel,
  service,
  subService,
  caseStatus,
  caseCancelReason,
  activityFinanceStatus,
  activityStatus,
  aspActivityStatus,
  aspActivityRejectReason,
  paymentMethod,
  razorpayPaymentStatus,
  membershipType,
  dealer,
  client,
  country,
  state,
  region,
  city,
  caseSubject,
  answerType,
  serviceOrganisation,
  language,
  callCenter,
  callCenterLocation,
  inventory,
  address,
  asp,
  seeder,
  aspMechanic,
  additionalCharge,
  deliveryRequestPrice,
  aspActivityCancelReason,
  newCaseEmailReceiver,
  serialNumber,
  tax,
  aspRejectedCcDetailReason,
  sla,
  interaction,
  disposition,
  callInitiation,
  conditionOfVehicle,
  policyPremium,
  entitlement,
  manualLocationReason,
  reminder,
  common,
  mailConfiguration,
  masterReport,
  serviceDetailMaster,
  nspFilter,
  milestone,
  ownPatrolVehicle,
  ownPatrolVehicleHelper,
  taluk,
  district,
  nearestCity,
  escalationReason,
  systemIssueReason,
  slaViolateReason,
  rosFailureReason,
  rosSuccessReason,
  towSuccessReason,
  towFailureReason,
  proposedDelayReason,
  distanceMatrixApiDetail,
  serviceDescription,
} from "./masterRouter";
import { Router } from "express";
import aspData from "./aspData";
import caseData from "./caseData";
import attendance from "./attendance";
import manager from "./manager";
import template from "./template";
import caseInformation from "./caseInformation";
import otherService from "./otherService";
import reimbursement from "./reimbursement";
import userLoginStatus from "./userLoginStatus";
import dashboard from "./dashboard";
import distance from "./distance";
import latestUpdate from "./latestUpdate";

import customerFeedback from "./customerFeedback";

import buddyApp from "./buddyApp";
const jsonParser = bodyParser.json({ limit: "100mb" });
const router = Router();

//Master service Testing purpose API;
router.get("/", (req: any, res: any) => {
  res.status(200).send({
    message: "Welcome to the Master Service!",
  });
  return;
});

//Access the master routes;
router.use("/configs", jsonParser, config);
router.use("/configTypes", jsonParser, configType);
router.use("/countries", jsonParser, country);
router.use("/states", jsonParser, state);
router.use("/regions", jsonParser, region);
router.use("/cities", jsonParser, city);
router.use("/caseSubjects", jsonParser, caseSubject);
router.use("/answerTypes", jsonParser, answerType);
router.use("/vehicleTypes", jsonParser, vehicleType);
router.use("/vehicleMakes", jsonParser, vehicleMake);
router.use("/vehicleModels", jsonParser, vehicleModel);
router.use("/services", jsonParser, service);
router.use("/subServices", jsonParser, subService);
router.use("/caseStatuses", jsonParser, caseStatus);
router.use("/caseCancelReasons", jsonParser, caseCancelReason);
router.use("/activityFinanceStatuses", jsonParser, activityFinanceStatus);
router.use("/activityStatuses", jsonParser, activityStatus);
router.use("/aspActivityStatuses", jsonParser, aspActivityStatus);
router.use("/aspActivityRejectReasons", jsonParser, aspActivityRejectReason);
router.use("/paymentMethods", jsonParser, paymentMethod);
router.use("/razorpayPaymentStatuses", jsonParser, razorpayPaymentStatus);
router.use("/membershipTypes", jsonParser, membershipType);
router.use("/dealers", jsonParser, dealer);
router.use("/clients", jsonParser, client);
router.use("/serviceOrganisations", jsonParser, serviceOrganisation);
router.use("/languages", jsonParser, language);
router.use("/callCenters", jsonParser, callCenter);
router.use("/callCenterLocations", jsonParser, callCenterLocation);
router.use("/inventories", jsonParser, inventory);
router.use("/addresses", jsonParser, address);
router.use("/asps", jsonParser, asp);
router.use("/aspMechanics", jsonParser, aspMechanic);
router.use("/additionalCharges", jsonParser, additionalCharge);
router.use("/deliveryRequestPrice", jsonParser, deliveryRequestPrice);
router.use("/taxes", jsonParser, tax);
router.use("/aspActivityCancelReasons", jsonParser, aspActivityCancelReason);
router.use("/newCaseEmailReceivers", jsonParser, newCaseEmailReceiver);
router.use("/serialNumber", jsonParser, serialNumber);
router.use("/disposition", jsonParser, disposition);
router.use("/callInitiation", jsonParser, callInitiation);
router.use("/conditionOfVehicle", jsonParser, conditionOfVehicle);
router.use("/policyPremium", jsonParser, policyPremium);
router.use("/entitlements", jsonParser, entitlement);
router.use("/manualLocationReasons", jsonParser, manualLocationReason);
router.use("/aspRejCcDetailReasons", jsonParser, aspRejectedCcDetailReason);
router.use("/reminder", jsonParser, reminder);
router.use("/sla", jsonParser, sla);
router.use("/milestone", jsonParser, milestone);
router.use("/ownPatrolVehicle", jsonParser, ownPatrolVehicle);
router.use("/ownPatrolVehicleHelper", jsonParser, ownPatrolVehicleHelper);
router.use("/slaViolateReason", jsonParser, slaViolateReason);
router.use("/rosFailureReason", jsonParser, rosFailureReason);
router.use("/rosSuccessReason", jsonParser, rosSuccessReason);
router.use("/towSuccessReason", jsonParser, towSuccessReason);
router.use("/towFailureReason", jsonParser, towFailureReason);
router.use("/proposedDelayReason", jsonParser, proposedDelayReason);

//ACTIVITY LIST AND GET DATA
router.use("/asp/activities/data", jsonParser, aspData);

//CASE LIST GET DATA
router.use("/case/list", jsonParser, aspData);
router.use("/case/getData", jsonParser, caseData);

//Nearest service provider data
router.use("/nsp", aspData);

router.use("/interaction", jsonParser, interaction);
router.use("/masterReport", jsonParser, masterReport);

router.use("/common", jsonParser, common);

router.use("/mailConfigurations", jsonParser, mailConfiguration);

router.use("/nspFilters", jsonParser, nspFilter);
router.use("/attendance", jsonParser, attendance);

router.use("/manager", jsonParser, manager);
router.use("/template", jsonParser, template);

router.use("/caseInformation", jsonParser, caseInformation);

router.use("/otherService", jsonParser, otherService);

router.use("/reimbursement", jsonParser, reimbursement);

//SEEDER
router.use("/seeders", jsonParser, seeder);
router.use("/distanceMatrixApiDetail", jsonParser, distanceMatrixApiDetail);

router.use("/serviceDetailMaster", jsonParser, serviceDetailMaster);

router.use("/taluks", jsonParser, taluk);
router.use("/districts", jsonParser, district);
router.use("/nearestCities", jsonParser, nearestCity);
router.use("/escalationReasons", jsonParser, escalationReason);
router.use("/systemIssueReasons", jsonParser, systemIssueReason);
router.use("/distanceMatrixApiDetail", jsonParser, distanceMatrixApiDetail);

router.use("/loginStatus", jsonParser, userLoginStatus);

router.use("/dashboard", jsonParser, dashboard);
router.use("/distance", jsonParser, distance);

router.use("/latestUpdate", jsonParser, latestUpdate);

router.use("/customerFeedback", jsonParser, customerFeedback);

router.use("/buddyApp", jsonParser, buddyApp);

router.use("/serviceDescription", jsonParser, serviceDescription);

export default router;
