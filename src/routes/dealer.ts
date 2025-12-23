import { Router } from "express";
import dealerController from "../controllers/dealer";
const router = Router();

//Access the all endpoint routes;
router.get("/", dealerController.getList);
router.get("/getFilterData", dealerController.getFilterData);
router.get("/getDealerDetail", dealerController.getDealerDetail);
router.get("/getDealerDetailByCode", dealerController.getDealerDetailByCode);
router.get(
  "/getPickupAndDropDealerDetail",
  dealerController.getPickupAndDropDealerDetail
);
router.get("/getViewData", dealerController.getViewData);
router.get("/getFormData", dealerController.getFormData);
router.post("/save", dealerController.saveAndUpdate);
router.put("/updateStatus", dealerController.updateStatus);
router.put("/delete", dealerController.delete);

//Import and Export;
router.get("/dealerExport", dealerController.dealerDataExport);
router.post("/dealerImport", dealerController.dealerDataImport);

router.post(
  "/getNearestDealersByLocation",
  dealerController.getNearestDealersByLocation
);
router.post(
  "/getDealerDistanceForBdLocation",
  dealerController.getDealerDistanceForBdLocation
);
router.post("/getByGroupCode", dealerController.getByGroupCode);
router.post(
  "/getDealerByFinanceAdminUser",
  dealerController.getDealerByFinanceAdminUser
);

export default router;
