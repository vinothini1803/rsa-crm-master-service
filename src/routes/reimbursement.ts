import { Router } from "express";
import reimbursementController from "../controllers/reimbursement";
const router = Router();

//Access the all endpoint routes;
router.get("/getStatusList", reimbursementController.getStatusList);
router.get("/getListMasterData", reimbursementController.getListMasterData);

export default router;
