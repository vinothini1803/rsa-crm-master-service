import { Router } from "express";
import aspMechanicController from "../controllers/aspMechanic";
import {
  validateSaveAspMechanic,
  validateAspMechanicGetById,
  validateViewAspMechanic,
  validateUpdateStatusAspMechanic,
  validateDeleteAspMechanic,
  validateCreateNewCocoTechnician,
  validateUpdateWorkStatusAspMechanic,
} from "../validations/validation";
import validate from "../middleware/validation.middleware";
const router = Router();

//Access the all endpoint routes;
router.get("/", aspMechanicController.getList);
router.get("/getDetails", aspMechanicController.getDetails);
router.get("/list", aspMechanicController.getAllAspMechanics);
router.get(
  "/view",
  validate(validateViewAspMechanic),
  aspMechanicController.getOneAspMechanic
);
router.get("/getFormData", aspMechanicController.getFormData);
router.post(
  "/save",
  // validate(validateSaveAspMechanic),
  aspMechanicController.saveAndUpdate
);
router.post(
  "/createNewCocoTechnician",
  validate(validateCreateNewCocoTechnician),
  aspMechanicController.createNewCocoTechnician
);
router.put(
  "/updateStatus",
  validate(validateUpdateStatusAspMechanic),
  aspMechanicController.updateStatus
);
router.put(
  "/delete",
  validate(validateDeleteAspMechanic),
  aspMechanicController.delete
);
router.post(
  "/getById",
  validate(validateAspMechanicGetById),
  aspMechanicController.getById
);

router.get("/getWorkStatus", aspMechanicController.getWorkStatus);
router.put(
  "/updateWorkStatus",
  validate(validateUpdateWorkStatusAspMechanic),
  aspMechanicController.updateWorkStatus
);

//Import And Export;

router.post("/import", aspMechanicController.import);
router.get("/export", aspMechanicController.export);

router.post("/saveAspsDriver", aspMechanicController.saveAspsDriver);

export default router;
