import { Router } from "express";
import  serviceDetailMasterController from "../controllers/serviceDetailMaster";
const router = Router();

router.post("/", serviceDetailMasterController.getServiceDetailMaster);

export default router;