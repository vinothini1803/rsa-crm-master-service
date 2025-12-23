import { Router } from "express";
import configController from "../controllers/config";
const router = Router();

//Access the all endpoint routes;
router.get("/", configController.getList);
router.get("/getById", configController.getConfigById);
router.get("/getByName", configController.getConfigByName);
router.post("/checkConfigExists", configController.checkIfConfigExists);

export default router;
