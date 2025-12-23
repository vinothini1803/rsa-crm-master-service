import { Router } from "express";
import MilestoneController from "../controllers/milestone";
const router = Router();

router.get("/getList", MilestoneController.getList);
router.post("/save", MilestoneController.save);
router.put('/updateStatus', MilestoneController.updateStatus);
router.put("/delete", MilestoneController.delete);
router.post("/getMilestoneAgainstCaseActivity", MilestoneController.getMilestoneAgainstCaseActivity);
export default router;