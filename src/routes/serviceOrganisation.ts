import { Router } from "express";
import serviceOrganisationController from "../controllers/serviceOrganisation";
const router = Router();

router.get("/", serviceOrganisationController.getList);
router.get("/getFormData", serviceOrganisationController.getFormData);
router.post("/save", serviceOrganisationController.saveAndUpdate);
router.put("/delete", serviceOrganisationController.delete);
router.put("/updateStatus", serviceOrganisationController.updateStatus);

//Import and Export;
router.get("/export", serviceOrganisationController.serviceOrganisaionExport);
router.post("/import", serviceOrganisationController.serviceOrganisationImport);


export default router;
