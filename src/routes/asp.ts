import { Router } from "express";
import aspController from "../controllers/asp";
const router = Router();

//Access the all endpoint routes;
router.get("/", aspController.getList);
router.get("/getFilterData", aspController.getFilterData);
router.get("/getDetails", aspController.getAspDetails);
router.get("/getFormData", aspController.getFormData);
router.post("/save", aspController.saveAndUpdate);
router.put("/updateStatus", aspController.updateStatus);
router.put("/delete", aspController.delete);
router.get("/getViewData", aspController.getViewData);

//Import And Export;
router.get("/aspExport", aspController.aspDataExport);
router.post("/aspImport", aspController.aspDataImport);

//SYNC FROM ASP PORTAL
router.post("/sync", aspController.sync);

router.get("/getAspSubAsps", aspController.getAspSubAsps);

router.post("/captureLocation", aspController.captureLocation);

export default router;
