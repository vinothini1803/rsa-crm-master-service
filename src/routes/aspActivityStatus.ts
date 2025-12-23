import { Router } from "express";
import aspActivityStatusController from "../controllers/aspActivityStatus";
const router = Router();

//Access the all endpoint routes;
router.get("/", aspActivityStatusController.getList);
router.post("/getByIds", aspActivityStatusController.getByIds);

export default router;
