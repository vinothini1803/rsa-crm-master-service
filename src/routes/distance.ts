import { Router } from "express";
import { getGoogleDistanceData } from "../controllers/distance";
const router = Router();

router.post("/getGoogleDistanceData", getGoogleDistanceData);

export default router;
