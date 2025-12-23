import { Router } from "express";
import deliveryRequestPriceController from "../controllers/deliveryRequestPrice";
const router = Router();

//NOT USED
router.get(
  "/getPriceByClient",
  deliveryRequestPriceController.getPriceListByClientId
);

router.post(
  "/getTotalKmAndServiceCost",
  deliveryRequestPriceController.getTotalKmAndServiceCost
);

router.post(
  "/getAspServiceCost",
  deliveryRequestPriceController.getAspServiceCost
);

router.post(
  "/getServiceCostByTravelledKm",
  deliveryRequestPriceController.getServiceCostByTravelledKm
);

router.post(
  "/rsaGetTotalKmAndServiceCost",
  deliveryRequestPriceController.rsaGetTotalKmAndServiceCost
);

router.get(
  "/getPriceBaseClientId",
  deliveryRequestPriceController.getPriceBaseClientId
);
router.post(
  "/rsaGetServiceCostByTravelledKm",
  deliveryRequestPriceController.rsaGetServiceCostByTravelledKm
);

router.post(
  "/rsaGetActivityCustomerAndAspRateCard",
  deliveryRequestPriceController.rsaGetActivityCustomerAndAspRateCard
);
router.post(
  "/getAdditionalKmCost",
  deliveryRequestPriceController.getAdditionalKmCost
);
router.post(
  "/getServiceCostForRouteDeviationKm",
  deliveryRequestPriceController.getServiceCostForRouteDeviationKm
);

router.post(
  "/vdmGetActivityClientAndAspRateCard",
  deliveryRequestPriceController.vdmGetActivityClientAndAspRateCard
);

export default router;
