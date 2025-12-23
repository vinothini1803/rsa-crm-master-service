import { Router } from "express";
import callCenterLocationController from "../controllers/callCenterLocation";
const router = Router();

router.get("/", callCenterLocationController.getList);

export default router;
