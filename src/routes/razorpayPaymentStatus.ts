import { Router } from "express";
import razorpayPaymentStatusController from "../controllers/razorpayPaymentStatus";
const router = Router();

//Access the all endpoint routes;
router.get("/", razorpayPaymentStatusController.getList);

export default router;
