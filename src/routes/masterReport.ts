import { Router } from "express";
import masterReport from "../controllers/masterReport";
const router = Router();

//Access the all endpoint routes;
router.post("/", masterReport.masterReporting);

export default router;
