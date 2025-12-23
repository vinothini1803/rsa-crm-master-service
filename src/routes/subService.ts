import { Router } from "express";
import subServiceController from "../controllers/subService";
const router = Router();

//Access the all endpoint routes;
router.get("/", subServiceController.getList);
router.get("/getFormData", subServiceController.getFormData);
router.post("/save", subServiceController.saveAndUpdate);
router.put("/updateStatus", subServiceController.updateStatus);
router.put("/delete", subServiceController.delete);

//Import and Export;
router.get("/subServiceExport", subServiceController.subServiceDataExport);
router.post("/subServiceImport", subServiceController.subServiceDataImport);
router.post("/getSubjectSubService", subServiceController.getSubjectSubService);

router.post(
  "/get/service/subServices",
  subServiceController.getServiceSubServices
);

router.post("/getEntitlements", subServiceController.getEntitlements);

export default router;
