import { Router } from "express";
import CaseDataController from "../controllers/caseDataController";
const router = Router();

//Access the all endpoint routes;
router.get("/", CaseDataController.getData);
router.get("/attachementData", CaseDataController.getAttachementInfo);
router.get(
  "/additionalChargeAttachmentData",
  CaseDataController.getAdditionalChargeAttachmentInfo
);
router.post("/getRsaFormData", CaseDataController.getRsaFormData);
router.post("/getCase", CaseDataController.getCaseList);
router.post("/getCaseInformation", CaseDataController.getCaseInformation);
router.get(
  "/getAdditionalServiceRequestFormData",
  CaseDataController.getAdditionalServiceRequestFormData
);

router.post(
  "/caseInformationRequestMasterData",
  CaseDataController.caseInformationRequestMasterData
);
router.post("/caseRequestMasterData", CaseDataController.caseRequestMasterData);

router.post(
  "/overAllMapCaseViewMasterDetail",
  CaseDataController.overAllMapCaseViewMasterDetail
);

router.post(
  "/policyDetailUpdateFormData",
  CaseDataController.policyDetailUpdateFormData
);

router.get(
  "/vehicleDeliveryFormValidation",
  CaseDataController.vehicleDeliveryFormValidation
);

router.post(
  "/getMembershipAndVehicleData",
  CaseDataController.getMembershipAndVehicleData
);

router.post("/getVehicleData", CaseDataController.getVehicleData);

router.post("/crmListSearchData", CaseDataController.crmListSearchData);
router.post("/crmListFilterData", CaseDataController.crmListFilterData);

router.post(
  "/lorryReceiptMasterDetail",
  CaseDataController.lorryReceiptMasterDetail
);

export default router;
