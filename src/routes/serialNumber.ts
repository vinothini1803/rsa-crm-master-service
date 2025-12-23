import { Router } from "express";
import serialNumberController from "../controllers/serialNumber";
const router = Router();

router.get(
  "/generateCaseSerialNumber",
  serialNumberController.generateCaseSerialNumber
);
router.get(
  "/generateGenericSerialNumber",
  serialNumberController.generateGenericSerialNumber
);

export default router;
