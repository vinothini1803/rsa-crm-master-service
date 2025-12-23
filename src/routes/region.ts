import { Router } from "express";
import regionController from "../controllers/region";
const router = Router();

//Access the all endpoint routes;
router.get("/", regionController.getList);
router.get("/getFormData", regionController.getFormData);
router.post("/save", regionController.saveAndUpdate);
router.post("/delete", regionController.delete);
router.post("/updateStatus", regionController.updateStatus);
router.post("/getStateBaseCountry", regionController.getStateBaseCountry);

//Import and Export;
router.get("/regionExport", regionController.regionDataExport);
router.post("/regionImport", regionController.regionDataImport);



export default router;
