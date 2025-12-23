import { Router } from "express";
import configTypeController from "../controllers/configType";
const router = Router();

//Access the all endpoint routes;
router.get("/", configTypeController.getList);

export default router;
