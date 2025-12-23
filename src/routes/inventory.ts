import { Router } from "express";
import inventoryController from "../controllers/inventory";
const router = Router();

router.get("/", inventoryController.getList);

export default router;
