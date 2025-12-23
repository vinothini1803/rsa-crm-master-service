import { Router } from "express";
import systemIssueReasonController from "../controllers/systemIssueReason";
const router = Router();

//Access the all endpoint routes;
router.get("/", systemIssueReasonController.getList);
router.get("/getFormData", systemIssueReasonController.getFormData);
router.post("/save", systemIssueReasonController.saveAndUpdate);
router.post("/delete", systemIssueReasonController.delete);
router.post("/updateStatus", systemIssueReasonController.updateStatus);

router.post("/import", systemIssueReasonController.import);
router.get("/export", systemIssueReasonController.export);

export default router;
