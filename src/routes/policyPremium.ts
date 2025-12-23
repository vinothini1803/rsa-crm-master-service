import { Router } from "express";
import PolicyPremiumController from "../controllers/policyPremium";
const router = Router();

router.get("/getList", PolicyPremiumController.getList);
router.get("/getFormData", PolicyPremiumController.getFormData);
router.post("/save", PolicyPremiumController.saveAndUpdate);
router.put("/updateStatus", PolicyPremiumController.updateStatus);
router.put("/delete", PolicyPremiumController.delete);

router.post("/import", PolicyPremiumController.import);
router.get("/export", PolicyPremiumController.export);

export default router;
