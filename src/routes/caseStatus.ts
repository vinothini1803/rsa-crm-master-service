import { Router } from "express";
import caseStatusController from "../controllers/caseStatus";
const router = Router();

//Access the all endpoint routes;
router.get("/", caseStatusController.getList);
router.get("/getFormData", caseStatusController.getFormData);
router.post("/save", caseStatusController.saveAndUpdate);
router.put("/delete", caseStatusController.delete);
router.put("/updateStatus", caseStatusController.updateStatus);
router.get("/getcaseStatusName", caseStatusController.getcaseStatusName);


//Import and Export;
router.get("/caseStatusExport", caseStatusController.caseStatusDataExport);
router.post("/caseStatusImport", caseStatusController.caseStatusDataImport);



export default router;
