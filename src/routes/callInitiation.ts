import { Router } from "express";
import CallInitiationController from "../controllers/callInitiation";
const router = Router();

router.post("/getFormData", CallInitiationController.getFormData);
router.post(
  "/validateSave",
  CallInitiationController.validateCallInitiationSaveData
);
router.post("/getFilterData", CallInitiationController.getFilterData);
router.post(
  "/getCallInitiationList",
  CallInitiationController.getCallInitiationList
);

router.post("/getExportData", CallInitiationController.getExportData);

export default router;
