import { Router } from "express";
import TowSuccessReasonController from "../controllers/towSuccessReason";
const router = Router();

router.get("/getList", TowSuccessReasonController.getList);
router.post("/save", TowSuccessReasonController.saveAndUpdate);
router.put("/updateStatus", TowSuccessReasonController.updateStatus);
router.put("/delete", TowSuccessReasonController.delete);
router.get("/getFormData", TowSuccessReasonController.getFormData);
router.get("/getById", TowSuccessReasonController.getById);

//Import and Export;
router.post("/import", TowSuccessReasonController.import);
router.get("/export", TowSuccessReasonController.export);

export default router;

