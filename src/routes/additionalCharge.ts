import { Router } from "express";
import additionalCharge from "../controllers/additionalCharge";
const router = Router();

//Access the all endpoint routes;
router.get("/", additionalCharge.getList);
router.get("/getMasterData", additionalCharge.getMasterData);

export default router;
