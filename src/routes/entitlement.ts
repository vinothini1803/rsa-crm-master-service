import { Router } from "express";
import entitlementController from "../controllers/entitlement";
const router = Router();

//Access the all endpoint routes;
router.get("/", entitlementController.getList);
router.get("/getFormData", entitlementController.getFormData);
router.post("/save", entitlementController.saveAndUpdate);
router.post("/delete", entitlementController.delete);
router.post("/updateStatus", entitlementController.updateStatus);

router.post("/import", entitlementController.import);
router.get("/export", entitlementController.export);
export default router;
