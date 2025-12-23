import { Router } from "express";
import mailConfigurationController from "../controllers/mailConfiguration";
const router = Router();

//Access the all endpoint routes;
router.post("/getById", mailConfigurationController.getById);

export default router;
