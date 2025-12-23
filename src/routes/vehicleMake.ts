import { Router } from "express";
import vehicleMakeController from "../controllers/vehicleMake";
const router = Router();

//Access the all endpoint routes;
router.get("/", vehicleMakeController.getList);
router.get("/getById", vehicleMakeController.getById);
router.get("/getFormData", vehicleMakeController.getFormData);
router.post("/save", vehicleMakeController.saveAndUpdate);
router.put("/delete", vehicleMakeController.delete);
router.put("/updateStatus", vehicleMakeController.updateStatus);

//Import and Export;
router.get("/vehicleMakeExport", vehicleMakeController.vehicleMakeDataExport);
router.post("/vehicleMakeImport", vehicleMakeController.vehicleMakeDataImport);


export default router;
