import { Router } from "express";
import cityController from "../controllers/city";
const router = Router();

//Access the all endpoint routes;
router.get("/", cityController.getList);
router.get("/getFormData", cityController.getFormData);
router.post("/save", cityController.saveAndUpdate);
router.post("/delete", cityController.delete);
router.post("/updateStatus", cityController.updateStatus);
router.post("/getStateBaseCountry", cityController.getStateBaseCountry);
router.post("/getCityData", cityController.getCityData);

//Import and Export;
router.get("/cityExport", cityController.cityDataExport);
router.post("/cityImport", cityController.cityDataImport);

router.post("/getById", cityController.getById);
router.post("/getByGoogleDetail", cityController.getByGoogleDetail);

router.post("/getByGoogleDetail", cityController.getByGoogleDetail);

export default router;
