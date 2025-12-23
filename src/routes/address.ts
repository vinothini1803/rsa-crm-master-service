import { Router } from "express";
import addressController from "../controllers/address";
const router = Router();

//Access the all endpoint routes;
router.get("/", addressController.getList);

export default router;
