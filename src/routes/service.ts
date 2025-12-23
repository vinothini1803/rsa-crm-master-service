import { Router } from "express";
import serviceController from "../controllers/service";
const router = Router();

//Access the all endpoint routes;
router.get("/", serviceController.getList);
router.get("/getFormData", serviceController.getFormData);
router.post('/get', serviceController.getServiceWithEntitlementDetails);
router.post("/save", serviceController.saveAndUpdate);
router.put("/updateStatus", serviceController.updateStatus);
router.put("/delete", serviceController.delete);

//Import and Export;
router.get("/serviceExport", serviceController.serviceDataExport);
router.post("/serviceImport", serviceController.serviceDataImport);

router.post("/getSubjectService", serviceController.getSubjectService);

export default router;
