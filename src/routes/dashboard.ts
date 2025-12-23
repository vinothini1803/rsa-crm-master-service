import { Router } from "express";
import dashboardController from "../controllers/dashboard";
const router = Router();

//Access the all endpoint routes;
router.post(
  "/getAgentOnGoingCaseMasterDetails",
  dashboardController.getAgentOnGoingCaseMasterDetails
);

router.post(
  "/getAgentServiceCountMasterDetails",
  dashboardController.getAgentServiceCountMasterDetails
);

export default router;
