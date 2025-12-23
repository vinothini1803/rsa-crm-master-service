import { Router } from "express";
import latestUpdateController from "../controllers/latestUpdate";
const router = Router();

router.post("/syncFromAspPortal", latestUpdateController.syncFromAspPortal);
router.post("/deleteFromAspPortal", latestUpdateController.deleteFromAspPortal);
router.post("/getLatestUpdate", latestUpdateController.getLatestUpdate);

export default router;
