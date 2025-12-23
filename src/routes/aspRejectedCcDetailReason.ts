import { Router } from "express";
import aspRejectedCcDetailReason from "../controllers/aspRejectedCcDetailReason";
const router = Router();

//Access the all endpoint routes;
router.get("/", aspRejectedCcDetailReason.getList);
router.get("/getFormData", aspRejectedCcDetailReason.getFormData);
router.post("/save", aspRejectedCcDetailReason.saveAndUpdate);
router.put("/delete", aspRejectedCcDetailReason.delete);
router.put("/updateStatus", aspRejectedCcDetailReason.updateStatus);

router.post("/import", aspRejectedCcDetailReason.import);
router.get("/export", aspRejectedCcDetailReason.export);

export default router;
