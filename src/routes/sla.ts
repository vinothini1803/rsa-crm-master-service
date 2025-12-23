import { Router } from "express";
import slaController from "../controllers/slaController";
const router = Router();

router.get("/getList", slaController.getList);
router.get("/getFormData", slaController.getFormData);
router.get("/getById", slaController.getFormDataById);
router.post("/save", slaController.saveAndUpdate);
router.post("/updateStatus", slaController.updateStatus);
router.post("/delete", slaController.delete);

router.post("/checkSla", slaController.checkSla);
router.get("/getSlaSettings", slaController.getSlaSettings);
router.post("/getByCaseTypeAndTypeId", slaController.getByCaseTypeAndTypeId);

//Import and Export;
router.post("/import", slaController.import);
router.get("/export", slaController.export);

export default router;
