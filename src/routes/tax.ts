import { Router } from "express";
import tax from "../controllers/tax";
const router = Router();

router.get("/getData", tax.getData);

export default router;
