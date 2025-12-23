import { Router } from "express";
import vehicleModelController from "../controllers/vehicleModel";
const router = Router();

//Access the all endpoint routes;
router.get("/", vehicleModelController.getList);
router.get("/getById", vehicleModelController.getById);
router.get("/getFormData", vehicleModelController.getFormData);
router.post("/save", vehicleModelController.saveAndUpdate);
router.put("/delete", vehicleModelController.delete);
router.put("/updateStatus", vehicleModelController.updateStatus);

//Import and Export;
router.get("/vehicleModelExport", vehicleModelController.vehicleModelDataExport);
router.post("/vehicleModelImport", vehicleModelController.vehicleModelDataImport);



export default router;
