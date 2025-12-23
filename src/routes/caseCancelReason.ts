import { Router } from "express";
import caseCancelReasonController from "../controllers/caseCancelReason";
const router = Router();

//Access the all endpoint routes;
router.get("/", caseCancelReasonController.getList);

router.get("/getFormData", caseCancelReasonController.getFormData);
router.post("/save", caseCancelReasonController.saveAndUpdate);
router.post("/delete", caseCancelReasonController.delete);
router.post("/updateStatus", caseCancelReasonController.updateStatus);

router.post("/import", caseCancelReasonController.import);
router.get("/export", caseCancelReasonController.export);

export default router;
