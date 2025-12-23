import { Router } from "express";
import ReminderController from "../controllers/reminder";
const router = Router();

router.get("/getFormData", ReminderController.getFormData);
router.post(
  "/reminderTimeSettingsCheck",
  ReminderController.validateReminderData
);
router.post(
  "/getReminderListSearchData",
  ReminderController.getReminderListSearchData
);

export default router;
