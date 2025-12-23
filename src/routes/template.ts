import { Router } from "express";
import templateController from "../controllers/template";
const router = Router();

//Access the all endpoint routes;
router.post("/getMasterDetails", templateController.getMasterDetails);
router.post("/getFormDataDetails", templateController.getFormDataDetails);
router.post("/getSeederDetails", templateController.getSeederDetails);

export default router;
