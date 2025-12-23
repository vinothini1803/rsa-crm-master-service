import { Router } from "express";
import commonController from "../controllers/common";
const router = Router();

//Access the all endpoint routes;
router.post("/getMasterDetails", commonController.getMasterDetails);
router.post("/getCitiesByRole", commonController.getCitiesByRole);
router.post("/getCallCentersByRole", commonController.getCallCentersByRole);
router.post("/getClientsByRole", commonController.getClientsByRole);

export default router;
