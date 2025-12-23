import { Router } from "express";
import answerTypeController from "../controllers/answerType";
const router = Router();

//Access the all endpoint routes;
router.get("/", answerTypeController.getList);
router.get("/getFormData", answerTypeController.getFormData);
router.post("/save", answerTypeController.saveAndUpdate);
router.post("/delete", answerTypeController.delete);
router.post("/updateStatus", answerTypeController.updateStatus);

export default router;

