import { Router } from "express";
import clientController from "../controllers/client";
const router = Router();

//Access the all endpoint routes;
router.get("/", clientController.getList);
router.get("/getFormData", clientController.getFormData);
router.get("/getViewData", clientController.getViewData);
router.post("/save", clientController.saveAndUpdate);
router.post("/delete", clientController.delete);
router.post("/updateStatus", clientController.updateStatus);
router.get("/getDetail", clientController.getDetail);
router.post("/getClientDetail", clientController.getClientDetail);
router.post(
  "/getClientServiceEntitlementDetails",
  clientController.getClientServiceEntitlementDetails
);
router.post("/getUserClients", clientController.getUserClients);
router.post("/getClientDetailByDid", clientController.getClientDetailByDid);

//Import and Export;
router.get("/export", clientController.clientDataExport);
router.post("/import", clientController.clientDataImport);

router.post(
  "/getClientServiceEntitlements",
  clientController.getClientServiceEntitlements
);

router.post(
  "/serviceEntitlement/import",
  clientController.serviceEntitlementImport
);

router.get(
  "/serviceEntitlement/export",
  clientController.serviceEntitlementExport
);

router.post("/entitlement/import", clientController.entitlementImport);
router.get("/entitlement/export", clientController.entitlementExport);
export default router;
