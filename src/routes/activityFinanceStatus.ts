import { Router } from "express";
import activityFinanceStatusController from "../controllers/activityFinanceStatus";
const router = Router();

//Access the all endpoint routes;
router.get("/", activityFinanceStatusController.getList);

export default router;
