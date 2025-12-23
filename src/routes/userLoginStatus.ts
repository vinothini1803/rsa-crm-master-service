import { Router } from "express";
import {
  getUserLoginStatus,
  getUserStatus,
} from "../controllers/userLoginStatus";
const router = Router();

router.get("/getUserLoginStatus", getUserLoginStatus);
router.post("/getUserStatus", getUserStatus);

export default router;
