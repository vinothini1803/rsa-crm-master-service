import { Router } from "express";
import caseSubjectController from "../controllers/caseSubject";
const router = Router();

//Access the all endpoint routes;
router.get("/", caseSubjectController.getList);
router.get("/getFormData", caseSubjectController.getFormData);
router.post("/save", caseSubjectController.saveAndUpdate);
router.post("/delete", caseSubjectController.delete);
router.post("/updateStatus", caseSubjectController.updateStatus);
router.get("/getcaseSubjectName", caseSubjectController.getcaseSubject);
router.get("/getQuestionnairesByCaseSubjectId", caseSubjectController.getQuestionnairesByCaseSubjectId);


//Import and Export;
router.get("/caseSubjectExport", caseSubjectController.caseSubjectDataExport);
router.post("/caseSubjectImport", caseSubjectController.caseSubjectDataImport);

//Questionnaire Import and Export;
router.get("/caseSubjectQuestionnaireExport", caseSubjectController.caseSubjectQuestionnaireExport);
router.post("/caseSubjectQuestionnaireImport", caseSubjectController.caseSubjectQuestionnaireImport);


export default router;
