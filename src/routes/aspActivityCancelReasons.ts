import { Router } from "express";
import aspActivityCancelReasonController from "../controllers/aspActivityCancelReasons";
const router = Router();

//Access the all endpoint routes;
router.get("/", aspActivityCancelReasonController.getList);

router.get("/getFormData", aspActivityCancelReasonController.getFormData);
router.post("/save", aspActivityCancelReasonController.saveAndUpdate);
router.post("/delete", aspActivityCancelReasonController.delete);
router.post("/updateStatus", aspActivityCancelReasonController.updateStatus);

router.post("/import", aspActivityCancelReasonController.import);
router.get("/export", aspActivityCancelReasonController.export);

export default router;
