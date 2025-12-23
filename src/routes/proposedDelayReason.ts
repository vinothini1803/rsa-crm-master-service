import { Router } from "express";
import ProposedDelayReasonController from "../controllers/proposedDelayReasonController";
const router = Router();

router.get("/getList", ProposedDelayReasonController.getList);
router.post("/save", ProposedDelayReasonController.saveAndUpdate);
router.put("/updateStatus", ProposedDelayReasonController.updateStatus);
router.put("/delete", ProposedDelayReasonController.delete);
router.get("/getFormData", ProposedDelayReasonController.getFormData);

//Import and Export;
router.post("/import", ProposedDelayReasonController.import);
router.get("/export", ProposedDelayReasonController.export);

export default router;

