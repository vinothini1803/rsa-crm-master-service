import { Router } from "express";
import DispositionController from "../controllers/disposition";
const router = Router();

router.get("/getList", DispositionController.getList);
router.get("/getFormData", DispositionController.getFormData);
router.post("/save", DispositionController.saveAndUpdate);
router.put("/updateStatus", DispositionController.updateStatus);
router.put("/delete", DispositionController.delete);

router.post("/import", DispositionController.import);
router.get("/export", DispositionController.export);

export default router;
