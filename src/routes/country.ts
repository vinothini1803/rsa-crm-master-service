import { Router } from "express";
import countryController from "../controllers/country";
const router = Router();

router.get("/", countryController.getList);

export default router;
