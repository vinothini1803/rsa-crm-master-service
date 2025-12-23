import { Router } from "express";
import callCenterController from "../controllers/callCenter";
const router = Router();

router.get("/", callCenterController.getList);
router.get("/getFormData", callCenterController.getFormData);
router.post("/save", callCenterController.saveAndUpdate);
router.put("/delete", callCenterController.delete);
router.put("/updateStatus", callCenterController.updateStatus);
router.post("/getCallCenterByName", callCenterController.getCallCenterByName);

//Import and Export;
router.get("/callCenterExport", callCenterController.callCenterDataExport);
router.post("/callCenterImport", callCenterController.callCenterDataImport)

export default router;
