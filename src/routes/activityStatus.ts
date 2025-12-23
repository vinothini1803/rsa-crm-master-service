import { Router } from "express";
import activityStatusController from "../controllers/activityStatus";
const router = Router();

//Access the all endpoint routes;
router.get("/", activityStatusController.getList);
router.get(
  "/getOtherServiceStatuses",
  activityStatusController.getOtherServiceStatuses
);

export default router;
