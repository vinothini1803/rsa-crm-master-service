import { Router } from "express";
import ownPatrolVehicleController from "../controllers/ownPatrolVehicle";
const router = Router();

router.get("/getList", ownPatrolVehicleController.getList);
router.get("/getFormData", ownPatrolVehicleController.getFormData);
router.post("/save", ownPatrolVehicleController.saveAndUpdate);
router.put("/updateStatus", ownPatrolVehicleController.updateStatus);
router.put("/delete", ownPatrolVehicleController.delete);
router.post("/getByIds", ownPatrolVehicleController.getByIds);
router.post("/getAspIdsByServiceOrganisationIds", ownPatrolVehicleController.getAspIdsByServiceOrganisationIds);
router.get("/getViewData", ownPatrolVehicleController.getViewData);

//Import And Export;
router.post("/import", ownPatrolVehicleController.import);
router.get("/export", ownPatrolVehicleController.export);

export default router;
