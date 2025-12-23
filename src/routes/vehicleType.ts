import { Router } from "express";
import vehicleTypeController from "../controllers/vehicleType";
const router = Router();

//Access the all endpoint routes;
router.get("/", vehicleTypeController.getList);
router.get("/getFormData", vehicleTypeController.getFormData);
router.post("/save", vehicleTypeController.saveAndUpdate);
router.post("/delete", vehicleTypeController.delete);
router.post("/updateStatus", vehicleTypeController.updateStatus);

//Import and Export;
router.get("/vehicleTypeExport", vehicleTypeController.vehicleTypeDataExport);
router.post("/vehicleTypeImport", vehicleTypeController.vehicleTypeDataImport);





export default router;
