import { Router } from "express";
import otherServiceController from "../controllers/otherService";
const router = Router();

//Access the all endpoint routes;
router.post("/getMasterDetails", otherServiceController.getMasterDetails);

export default router;
