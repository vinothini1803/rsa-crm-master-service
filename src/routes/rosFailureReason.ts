import { Router } from "express";
import RosFailureReasonController from "../controllers/rosFailureReason";
const router = Router();

router.get("/getList", RosFailureReasonController.getList);
router.post("/save", RosFailureReasonController.saveAndUpdate);
router.put("/updateStatus", RosFailureReasonController.updateStatus);
router.put("/delete", RosFailureReasonController.delete);
router.get("/getFormData", RosFailureReasonController.getFormData);
router.get("/getById", RosFailureReasonController.getById);

//Import and Export;
router.post("/import", RosFailureReasonController.import);
router.get("/export", RosFailureReasonController.export);

export default router;



