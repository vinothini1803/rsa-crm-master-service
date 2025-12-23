import { Router } from "express";
import aspDataController from "../controllers/aspDataController";
import bodyParser from "body-parser";

const jsonParser = bodyParser.json({ limit: "50mb" });
const router = Router();

//Access the all endpoint routes;
router.post("/", aspDataController.getDataList);
router.get("/", aspDataController.fetchDataList);
router.post("/buddyApp", aspDataController.getDataListBuddyApp);
router.post("/buddyApp/detail", aspDataController.fetchDataListBuddyApp);
router.get("/searchMasterData", aspDataController.searchMasterData);
router.get("/getServiceDetail", aspDataController.getServiceDetail);
router.get("/getLocs", aspDataController.getNspLocs); //get nearest service provider pickup & drop locations
router.post("/getLocations", aspDataController.getNspLocationsForCrm); //get nearest service provider pickup & drop locations for CRM

//CASE LIST GET DATA
router.get("/getData", aspDataController.getCaseData);
router.get("/getData/caseInfo", aspDataController.getCaseInfoData);
router.get("/getCaseSubServiceData", aspDataController.getCaseSubServiceData);

//GET MASTER DETAILS DATA
router.post("/getMasterDetail", jsonParser, aspDataController.getMasterDetail);

router.post("/aspOverAllMapView", aspDataController.aspOverAllMapView);

router.post(
  "/technicianOverAllMapView",
  aspDataController.technicianOverAllMapView
);

router.post(
  "/getOverAllMapViewAspMechanics",
  aspDataController.getOverAllMapViewAspMechanics
);

router.get(
  "/getCaseSubServiceGridData",
  aspDataController.getCaseSubServiceGridData
);

router.get("/getCaseInfoGridData", aspDataController.getCaseInfoGridData);

router.post(
  "/getCaseSubServiceListFilterData",
  aspDataController.getCaseSubServiceListFilterData
);

router.post("/getCaseListFilterData", aspDataController.getCaseListFilterData);

router.post(
  "/getReimbursementListFilterData",
  aspDataController.getReimbursementListFilterData
);

router.post("/mapView/filterData", aspDataController.getMapViewFilterData);

export default router;
