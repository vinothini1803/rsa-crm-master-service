import { Router } from "express";
import manualLocationReasonController from "../controllers/manualLocationReason";
const router = Router();

//Access the all endpoint routes;
router.get("/", manualLocationReasonController.getList);
router.get("/getFormData", manualLocationReasonController.getFormData);
router.post("/save", manualLocationReasonController.saveAndUpdate);
router.put("/delete", manualLocationReasonController.delete);
router.put("/updateStatus", manualLocationReasonController.updateStatus);

//Import and Export;
router.get("/export", manualLocationReasonController.export);
router.post("/import", manualLocationReasonController.import);

export default router;
