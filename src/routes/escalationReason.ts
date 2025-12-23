import { Router } from "express";
import escalationReasonController from "../controllers/escalationReason";
const router = Router();

//Access the all endpoint routes;
router.get("/", escalationReasonController.getList);
router.get("/getFormData", escalationReasonController.getFormData);
router.post("/save", escalationReasonController.saveAndUpdate);
router.post("/delete", escalationReasonController.delete);
router.post("/updateStatus", escalationReasonController.updateStatus);

router.post("/import", escalationReasonController.import);
router.get("/export", escalationReasonController.export);

export default router;
