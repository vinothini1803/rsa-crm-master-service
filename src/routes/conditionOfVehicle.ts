import { Router } from "express";
import ConditionOfVehicleController from "../controllers/conditionOfVehicle";
const router = Router();

router.get("/getList", ConditionOfVehicleController.getList);
router.get("/getFormData", ConditionOfVehicleController.getFormData);
router.post("/save", ConditionOfVehicleController.saveAndUpdate);
router.put("/updateStatus", ConditionOfVehicleController.updateStatus);
router.put("/delete", ConditionOfVehicleController.delete);

router.post("/import", ConditionOfVehicleController.import);
router.get("/export", ConditionOfVehicleController.export);

export default router;
