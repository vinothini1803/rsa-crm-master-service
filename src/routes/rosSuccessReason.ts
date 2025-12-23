import { Router } from "express";
import RosSuccessReasonController from "../controllers/rosSuccessReason";
const router = Router();

router.get("/getList", RosSuccessReasonController.getList);
router.post("/save", RosSuccessReasonController.saveAndUpdate);
router.put("/updateStatus", RosSuccessReasonController.updateStatus);
router.put("/delete", RosSuccessReasonController.delete);
router.get("/getFormData", RosSuccessReasonController.getFormData);
router.get("/getById", RosSuccessReasonController.getById);

//Import and Export;
router.post("/import", RosSuccessReasonController.import);
router.get("/export", RosSuccessReasonController.export);

export default router;

