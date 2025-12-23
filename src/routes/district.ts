import { Router } from "express";
import districtController from "../controllers/district";
const router = Router();

//Access the all endpoint routes;
router.get("/", districtController.getList);
router.get("/getFormData", districtController.getFormData);
router.post("/save", districtController.saveAndUpdate);
router.post("/delete", districtController.delete);
router.post("/updateStatus", districtController.updateStatus);

router.post("/import", districtController.import);
router.get("/export", districtController.export);

export default router;
