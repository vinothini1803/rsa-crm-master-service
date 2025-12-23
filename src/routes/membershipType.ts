import { Router } from "express";
import membershipTypeController from "../controllers/membershipType";
const router = Router();

//Access the all endpoint routes;
router.get("/", membershipTypeController.getList);

export default router;
