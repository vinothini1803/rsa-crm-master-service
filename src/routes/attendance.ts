import { Router } from "express";
import attendanceController from "../controllers/attendance";
import { validateAttendanceShift } from "../validations/validation";
import validate from "../middleware/validation.middleware";
const router = Router();

//Access the all endpoint routes;
router.post("/formData", attendanceController.formData);
router.post(
  "/getOwnPatrolVehicles",
  attendanceController.getOwnPatrolVehicleFn
);
router.post(
  "/getCocoVehicles",
  attendanceController.getCocoVehicles
);
router.post(
  "/validateShift",
  validate(validateAttendanceShift),
  attendanceController.validateShift
);
// router.post("/updateMechanicAsp", attendanceController.updateMechanicAsp);
router.post("/updateVehicle", attendanceController.updateVehicle);
router.post(
  "/validate/vehicleChange",
  attendanceController.validateVehicleChange
);
// router.post("/removeMechanicAsp", attendanceController.removeMechanicAsp);
router.post("/removeVehicle", attendanceController.removeVehicle);
router.post(
  "/checkVehicleAlreadyExist",
  attendanceController.checkVehicleAlreadyExist
);
router.post("/getMasterDetails", attendanceController.getMasterDetails);

export default router;
