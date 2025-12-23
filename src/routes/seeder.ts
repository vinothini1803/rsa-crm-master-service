import { Router } from "express";
import seederController from "../controllers/seeder";
const router = Router();

//Access the all endpoint routes;
router.get("/", seederController.seed);
router.get("/serialNumber", seederController.serialNumberSeeder);
router.get("/configTypeConfig", seederController.configTypeConfigSeeder);
router.get("/aspDataUpdation", seederController.aspDataUpdationSeeder);
router.get("/dealerDataUpdation", seederController.dealerDataUpdationSeeder);
router.get("/aspMechanicUpdation", seederController.aspMechanicUpdationSeeder);
router.get("/mailConfiguration", seederController.mailConfigurationSeeder);
router.get("/disposition", seederController.dispositionSeeder);
router.get("/language", seederController.languageSeeder);
router.get("/service", seederController.serviceSeeder);
router.get("/subService", seederController.subServiceSeeder);
router.get("/conditionOfVehicle", seederController.conditionOfVehicleSeeder);
router.get("/policyPremium", seederController.policyPremiumSeeder);
router.get(
  "/manualLocationReason",
  seederController.manualLocationReasonSeeder
);
router.get("/caseCancelReason", seederController.caseCancelReasonSeeder);
router.get("/vehicleType", seederController.vehicleTypeSeeder);
router.get("/vehicleMake", seederController.vehicleMakeSeeder);
router.get("/vehicleModel", seederController.vehicleModelSeeder);
router.get("/caseSubject", seederController.caseSubjectSeeder);
router.get("/entitlement", seederController.entitlementSeeder);
router.get("/nspFilter", seederController.nspFilterSeeder);

router.get("/taluk", seederController.talukSeeder);
router.get("/district", seederController.districtSeeder);
router.get("/nearestCity", seederController.nearestCitySeeder);
router.get("/cityUpdation", seederController.cityUpdationSeeder);

router.get("/shiftUpdation", seederController.shiftUpdationSeeder);
router.get("/serviceOrganization", seederController.serviceOrganizationSeeder);
router.get("/vdm/ownPatrolAsp", seederController.vdmOwnPatrolAspSeeder);
router.get("/ownPatrolVehicle", seederController.ownPatrolVehicleSeeder);
router.get(
  "/ownPatrolVehicleHelper",
  seederController.ownPatrolVehicleHelperSeeder
);
router.get("/aspMechanics", seederController.aspMechanicSeeder);
router.get(
  "/aspMechanicSubService",
  seederController.aspMechanicSubServiceSeeder
);

router.get("/financialYear", seederController.financialYearSeeder);
router.get(
  "/genericSerialNumberCategory",
  seederController.genericSerialNumberCategorySeeder
);
router.get("/dropDealer", seederController.dropDealerSeeder);
router.get("/escalationReason", seederController.escalationReasonSeeder);
router.get("/systemIssueReason", seederController.systemIssueReasonSeeder);

router.get("/fuelType", seederController.fuelTypeSeeder);

router.get("/importConfiguration", seederController.importConfigurationSeeder);

router.get("/uatAsp", seederController.uatAspSeeder);
router.get("/uatDealer", seederController.uatDealerSeeder);

router.get("/company", seederController.companySeeder);
router.get("/customerFeedback", seederController.customerFeedbackSeeder);

export default router;
