import { Router } from "express";
import aspActivityRejectReasonController from "../controllers/aspActivityRejectReason";
const router = Router();

//Access the all endpoint routes;
router.get("/", aspActivityRejectReasonController.getList);
router.get("/getFormData", aspActivityRejectReasonController.getFormData);
router.post("/save", aspActivityRejectReasonController.saveAndUpdate);
router.put("/delete", aspActivityRejectReasonController.delete);
router.put("/updateStatus", aspActivityRejectReasonController.updateStatus);

router.get("/getById", aspActivityRejectReasonController.getById);

//Import and Export;
router.get(
  "/aspActivityRejectReasonExport",
  aspActivityRejectReasonController.aspActivityRejectReasonExport
);
router.post(
  "/aspActivityRejectReasonImport",
  aspActivityRejectReasonController.aspActivityRejectReasonImport
);

export default router;
