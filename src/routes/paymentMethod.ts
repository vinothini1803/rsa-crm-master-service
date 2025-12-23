import { Router } from "express";
import paymentMethodController from "../controllers/paymentMethod";
const router = Router();

//Access the all endpoint routes;
router.get("/", paymentMethodController.getList);

export default router;
