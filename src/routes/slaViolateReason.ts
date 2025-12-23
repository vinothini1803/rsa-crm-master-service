import { Router } from "express";
import SlaViolationReasonController from "../controllers/slaViolateReason";
const router = Router();

router.get("/getList", SlaViolationReasonController.getList);
router.post("/save", SlaViolationReasonController.saveAndUpdate);
router.put("/updateStatus", SlaViolationReasonController.updateStatus);
router.put("/delete", SlaViolationReasonController.delete);
router.get("/getFormData", SlaViolationReasonController.getFormData);
router.get("/getById", SlaViolationReasonController.getById);

//Import and Export;
router.post("/import", SlaViolationReasonController.import);
router.get("/export", SlaViolationReasonController.export);

export default router;
