import { Router } from "express";
import stateController from "../controllers/state";
const router = Router();

//Access the all endpoint routes;
router.get("/", stateController.getList);
router.get("/getFormData", stateController.getFormData);
router.post("/save", stateController.saveAndUpdate);
router.post("/delete", stateController.delete);
router.post("/updateStatus", stateController.updateStatus);
router.post("/getByGoogleMapCode", stateController.getByGoogleMapCode);
router.post("/getByName", stateController.getByName);

//Import and Export;
router.get("/stateExport", stateController.stateDataExport);
router.post("/stateImport", stateController.stateDataImport);

export default router;
