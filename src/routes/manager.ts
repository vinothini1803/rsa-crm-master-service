import { Router } from "express";
import managerController from "../controllers/manager";
import { validateManagerUpdateCocoAssetStatus } from "../validations/validation";
import validate from "../middleware/validation.middleware";
const router = Router();

//Access the all endpoint routes;
router.post("/getTechnicians", managerController.getTechnicians);
router.post(
  "/getAttendanceMasterDetails",
  managerController.getAttendanceMasterDetails
);
router.post("/getCocoAssets", managerController.getCocoAssets);
router.post("/getCocoAssetView", managerController.getCocoAssetView);
router.post(
  "/updateCocoAssetStatus",
  validate(validateManagerUpdateCocoAssetStatus),
  managerController.updateCocoAssetStatus
);

router.post(
  "/cocoAssetActiveReminder",
  managerController.cocoAssetActiveReminder
);
router.post("/getCaseList", managerController.getCaseList);
router.post("/getCaseListView", managerController.getCaseListView);
router.post("/getAspPerformanceList", managerController.getAspPerformanceList);
router.post(
  "/getClientPerformanceCount",
  managerController.getClientPerformanceCount
);
router.post("/getAspByAspTypeAndRm", managerController.getAspByAspTypeAndRm);
router.post(
  "/getAspMechanicMasterDetail",
  managerController.getAspMechanicMasterDetail
);
router.post("/getNetworkCount", managerController.getNetworkCount);

router.post(
  "/getStateWiseAspSlaPerformanceList",
  managerController.getStateWiseAspSlaPerformanceList
);

router.post(
  "/getAspSlaPerformanceList",
  managerController.getAspSlaPerformanceList
);

router.post(
  "/getAspSlaPerformanceListView",
  managerController.getAspSlaPerformanceListView
);

router.post(
  "/getServicePerformanceCount",
  managerController.getServicePerformanceCount
);

router.post("/getMasterDetails", managerController.getMasterDetails);

router.post("/interactionList", managerController.interactionList);

export default router;
