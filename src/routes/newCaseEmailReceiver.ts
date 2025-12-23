import { Router } from "express";
import newCaseEmailReceiverController from "../controllers/newCaseEmailReceiver";
const router = Router();

router.get("/", newCaseEmailReceiverController.getList);

export default router;
