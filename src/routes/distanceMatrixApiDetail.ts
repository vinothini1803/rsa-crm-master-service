import { Router } from "express";
import distanceMatrixApiDetailController from "../controllers/distanceMatrixApiDetail";
const router = Router();

//Access the all endpoint routes;
router.post("/delete", distanceMatrixApiDetailController.delete);

export default router;
