import { Router } from "express";
import nspFilterController from "../controllers/nspFilter";
const router = Router();

//Access the all endpoint routes;
router.get("/getByTypeId", nspFilterController.getByTypeId);

export default router;
