import { Router } from "express";
import caseInformationController from "../controllers/caseInformation";
const router = Router();

//Access the all endpoint routes;
router.post(
  "/getCaseCreateMasterDetails",
  caseInformationController.getCaseCreateMasterDetails
);

export default router;
