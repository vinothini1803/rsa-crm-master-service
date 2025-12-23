import { Router } from "express";
import languageController from "../controllers/language";
const router = Router();

router.get("/", languageController.getList);
router.get("/getFormData", languageController.getFormData);
router.post("/save", languageController.saveAndUpdate);
router.post("/delete", languageController.delete);
router.post("/updateStatus", languageController.updateStatus);

//Import and Export;
router.get("/languageExport", languageController.languageDataExport);
router.post("/languageImport", languageController.languageDataImport);

export default router;
