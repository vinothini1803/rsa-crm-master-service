import { Router } from "express";
import talukController from "../controllers/taluk";
const router = Router();

//Access the all endpoint routes;
router.get("/", talukController.getList);
router.get("/getFormData", talukController.getFormData);
router.post("/save", talukController.saveAndUpdate);
router.post("/delete", talukController.delete);
router.post("/updateStatus", talukController.updateStatus);

router.post("/import", talukController.import);
router.get("/export", talukController.export);

export default router;
