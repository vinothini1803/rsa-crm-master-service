import { Router } from "express";
import OwnPatrolVehicleHelperController from "../controllers/ownPatrolVehicleHelper";
const router = Router();

router.get("/", OwnPatrolVehicleHelperController.getList);
router.get("/getFormData", OwnPatrolVehicleHelperController.getFormData);
router.post("/save", OwnPatrolVehicleHelperController.saveAndUpdate);
router.get("/getById", OwnPatrolVehicleHelperController.getById);
router.get("/getViewData", OwnPatrolVehicleHelperController.getViewData);
router.put("/updateStatus", OwnPatrolVehicleHelperController.updateStatus);
router.put("/delete", OwnPatrolVehicleHelperController.delete);

router.post("/import", OwnPatrolVehicleHelperController.import);
router.get("/export", OwnPatrolVehicleHelperController.export);

export default router;
