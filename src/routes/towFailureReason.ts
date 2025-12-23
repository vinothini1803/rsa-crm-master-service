import { Router } from "express";
import TowFailureReasonController from "../controllers/towFailureReason";
const router = Router();

router.get("/getList", TowFailureReasonController.getList);
router.post("/save", TowFailureReasonController.saveAndUpdate);
router.put("/updateStatus", TowFailureReasonController.updateStatus);
router.put("/delete", TowFailureReasonController.delete);
router.get("/getFormData", TowFailureReasonController.getFormData);
router.get("/getById", TowFailureReasonController.getById);

//Import and Export;
router.post("/import", TowFailureReasonController.import);
router.get("/export", TowFailureReasonController.export);

export default router;

