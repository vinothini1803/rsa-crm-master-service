import { Router } from "express";
import customerFeedbackController from "../controllers/customerFeedback";
const router = Router();

router.get("/getFormData", customerFeedbackController.getFormData);
router.get("/getQuestionsByCallStatus", customerFeedbackController.getQuestionsByCallStatus);

export default router;

