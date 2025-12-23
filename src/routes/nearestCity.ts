import { Router } from "express";
import nearestCityController from "../controllers/nearestCity";
const router = Router();

//Access the all endpoint routes;
router.get("/", nearestCityController.getList);
router.get("/getFormData", nearestCityController.getFormData);
router.post("/save", nearestCityController.saveAndUpdate);
router.post("/delete", nearestCityController.delete);
router.post("/updateStatus", nearestCityController.updateStatus);

router.post("/import", nearestCityController.import);
router.get("/export", nearestCityController.export);

export default router;
