import { Op } from "sequelize";
import {
  Client,
  DeliveryRequestPrice,
  Service,
  Tax,
} from "../database/models/index";
import distance from "google-distance-matrix";
import axios from "axios";
import { Asp, SubService } from "../database/models/index";
import moment from "moment-timezone";
const config = require("../config/config.json");
import dotenv from "dotenv";
import Utils from "../lib/utils";
dotenv.config();

//API with endpoint (Case Service);
const caseManagementServiceUrl = `${config.caseService.host}:${config.caseService.port}/${config.caseService.version}/${config.caseService.serviceAccess.case}`;
const caseManagementEndpoint = config.caseService.endpoint;

class deliveryRequestPriceController {
  //API with endpoint (Case Service);
  private caseServiceUrl: any = `${config.caseService.host}:${config.caseService.port}/${config.caseService.version}/${config.caseService.serviceAccess.case}`;
  private endpoint: any = config.caseService.endpoint;

  constructor() { }

  //NOT USED
  public async getPriceListByClientId(req: any, res: any) {
    try {
      const { clientId, totalKm } = req.query;

      const deliveryRequestPriceByClient = await DeliveryRequestPrice.findByPk(
        clientId,
        {
          attributes: [
            "id",
            "rangeLimit",
            "belowRangePrice",
            "aboveRangePrice",
          ],
        }
      );
      const gstData: any = await Tax.findByPk(1, {
        attributes: ["id", "name", "percentage"],
      });

      if (!deliveryRequestPriceByClient) {
        return res.status(204).json({
          success: false,
          error: "Price data not found",
        });
      }

      // Calculate the price based on totalKm and price limits
      let calculateServiceCost = 0;
      if (totalKm <= deliveryRequestPriceByClient.dataValues.rangeLimit) {
        calculateServiceCost =
          deliveryRequestPriceByClient.dataValues.belowRangePrice;
      } else {
        const kmAboveRange =
          totalKm - deliveryRequestPriceByClient.dataValues.rangeLimit;
        calculateServiceCost =
          deliveryRequestPriceByClient.dataValues.belowRangePrice +
          kmAboveRange *
          deliveryRequestPriceByClient.dataValues.aboveRangePrice;
      }

      // Calculate GST amount
      const gstPercentage = gstData.dataValues.percentage;
      const gstAmount = calculateGSTAmount(calculateServiceCost, gstPercentage);

      // Calculate the total price including GST
      const serviceCost = calculateServiceCost + gstAmount;

      return res.status(200).json({
        success: true,
        data: {
          totalKm,
          serviceCost,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET TOTAL KM AND DEALER SERVICE COST BASED ON ASP, PICKUP AND DROP DEALER LAT AND LONG (ESTIMATED GOOGLE KM BASED)
  public getTotalKmAndServiceCost = async (req: any, res: any) => {
    const response = await totalKmAndServiceCostCommonFunction(req.body);
    return res.status(200).json(response);
  };

  //GET TOTAL KM AND CUSTOMER RATE CARD BASED ON ASP, BREAKDOWN AND DROP DEALER LAT AND LONG (ESTIMATED GOOGLE KM BASED)
  public rsaGetTotalKmAndServiceCost = async (req: any, res: any) => {
    const response = await rsaGetTotalKmAndServiceCostCommonFunction(req.body);
    return res.status(200).json(response);
  };

  //GET ASP SERVICE COST BASED TOTAL KM AND ASP RATE CARD
  public getAspServiceCost = async (req: any, res: any) => {
    const response = await aspServiceCostCommonFunction(req.body);
    return res.status(200).json(response);
  };

  //GET CLIENT SERVICE COST BASED ON TRAVELLED KM (VDM ACTUAL KM API PURPOSE)
  public getServiceCostByTravelledKm = async (req: any, res: any) => {
    try {
      const { clientId, totalKm, activityId, aspId } = req.body;
      if (!clientId) {
        return res.status(200).json({
          success: false,
          error: "Client is required",
        });
      }

      const [deliveryRequestPrice, getTax, getActivityAspData]: any =
        await Promise.all([
          //GET DELIERY REQUEST PRICE BY CLIENT
          DeliveryRequestPrice.findOne({
            where: { clientId: clientId },
            attributes: [
              "id",
              "rangeLimit",
              "belowRangePrice",
              "aboveRangePrice",
              "waitingChargePerHour",
            ],
          }),
          //GET TAX DATA
          Tax.findOne({
            where: { name: "IGST" },
            attributes: ["id", "name", "percentage"],
          }),
          //GET ACTUAL ADDITIONAL CHARGE
          axios({
            method: "get",
            url: `${this.caseServiceUrl}/${this.endpoint.case.getActivityAspDetail}`,
            data: {
              caseDetailId: "",
              activityId: activityId,
              aspId: aspId,
              typeId: 2,
            },
          }),
        ]);

      if (!deliveryRequestPrice) {
        return res.status(200).json({
          success: false,
          error: "Delivery request price not found",
        });
      }

      if (!getTax) {
        return res.status(200).json({
          success: false,
          error: "Tax not found",
        });
      }

      if (!getActivityAspData.data.success) {
        return res.status(200).json({
          success: false,
          error: "Activity ASP data not found",
        });
      }

      // Calculate the price based on totalKm and price limits
      let serviceCost = 0;
      if (
        parseFloat(totalKm) <=
        parseFloat(deliveryRequestPrice.dataValues.rangeLimit)
      ) {
        serviceCost = parseFloat(
          deliveryRequestPrice.dataValues.belowRangePrice
        );
      } else {
        const kmDifference =
          parseFloat(totalKm) -
          parseFloat(deliveryRequestPrice.dataValues.rangeLimit);
        serviceCost =
          parseFloat(deliveryRequestPrice.dataValues.belowRangePrice) +
          kmDifference *
          parseFloat(deliveryRequestPrice.dataValues.aboveRangePrice);
      }

      let totalAdditionalcharge = 0;
      if (
        getActivityAspData.data.data &&
        getActivityAspData.data.data.actualAdditionalCharge
      ) {
        //IF ACTUAL ADDITIONAL CHARGE EXIST
        totalAdditionalcharge = parseFloat(
          getActivityAspData.data.data.actualAdditionalCharge
        );
      }

      //CLIENT WAITING TIME CHARGE
      let clientWaitingCharge = 0;
      if (
        getActivityAspData.data.data &&
        getActivityAspData.data.data.actualClientWaitingCharge > 0
      ) {
        clientWaitingCharge = parseFloat(
          getActivityAspData.data.data.actualClientWaitingCharge
        );
      }

      let taxableValue =
        serviceCost + totalAdditionalcharge + clientWaitingCharge;

      // Calculate GST amount
      const gstPercentage = getTax.dataValues.percentage;
      const gstAmount = calculateGSTAmount(taxableValue, gstPercentage);

      // Calculate the total price including GST
      const totalAmount = (taxableValue + gstAmount).toFixed(2);

      // Continue processing or return the total km and price data as needed
      return res.status(200).json({
        success: true,
        data: {
          serviceCost: serviceCost,
          totalTax: gstAmount,
          totalAmount: totalAmount,
          deliveryRequestPrice: deliveryRequestPrice,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  //USED FOR CLIENT WAITING CHARGE CALCULATION,SO DONT CHANGE ANYTHING IN THIS FUNCTION
  public async getPriceBaseClientId(req: any, res: any) {
    try {
      const { clientId } = req.query;
      const deliveryRequestPrice = await DeliveryRequestPrice.findByPk(
        clientId,
        {
          attributes: [
            "rangeLimit",
            "belowRangePrice",
            "aboveRangePrice",
            "waitingChargePerHour",
          ],
          paranoid: false,
        }
      );

      if (!deliveryRequestPrice) {
        return res.status(200).json({
          success: false,
          error: "Delivery request price not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: deliveryRequestPrice,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  //GET CLIENT SERVICE COST BASED ON TRAVELLED KM (CRM ACTUAL KM API PURPOSE)
  public rsaGetServiceCostByTravelledKm = async (req: any, res: any) => {
    try {
      const { clientId, totalKm, activityId, aspId, subServiceId } = req.body;
      if (!clientId) {
        return res.status(200).json({
          success: false,
          error: "Client is required",
        });
      }
      const [client, subService, getActivityAspData, getTax]: any =
        await Promise.all([
          Client.findOne({
            attributes: ["id", "name"],
            where: {
              id: clientId,
            },
            paranoid: false,
          }),
          SubService.findOne({
            attributes: ["id", "name"],
            where: {
              id: subServiceId,
            },
            paranoid: false,
            include: {
              model: Service,
              attributes: ["id", "name"],
              required: true,
              paranoid: false,
            },
          }),
          //GET ACTUAL ADDITIONAL CHARGE
          axios({
            method: "get",
            url: `${this.caseServiceUrl}/${this.endpoint.case.getActivityAspDetail}`,
            data: {
              caseDetailId: "",
              activityId: activityId,
              aspId: aspId,
              typeId: 2,
            },
          }),
          //GET TAX DATA
          Tax.findOne({
            where: { name: "IGST" },
            attributes: ["id", "name", "percentage"],
          }),
        ]);

      if (!client) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      if (!subService) {
        return res.status(200).json({
          success: false,
          error: "Sub service not found",
        });
      }

      if (!getActivityAspData.data.success) {
        return res.status(200).json({
          success: false,
          error: "Activity ASP data not found",
        });
      }

      if (!getActivityAspData.data.data.activity) {
        return res.status(200).json({
          success: false,
          error: "Activity not found",
        });
      }

      if (!getTax) {
        return res.status(200).json({
          success: false,
          error: "Tax not found",
        });
      }
      const activity = getActivityAspData.data.data.activity;

      //CUSTOMER NON MEMBERSHIP RATE CARD
      let customerNonMembershipRateCard: any = null;
      if (activity.customerNeedToPay) {
        const getNonMembershipRateCardResponse: any =
          await getNonMembershipRateCard(
            client.dataValues.name,
            subService.service.dataValues.name,
            subService.dataValues.name
          );
        if (!getNonMembershipRateCardResponse.success) {
          return res.status(200).json({
            success: false,
            error: getNonMembershipRateCardResponse.error,
          });
        }
        customerNonMembershipRateCard =
          getNonMembershipRateCardResponse.nonMembershipRateCard;
      }

      let serviceCost = 0;
      if (activity.customerNeedToPay && customerNonMembershipRateCard) {
        if (activity.nonMembershipType == "Excess Towing") {
          serviceCost =
            parseFloat(activity.additionalChargeableKm) *
            parseFloat(customerNonMembershipRateCard.above_range_price);
        } else {
          if (
            parseFloat(totalKm) <=
            parseFloat(customerNonMembershipRateCard.range_limit)
          ) {
            serviceCost = parseFloat(
              customerNonMembershipRateCard.below_range_price
            );
          } else {
            const kmDifference =
              parseFloat(totalKm) -
              parseFloat(customerNonMembershipRateCard.range_limit);

            serviceCost =
              parseFloat(customerNonMembershipRateCard.below_range_price) +
              kmDifference *
              parseFloat(customerNonMembershipRateCard.above_range_price);
          }
        }
      }

      let totalAdditionalcharge = 0;
      if (
        getActivityAspData.data.data &&
        getActivityAspData.data.data.actualAdditionalCharge
      ) {
        //IF ACTUAL ADDITIONAL CHARGE EXIST
        totalAdditionalcharge = parseFloat(
          getActivityAspData.data.data.actualAdditionalCharge
        );
      }

      //CLIENT WAITING TIME CHARGE
      let clientWaitingCharge = 0;
      if (
        getActivityAspData.data.data &&
        getActivityAspData.data.data.actualClientWaitingCharge > 0
      ) {
        clientWaitingCharge = parseFloat(
          getActivityAspData.data.data.actualClientWaitingCharge
        );
      }

      let taxableValue =
        serviceCost + totalAdditionalcharge + clientWaitingCharge;
      // Calculate GST amount
      const gstPercentage = getTax.dataValues.percentage;
      const gstAmount = calculateGSTAmount(taxableValue, gstPercentage);
      // Calculate the total price including GST
      const totalAmount = (taxableValue + gstAmount).toFixed(2);

      return res.status(200).json({
        success: true,
        data: {
          serviceCost: serviceCost,
          totalTax: gstAmount,
          totalAmount: totalAmount,
          customerNeedToPay: activity.customerNeedToPay,
          customerNonMembershipRateCard: customerNonMembershipRateCard,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  // Calculate additional KM cost based on KM difference using customerNonMembershipRateCard
  public getAdditionalKmCost = async (req: any, res: any) => {
    try {
      const { clientId, subServiceId, additionalKm, nonMembershipType } = req.body;

      if (!clientId || !subServiceId || !additionalKm) {
        return res.status(200).json({
          success: false,
          error: "clientId, subServiceId, and additionalKm are required",
        });
      }

      const [client, subService, getTax]: any = await Promise.all([
        Client.findOne({
          attributes: ["id", "name"],
          where: { id: clientId },
          paranoid: false,
        }),
        SubService.findOne({
          attributes: ["id", "name"],
          where: { id: subServiceId },
          paranoid: false,
          include: {
            model: Service,
            attributes: ["id", "name"],
            required: true,
            paranoid: false,
          },
        }),
        Tax.findOne({
          where: { name: "IGST" },
          attributes: ["id", "name", "percentage"],
        }),
      ]);

      if (!client) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      if (!subService) {
        return res.status(200).json({
          success: false,
          error: "Sub service not found",
        });
      }

      if (!getTax) {
        return res.status(200).json({
          success: false,
          error: "Tax not found",
        });
      }

      // Get customer non-membership rate card
      const getNonMembershipRateCardResponse: any = await getNonMembershipRateCard(
        client.dataValues.name,
        subService.service.dataValues.name,
        subService.dataValues.name
      );

      if (!getNonMembershipRateCardResponse.success) {
        return res.status(200).json({
          success: false,
          error: getNonMembershipRateCardResponse.error,
        });
      }

      const customerNonMembershipRateCard =
        getNonMembershipRateCardResponse.nonMembershipRateCard;

      // Calculate service cost based on KM difference
      // For additional KM, we use above_range_price directly
      let serviceCost = 0;
      if (nonMembershipType === "Excess Towing") {
        // For Excess Towing, multiply additionalKm by above_range_price
        serviceCost =
          parseFloat(additionalKm) *
          parseFloat(customerNonMembershipRateCard.above_range_price);
      } else {
        // For other non-membership types, 
        // Apply below_range_price if additionalKm is less than or equal to range_limit
        // Otherwise, apply above_range_price for additional KM difference
        if (
          parseFloat(additionalKm) <=
          parseFloat(customerNonMembershipRateCard.range_limit)
        ) {
          serviceCost = parseFloat(
            customerNonMembershipRateCard.below_range_price
          );
        } else {
          const additionalKmDifference =
            parseFloat(additionalKm) -
            parseFloat(customerNonMembershipRateCard.range_limit);

          serviceCost =
            parseFloat(customerNonMembershipRateCard.below_range_price) +
            additionalKmDifference *
            parseFloat(customerNonMembershipRateCard.above_range_price);
        }
      }

      // Calculate GST amount
      const gstPercentage = getTax.dataValues.percentage;
      const gstAmount = calculateGSTAmount(serviceCost, gstPercentage);

      // Calculate the total amount including GST
      const totalAmount = (serviceCost + gstAmount).toFixed(2);

      return res.status(200).json({
        success: true,
        data: {
          estimatedServiceCost: serviceCost.toFixed(2),
          estimatedTotalTax: gstAmount.toFixed(2),
          estimatedTotalAmount: totalAmount,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  public rsaGetActivityCustomerAndAspRateCard = async (req: any, res: any) => {
    try {
      const activityDetails = req.body;
      const response = [];

      for (const activityDetail of activityDetails) {
        const aspServiceCostRequest = {
          ...activityDetail.aspServiceCostApiPayload,
        };
        delete activityDetail.aspServiceCostApiPayload;

        //CUSTOMER RATE CARD
        const customerRateCardResponse =
          await rsaGetTotalKmAndServiceCostCommonFunction(activityDetail);
        if (!customerRateCardResponse.success) {
          return res.status(200).json(customerRateCardResponse);
        }

        //ASP RATE CARD
        if (
          customerRateCardResponse.data &&
          customerRateCardResponse.data.estimatedTotalKm
        ) {
          aspServiceCostRequest.totalKm =
            customerRateCardResponse.data.estimatedTotalKm;
        }

        const aspRateCardResponse = await aspServiceCostCommonFunction(
          aspServiceCostRequest
        );
        if (!aspRateCardResponse.success) {
          return res.status(200).json(aspRateCardResponse);
        }

        response.push({
          customerRateCard: customerRateCardResponse,
          aspRateCard: aspRateCardResponse,
        });
      }

      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  //USED IN ROUTE DEVIATION KM UPDATE API
  public getServiceCostForRouteDeviationKm = async (req: any, res: any) => {
    try {
      const data = req.body;
      const v = {
        clientId: "numeric|required",
        aspId: "numeric|required",
        subServiceId: "numeric|required",
      };
      const errors = await Utils.validateParams(data, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const [deliveryRequestPrice, asp, subService, tax]: any =
        await Promise.all([
          DeliveryRequestPrice.findOne({
            where: { clientId: data.clientId },
            attributes: [
              "id",
              "rangeLimit",
              "belowRangePrice",
              "aboveRangePrice",
              "waitingChargePerHour",
            ],
          }),
          Asp.findOne({
            where: { id: data.aspId },
            attributes: ["id", "code"],
            paranoid: false,
          }),
          SubService.findOne({
            where: { id: data.subServiceId },
            attributes: ["id", "name"],
          }),
          Tax.findOne({
            where: { name: "IGST" },
            attributes: ["id", "name", "percentage"],
          }),
        ]);

      if (!deliveryRequestPrice) {
        return res.status(200).json({
          success: false,
          error: "Delivery request price not found",
        });
      }

      if (!asp) {
        return res.status(200).json({
          success: false,
          error: "ASP not found",
        });
      }

      if (!subService) {
        return res.status(200).json({
          success: false,
          error: "Sub service not found",
        });
      }

      if (!tax) {
        return res.status(200).json({
          success: false,
          error: "Tax not found",
        });
      }

      const totalKm: any = (
        parseFloat(data.estimatedTotalKm || 0) +
        parseFloat(data.routeDeviationKm || 0)
      ).toFixed(2);
      let totalAdditionalcharge = 0;
      if (data.estimatedAdditionalCharge && data.estimatedAdditionalCharge) {
        totalAdditionalcharge = parseFloat(data.estimatedAdditionalCharge);
      }
      const gstPercentage = tax.dataValues.percentage;

      // CLIENT SERVICE COST
      let serviceCost = 0;
      if (
        parseFloat(totalKm) <=
        parseFloat(deliveryRequestPrice.dataValues.rangeLimit)
      ) {
        serviceCost = parseFloat(
          deliveryRequestPrice.dataValues.belowRangePrice
        );
      } else {
        const kmDifference =
          parseFloat(totalKm) -
          parseFloat(deliveryRequestPrice.dataValues.rangeLimit);
        serviceCost =
          parseFloat(deliveryRequestPrice.dataValues.belowRangePrice) +
          kmDifference *
          parseFloat(deliveryRequestPrice.dataValues.aboveRangePrice);
      }

      const taxableValue = serviceCost + totalAdditionalcharge;
      const gstAmount = calculateGSTAmount(taxableValue, gstPercentage);
      const totalAmount = (taxableValue + gstAmount).toFixed(2);

      //ASP SERVICE COST
      const aspRateCardData = {
        aspCode: asp.dataValues.code,
        subService: subService.dataValues.name,
        date: moment.tz(data.caseDate, "Asia/Kolkata").format("YYYY-MM-DD"),
        isMobile: 1,
      };
      const getAspRateCard = await axios.post(
        `${process.env.RSA_BASE_URL}/crm/asp/getRateCard`,
        aspRateCardData
      );
      if (!getAspRateCard.data.success) {
        return res.status(200).json({
          success: false,
          error: "ASP rate card not found",
        });
      }

      let aspServiceCost = 0;
      if (
        parseFloat(totalKm) <=
        parseFloat(getAspRateCard.data.aspRateCard.range_limit)
      ) {
        aspServiceCost = parseFloat(
          getAspRateCard.data.aspRateCard.below_range_price
        );
      } else {
        const kmDifference =
          parseFloat(totalKm) -
          parseFloat(getAspRateCard.data.aspRateCard.range_limit);

        aspServiceCost =
          parseFloat(getAspRateCard.data.aspRateCard.below_range_price) +
          kmDifference *
          parseFloat(getAspRateCard.data.aspRateCard.above_range_price);
      }

      let aspTaxableValue = aspServiceCost + totalAdditionalcharge;
      const aspGstAmount = calculateGSTAmount(aspTaxableValue, gstPercentage);
      const aspTotalAmount = (aspTaxableValue + aspGstAmount).toFixed(2);

      return res.status(200).json({
        success: true,
        data: {
          totalKm: totalKm,
          serviceCost: serviceCost,
          totalTax: gstAmount,
          totalAmount: totalAmount,
          aspServiceCost: aspServiceCost,
          aspTotalTax: aspGstAmount,
          aspTotalAmount: aspTotalAmount,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  public vdmGetActivityClientAndAspRateCard = async (req: any, res: any) => {
    try {
      const activityDetails = req.body;
      const response = [];
      for (const activityDetail of activityDetails) {
        const aspServiceCostRequest = {
          ...activityDetail.aspServiceCostApiPayload,
        };
        delete activityDetail.aspServiceCostApiPayload;

        //CLIENT RATE CARD
        const clientRateCardResponse =
          await totalKmAndServiceCostCommonFunction(activityDetail);
        if (!clientRateCardResponse.success) {
          return res.status(200).json(clientRateCardResponse);
        }

        //ASP RATE CARD(UPDATE TOTAL KM SINCE LOCATIONS ARE CHANGED)
        if (
          clientRateCardResponse.data &&
          clientRateCardResponse.data.estimatedTotalKm
        ) {
          aspServiceCostRequest.totalKm =
            clientRateCardResponse.data.estimatedTotalKm;
        }

        const aspRateCardResponse = await aspServiceCostCommonFunction(
          aspServiceCostRequest
        );
        if (!aspRateCardResponse.success) {
          return res.status(200).json(aspRateCardResponse);
        }

        response.push({
          clientRateCard: clientRateCardResponse,
          aspRateCard: aspRateCardResponse,
        });
      }

      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

function calculateGSTAmount(price: number, gstPercentage: number): number {
  const gstAmount = price * (gstPercentage / 100);
  return gstAmount;
}

//Convert Duration to day, hours and minutes format;
function formatDuration(durationInMinutes: any) {
  const minutesPerHour = 60;
  const hoursPerDay = 24;

  const days = Math.floor(durationInMinutes / (minutesPerHour * hoursPerDay));
  const hours = Math.floor(
    (durationInMinutes % (minutesPerHour * hoursPerDay)) / minutesPerHour
  );
  const minutes = durationInMinutes % minutesPerHour;

  if (days > 0) {
    if (hours > 0) {
      return `${days} days ${hours} hours ${Math.round(minutes)} minutes`;
    } else {
      return `${days} days ${Math.round(minutes)} minutes`;
    }
  } else {
    if (hours > 0) {
      return `${hours} hours ${Math.round(minutes)} minutes`;
    } else {
      return `${Math.round(minutes)} minutes`;
    }
  }
}

// DURATION (CONVERT SECONDS TO MINUTES)
const totalDuration = (distanceData: any) =>
  distanceData?.[0]?.elements
    ? distanceData?.[0]?.elements.reduce(
      (total: any, item: any) => total + (item?.duration?.value || 0),
      0
    ) / 60
    : 0;

// EXTRACT DISTANCE
// The 'value' field represents the distance in meters, so we divide it by 1000 to get kilometers
const extractDistance = (distanceData: any) =>
  distanceData?.[0]?.elements
    ? Math.round((distanceData?.[0]?.elements[0]?.distance?.value || 0) / 1000)
    : 0;

// EXTRACT DURATION
const extractDuration = (durationData: any) =>
  durationData?.[0]?.elements ? (durationData?.[0]?.elements[0]?.duration?.text || 0) : 0;

const getNonMembershipRateCard = async (
  client: string,
  service: string,
  subService: string
) => {
  try {
    const getNonMembershipRateCard = await axios.post(
      `${process.env.RSA_BASE_URL}/crm/get/nonMembership/rateCards`,
      {
        clientName: client,
        serviceName: service,
        subServiceName: subService,
      }
    );

    if (!getNonMembershipRateCard.data.success) {
      return {
        success: false,
        error: getNonMembershipRateCard.data.error,
      };
    }
    return {
      success: true,
      nonMembershipRateCard: getNonMembershipRateCard.data.data[0],
    };
  } catch (error: any) {
    throw error;
  }
};

const rsaGetTotalKmAndServiceCostCommonFunction = async (params: any) => {
  try {
    const data = params;
    if (!data.clientId) {
      return {
        success: false,
        error: "Client is required",
      };
    }

    let aspLocation: string[] = [];
    let breakdownLocation: string[] = [];
    let dropLocation: string[] = [];

    if (data.aspLocation) {
      aspLocation.push(
        data.aspLocation.latitude + "," + data.aspLocation.longitude
      );
    }
    if (data.breakdownLocation) {
      breakdownLocation.push(
        data.breakdownLocation.latitude + "," + data.breakdownLocation.longitude
      );
    }
    if (data.dropLocation) {
      dropLocation.push(
        data.dropLocation.latitude + "," + data.dropLocation.longitude
      );
    }

    // Parallelize distance calculations
    let aspToBreakdown = null;
    let breakdownToDrop = null;
    let dropToAsp = null;
    let breakdownToAsp = null;
    if (data.dropLocation) {
      const [
        aspToBreakdownLocation,
        breakdownToDropLocation,
        dropToAspLocation,
      ]: any = await Promise.all([
        Utils.getGoogleDistanceDuration(aspLocation, breakdownLocation, 2),
        Utils.getGoogleDistanceDuration(breakdownLocation, dropLocation, 2),
        Utils.getGoogleDistanceDuration(dropLocation, aspLocation, 2),
      ]);

      aspToBreakdown = aspToBreakdownLocation;
      breakdownToDrop = breakdownToDropLocation;
      dropToAsp = dropToAspLocation;
    } else {
      const [aspToBreakdownLocation, breakdownToAspLocation]: any =
        await Promise.all([
          Utils.getGoogleDistanceDuration(aspLocation, breakdownLocation, 2),
          Utils.getGoogleDistanceDuration(breakdownLocation, aspLocation, 2),
        ]);
      aspToBreakdown = aspToBreakdownLocation;
      breakdownToAsp = breakdownToAspLocation;
    }

    let aspToBreakdownDuration = 0;
    let breakdownToDropDuration = 0;
    let dropToAspDuration = 0;
    let breakdownToAspDuration = 0;
    let totalGToGDuration = 0;
    if (data.dropLocation) {
      aspToBreakdownDuration = totalDuration(aspToBreakdown);
      breakdownToDropDuration = totalDuration(breakdownToDrop);
      dropToAspDuration = totalDuration(dropToAsp);
      totalGToGDuration =
        aspToBreakdownDuration + breakdownToDropDuration + dropToAspDuration;
    } else {
      aspToBreakdownDuration = totalDuration(aspToBreakdown);
      breakdownToAspDuration = totalDuration(breakdownToAsp);
      totalGToGDuration = aspToBreakdownDuration + breakdownToAspDuration;
    }

    // Assuming you have your total duration calculated as totalGToGDuration
    const totalGToGDurationInMinutes = totalGToGDuration; // No need to replace this line

    const formattedDuration = formatDuration(totalGToGDurationInMinutes);

    //KM BREAKUPS
    let aspToBreakdownDistanceKm = 0;
    let breakdownToDropDistanceKm = 0;
    let dropToAspDistanceKm = 0;
    let breakdownToAspDistanceKm = 0;
    if (data.dropLocation) {
      aspToBreakdownDistanceKm = extractDistance(aspToBreakdown);
      breakdownToDropDistanceKm = extractDistance(breakdownToDrop);
      dropToAspDistanceKm = extractDistance(dropToAsp);
    } else {
      aspToBreakdownDistanceKm = extractDistance(aspToBreakdown);
      breakdownToAspDistanceKm = extractDistance(breakdownToAsp);
    }

    //KM DURATION BREAKUPS
    let aspToBreakdownKmDuration = 0;
    let breakdownToDropKmDuration = 0;
    let dropToAspKmDuration = 0;
    let breakdownToAspKmDuration = 0;
    let totalKmDurationBetweenLocations = null;
    let totalKmBetweenLocations = null;
    let totalKm: any = 0;
    if (data.dropLocation) {
      aspToBreakdownKmDuration = extractDuration(aspToBreakdown);
      breakdownToDropKmDuration = extractDuration(breakdownToDrop);
      dropToAspKmDuration = extractDuration(dropToAsp);

      totalKmDurationBetweenLocations = {
        estimatedAspToBreakdownKmDuration: aspToBreakdownKmDuration,
        estimatedBreakdownToDropKmDuration: breakdownToDropKmDuration,
        estimatedDropToAspKmDuration: dropToAspKmDuration,
      };

      //KM BREAKUPs
      const aspToBreakdownKm = aspToBreakdownDistanceKm.toFixed(2);
      const breakdownToDropKm = breakdownToDropDistanceKm.toFixed(2);
      const dropToAspKm = dropToAspDistanceKm.toFixed(2);

      totalKmBetweenLocations = {
        estimatedAspToBreakdownKm: aspToBreakdownKm,
        estimatedBreakdownToDropKm: breakdownToDropKm,
        estimatedDropToAspKm: dropToAspKm,
      };

      // Calculate total distance in kilometers
      totalKm = (
        aspToBreakdownDistanceKm +
        breakdownToDropDistanceKm +
        dropToAspDistanceKm
      ).toFixed(2);
    } else {
      aspToBreakdownKmDuration = extractDuration(aspToBreakdown);
      breakdownToAspKmDuration = extractDuration(breakdownToAsp);

      totalKmDurationBetweenLocations = {
        estimatedAspToBreakdownKmDuration: aspToBreakdownKmDuration,
        estimatedBreakdownToAspKmDuration: breakdownToAspKmDuration,
      };

      //KM BREAKUPs
      const aspToBreakdownKm = aspToBreakdownDistanceKm.toFixed(2);
      const breakdownToAspKm = breakdownToAspDistanceKm.toFixed(2);

      totalKmBetweenLocations = {
        estimatedAspToBreakdownKm: aspToBreakdownKm,
        estimatedBreakdownToAspKm: breakdownToAspKm,
      };

      totalKm = (aspToBreakdownDistanceKm + breakdownToAspDistanceKm).toFixed(
        2
      );
    }

    //CUSTOMER RATE CARD
    let customerNonMembershipRateCard = null;
    // CHECK IF CUSTOMER NEED TO PAY FOR GIVEN ACTIVITY(HANDLED CASE CREATION, ADDITIONAL SERVICE - TOWING, CUSTODY REQUEST, ASP ACTIVITY REJECTION NEW ACTIVITY SCENARIOS)
    if (data.activityDetail?.customerNeedToPay) {
      const subService: any = await SubService.findOne({
        where: {
          id: data.activityDetail.subServiceId,
        },
        attributes: ["id", "name"],
        paranoid: false,
        include: {
          model: Service,
          attributes: ["id", "name"],
          required: true,
          paranoid: false,
        },
      });
      if (!subService) {
        return {
          success: false,
          error: "Sub service not found",
        };
      }

      const client: any = await Client.findOne({
        where: {
          id: data.clientId,
        },
        attributes: ["id", "name"],
        paranoid: false,
      });
      if (!client) {
        return {
          success: false,
          error: "Client details not found",
        };
      }

      const getNonMembershipRateCardResponse: any =
        await getNonMembershipRateCard(
          client.dataValues.name,
          subService.service.dataValues.name,
          subService.dataValues.name
        );
      if (!getNonMembershipRateCardResponse.success) {
        return {
          success: false,
          error: getNonMembershipRateCardResponse.error,
        };
      }
      customerNonMembershipRateCard =
        getNonMembershipRateCardResponse.nonMembershipRateCard;
    }

    //GET TAX DATA
    const getTax: any = await Tax.findOne({
      where: { name: "IGST" },
      attributes: ["id", "name", "percentage"],
    });
    if (!getTax) {
      return {
        success: false,
        error: "Tax not found",
      };
    }

    // Calculate the price based on totalKm and price limits
    let serviceCost = 0;
    // TOOK DATA BASED ON THE ACTIVITY(HANDLED CASE CREATION, ADDITIONAL SERVICE - TOWING, CUSTODY REQUEST, ASP ACTIVITY REJECTION NEW ACTIVITY SCENARIOS)
    const nonMembershipType = data.activityDetail.nonMembershipType;
    const excessKm = data.activityDetail.additionalChargeableKm;
    if (
      data.activityDetail.customerNeedToPay &&
      customerNonMembershipRateCard
    ) {
      if (data.activityDetail.nonMembershipType == "Excess Towing") {
        serviceCost =
          parseFloat(data.activityDetail.additionalChargeableKm) *
          parseFloat(customerNonMembershipRateCard.above_range_price);
      } else {
        if (
          parseFloat(totalKm) <=
          parseFloat(customerNonMembershipRateCard.range_limit)
        ) {
          serviceCost = parseFloat(
            customerNonMembershipRateCard.below_range_price
          );
        } else {
          const kmDifference =
            parseFloat(totalKm) -
            parseFloat(customerNonMembershipRateCard.range_limit);

          serviceCost =
            parseFloat(customerNonMembershipRateCard.below_range_price) +
            kmDifference *
            parseFloat(customerNonMembershipRateCard.above_range_price);
        }
      }
    }

    //GET ESTIMATED ADDITIONAL CHARGE IF API TYPE IS RSA CREATE ACTIVITY REQUEST
    let getActivityAspData = null;
    let getActivityAspDetails = true;
    if (data.apiType && data.apiType == "rsaCreateActivityRequest") {
      getActivityAspDetails = false;
    }
    if (getActivityAspDetails) {
      //GET ESTIMATED ADDITIONAL CHARGE (IF REQUEST SENT AND CLICKING MAP VIEW AGAIN THEN WE NEED TO INCLUDE ADDITIONAL CHARGES IF ADDED)
      getActivityAspData = await axios({
        method: "get",
        url: `${caseManagementServiceUrl}/${caseManagementEndpoint.case.getActivityAspDetail}`,
        data: {
          caseDetailId: data.caseDetailId,
          // activityId: "",
          activityId: data.activityId ? data.activityId : "", //for asp map view purpose we have enabled this param
          aspId: data.aspId,
          typeId: 1,
        },
      });
      if (!getActivityAspData.data.success) {
        return {
          success: false,
          error: "Activity ASP data not found",
        };
      }
    }

    let totalAdditionalcharge = 0;
    if (getActivityAspData?.data?.data?.estimatedAdditionalCharge) {
      totalAdditionalcharge = parseFloat(
        getActivityAspData.data.data.estimatedAdditionalCharge
      );
    }

    let discountAmount = 0;
    if (getActivityAspData?.data?.data?.discountAmount) {
      discountAmount = parseFloat(getActivityAspData.data.data.discountAmount);
    }

    // let taxableValue = serviceCost + totalAdditionalcharge; //OLD CODE WITHOUT DISCOUNT
    let taxableValue = serviceCost + totalAdditionalcharge - discountAmount;

    // Calculate GST amount
    const gstPercentage = getTax.dataValues.percentage;
    const gstAmount = calculateGSTAmount(taxableValue, gstPercentage);

    // Calculate the total price including GST
    const totalAmount = (taxableValue + gstAmount).toFixed(2);

    // Continue processing or return the total km and price data as needed
    return {
      success: true,
      activityDetail: data.activityDetail,
      data: {
        nonMembershipType: nonMembershipType,
        excessKm: excessKm,
        estimatedTotalKmBetweenLocations: totalKmBetweenLocations,
        estimatedTotalKmDurationBetweenLocations:
          totalKmDurationBetweenLocations,
        estimatedTotalKm: totalKm,
        estimatedTotalDuration: formattedDuration,
        estimatedServiceCost: serviceCost,
        estimatedAdditionalCharge: totalAdditionalcharge,
        estimatedDiscountAmount: discountAmount,
        estimatedTotalTax: gstAmount,
        estimatedTotalAmount: totalAmount,
        customerNeedToPay: data.activityDetail.customerNeedToPay,
        customerNonMembershipRateCard: customerNonMembershipRateCard,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message,
    };
  }
};

const aspServiceCostCommonFunction = async (params: any) => {
  try {
    const data = params;
    const totalKm = data.totalKm;

    if (!data.aspId) {
      return {
        success: false,
        error: "ASP is required",
      };
    }

    if (!data.subServiceId) {
      return {
        success: false,
        error: "Sub service is required",
      };
    }

    if (!data.typeId) {
      return {
        success: false,
        error: "Type is required",
      };
    }

    let paranoid = true;
    //AGENT
    if (data.authUserRoleId == 3) {
      paranoid = false;
    }

    const [asp, subService, getTax]: any = await Promise.all([
      Asp.findOne({
        where: { id: data.aspId },
        attributes: ["id", "code"],
        paranoid: paranoid,
      }),
      SubService.findOne({
        where: { id: data.subServiceId },
        attributes: ["id", "name"],
      }),
      //GET TAX DATA
      Tax.findOne({
        where: { name: "IGST" },
        attributes: ["id", "name", "percentage"],
      }),
    ]);

    if (!asp) {
      return {
        success: false,
        error: "ASP not found",
      };
    }

    if (!subService) {
      return {
        success: false,
        error: "Sub service not found",
      };
    }

    if (!getTax) {
      return {
        success: false,
        error: "Tax not found",
      };
    }

    const aspRateCardData = {
      aspCode: asp.dataValues.code,
      subService: subService.dataValues.name,
      date: moment.tz(data.caseDate, "Asia/Kolkata").format("YYYY-MM-DD"),
      isMobile: 1,
    };
    const getAspRateCard = await axios.post(
      `${process.env.RSA_BASE_URL}/crm/asp/getRateCard`,
      aspRateCardData
    );
    if (!getAspRateCard.data.success) {
      return {
        success: false,
        error: "ASP rate card not found",
      };
    }

    // Calculate the price based on totalKm and price limits
    let serviceCost = 0;
    if (
      parseFloat(totalKm) <=
      parseFloat(getAspRateCard.data.aspRateCard.range_limit)
    ) {
      serviceCost = parseFloat(
        getAspRateCard.data.aspRateCard.below_range_price
      );
    } else {
      const kmDifference =
        parseFloat(totalKm) -
        parseFloat(getAspRateCard.data.aspRateCard.range_limit);
      serviceCost =
        parseFloat(getAspRateCard.data.aspRateCard.below_range_price) +
        kmDifference *
        parseFloat(getAspRateCard.data.aspRateCard.above_range_price);
    }

    //GET ESTIMATED ADDITIONAL CHARGE IF API TYPE IS NOT VDM ACTIVITY REQUEST OR RSA CREATE ACTIVITY REQUEST
    let getActivityAspData = null;
    let getActivityAspDetails = true;
    if (
      data.apiType &&
      (data.apiType == "vdmActivityRequest" ||
        data.apiType == "rsaCreateActivityRequest")
    ) {
      getActivityAspDetails = false;
    }
    if (getActivityAspDetails) {
      getActivityAspData = await axios({
        method: "get",
        url: `${caseManagementServiceUrl}/${caseManagementEndpoint.case.getActivityAspDetail}`,
        data: {
          caseDetailId: data.caseDetailId ? data.caseDetailId : "",
          activityId: data.activityId ? data.activityId : "",
          aspId: data.aspId,
          typeId: data.typeId,
        },
      });
      if (!getActivityAspData.data.success) {
        return {
          success: false,
          error: "Activity ASP data not found",
        };
      }
    }

    let totalAdditionalcharge = 0;
    let aspWaitingCharge = 0;
    if (getActivityAspData?.data?.data) {
      //IF ACTUAL ADDITIONAL CHARGE EXIST
      if (
        data.typeId == 2 &&
        getActivityAspData.data.data.actualAdditionalCharge
      ) {
        totalAdditionalcharge = parseFloat(
          getActivityAspData.data.data.actualAdditionalCharge
        );
      } else if (
        data.typeId == 1 &&
        getActivityAspData.data.data.estimatedAdditionalCharge
      ) {
        //IF ESTIMATED ADDITIONAL CHARGE EXIST
        totalAdditionalcharge = parseFloat(
          getActivityAspData.data.data.estimatedAdditionalCharge
        );
      }

      //ASP WAITING TIME CHARGE
      if (
        data.typeId == 2 &&
        getActivityAspData.data.data.actualAspWaitingCharge > 0
      ) {
        aspWaitingCharge = parseFloat(
          getActivityAspData.data.data.actualAspWaitingCharge
        );
      }
    }

    let taxableValue = serviceCost + totalAdditionalcharge + aspWaitingCharge;

    // Calculate GST amount
    const gstPercentage = getTax.dataValues.percentage;
    const gstAmount = calculateGSTAmount(taxableValue, gstPercentage);

    // Calculate the total price including GST
    const totalAmount = (taxableValue + gstAmount).toFixed(2);

    // Continue processing or return the total km and price data as needed
    return {
      success: true,
      data: {
        aspServiceCost: serviceCost,
        aspTotalTax: gstAmount,
        aspTotalAmount: totalAmount,
        aspRateCard: getAspRateCard.data.aspRateCard,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const totalKmAndServiceCostCommonFunction = async (params: any) => {
  try {
    const data = params;
    if (!data.clientId) {
      return {
        success: false,
        error: "Client is required",
      };
    }

    let clientId = data.clientId;
    let aspLocation: string[] = [];
    let pickupLocation: string[] = [];
    let dropLocation: string[] = [];

    if (data.aspLocation) {
      aspLocation.push(
        data.aspLocation.latitude + "," + data.aspLocation.longitude
      );
    }
    if (data.pickupLocation) {
      pickupLocation.push(
        data.pickupLocation.latitude + "," + data.pickupLocation.longitude
      );
    }
    if (data.dropLocation) {
      dropLocation.push(
        data.dropLocation.latitude + "," + data.dropLocation.longitude
      );
    }

    // Parallelize distance calculations
    const [aspToPickup, pickupToDrop, dropToAsp]: any = await Promise.all([
      Utils.getGoogleDistanceDuration(aspLocation, pickupLocation, 2),
      Utils.getGoogleDistanceDuration(pickupLocation, dropLocation, 2),
      Utils.getGoogleDistanceDuration(dropLocation, aspLocation, 2),
    ]);

    const aspToPickupDuration = totalDuration(aspToPickup);
    const pickupToDropDuration = totalDuration(pickupToDrop);
    const dropToAspDuration = totalDuration(dropToAsp);

    const totalGToGDuration =
      aspToPickupDuration + pickupToDropDuration + dropToAspDuration;

    // Assuming you have your total duration calculated as totalGToGDuration
    const totalGToGDurationInMinutes = totalGToGDuration; // No need to replace this line

    const formattedDuration = formatDuration(totalGToGDurationInMinutes);

    const aspToPickupDistanceKm = extractDistance(aspToPickup);
    const pickupToDropDistanceKm = extractDistance(pickupToDrop);
    const dropToAspDistanceKm = extractDistance(dropToAsp);

    //KM DURATION BREAKUPS
    const aspToPickupKmDuration = extractDuration(aspToPickup);
    const pickupToDropKmDuration = extractDuration(pickupToDrop);
    const dropToAspKmDuration = extractDuration(dropToAsp);

    const totalKmDurationBetweenLocations = {
      estimatedAspToPickupKmDuration: aspToPickupKmDuration,
      estimatedPickupToDropKmDuration: pickupToDropKmDuration,
      estimatedDropToAspKmDuration: dropToAspKmDuration,
    };

    //KM BREAKUPs
    const aspToPickupKm = aspToPickupDistanceKm.toFixed(2);
    const pickupToDropKm = pickupToDropDistanceKm.toFixed(2);
    const dropToAspKm = dropToAspDistanceKm.toFixed(2);

    const totalKmBetweenLocations = {
      estimatedAspToPickupKm: aspToPickupKm,
      estimatedPickupToDropKm: pickupToDropKm,
      estimatedDropToAspKm: dropToAspKm,
    };

    // Calculate total distance in kilometers
    const totalKm: any = (
      aspToPickupDistanceKm +
      pickupToDropDistanceKm +
      dropToAspDistanceKm
    ).toFixed(2);

    //GET DELIERY REQUEST PRICE BY CLIENT
    const deliveryRequestPrice: any = await DeliveryRequestPrice.findOne({
      where: { clientId: clientId },
      attributes: [
        "id",
        "rangeLimit",
        "belowRangePrice",
        "aboveRangePrice",
        "waitingChargePerHour",
      ],
    });
    if (!deliveryRequestPrice) {
      return {
        success: false,
        error: "Delivery request price not found",
      };
    }

    //GET TAX DATA
    const getTax: any = await Tax.findOne({
      where: { name: "IGST" },
      attributes: ["id", "name", "percentage"],
    });
    if (!getTax) {
      return {
        success: false,
        error: "Tax not found",
      };
    }

    // Calculate the price based on totalKm and price limits
    let serviceCost = 0;
    if (
      parseFloat(totalKm) <=
      parseFloat(deliveryRequestPrice.dataValues.rangeLimit)
    ) {
      serviceCost = parseFloat(deliveryRequestPrice.dataValues.belowRangePrice);
    } else {
      const kmDifference =
        parseFloat(totalKm) -
        parseFloat(deliveryRequestPrice.dataValues.rangeLimit);
      serviceCost =
        parseFloat(deliveryRequestPrice.dataValues.belowRangePrice) +
        kmDifference *
        parseFloat(deliveryRequestPrice.dataValues.aboveRangePrice);
    }

    //GET ESTIMATED ADDITIONAL CHARGE IF API TYPE IS NOT VDM ACTIVITY REQUEST
    let getActivityAspData = null;
    let getActivityAspDetails = true;
    if (data.apiType && data.apiType == "vdmActivityRequest") {
      getActivityAspDetails = false;
    }
    if (getActivityAspDetails) {
      getActivityAspData = await axios({
        method: "get",
        url: `${caseManagementServiceUrl}/${caseManagementEndpoint.case.getActivityAspDetail}`,
        data: {
          caseDetailId: data.caseDetailId,
          // activityId: "",
          activityId: data.activityId ? data.activityId : "", //for asp map view & pickup, drop location update purpose we have enabled this param
          aspId: data.aspId,
          typeId: 1,
        },
      });
      if (!getActivityAspData.data.success) {
        return {
          success: false,
          error: "Activity ASP data not found",
        };
      }
    }

    let totalAdditionalcharge = 0;
    if (getActivityAspData?.data?.data?.estimatedAdditionalCharge) {
      totalAdditionalcharge = parseFloat(
        getActivityAspData.data.data.estimatedAdditionalCharge
      );
    }

    let taxableValue = serviceCost + totalAdditionalcharge;

    // Calculate GST amount
    const gstPercentage = getTax.dataValues.percentage;
    const gstAmount = calculateGSTAmount(taxableValue, gstPercentage);

    // Calculate the total price including GST
    const totalAmount = (taxableValue + gstAmount).toFixed(2);

    // Continue processing or return the total km and price data as needed
    return {
      success: true,
      payloadData: data,
      data: {
        estimatedTotalKmBetweenLocations: totalKmBetweenLocations,
        estimatedTotalKmDurationBetweenLocations:
          totalKmDurationBetweenLocations,
        estimatedTotalKm: totalKm,
        estimatedTotalDuration: formattedDuration,
        estimatedServiceCost: serviceCost,
        estimatedTotalTax: gstAmount,
        estimatedTotalAmount: totalAmount,
        deliveryRequestPrice: deliveryRequestPrice.dataValues,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

export default new deliveryRequestPriceController();
