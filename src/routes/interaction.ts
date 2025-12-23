import { Router } from "express";
import interactionController from "../controllers/interaction";
const router = Router();

router.get("/getFormData", interactionController.getFormData);

export default router;
