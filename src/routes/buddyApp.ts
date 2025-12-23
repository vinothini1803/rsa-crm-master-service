import { Router } from "express";
import aspMechanicController from "../controllers/aspMechanic";
import validate from "../middleware/validation.middleware";
import { validateUpdateWorkStatusAspMechanic } from "../validations/validation";

const router = Router();

// BUDDY APP ROUTES
router.get("/getWorkStatus", aspMechanicController.getWorkStatus);
router.put("/updateWorkStatus", validate(validateUpdateWorkStatusAspMechanic), aspMechanicController.updateWorkStatus);

export default router;