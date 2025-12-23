import { Router } from "express";
import ServiceDescriptionController from "../controllers/serviceDescriptionController";
const router = Router();

router.get("/getList", ServiceDescriptionController.getList);
router.get("/getFormData", ServiceDescriptionController.getFormData);
router.post("/save", ServiceDescriptionController.saveAndUpdate);
router.put("/updateStatus", ServiceDescriptionController.updateStatus);
router.put("/delete", ServiceDescriptionController.delete);

router.post("/import", ServiceDescriptionController.import);
router.get("/export", ServiceDescriptionController.export);

export default router;
