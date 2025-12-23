import { Request, Response } from "express";
import { Op, Sequelize } from "sequelize";
import {
  Client,
  VehicleType,
  VehicleMake,
  VehicleModel,
  State,
  City,
  Service,
  SubService,
  Asp,
  Config,
  PaymentMethod,
  CaseCancelReason,
  CaseSubject,
  CaseStatus,
  CallCenter,
  Dealer,
  AspMechanic,
  ImportConfiguration,
  Language,
  CallCenterManager,
  Tax,
  AspActivityStatus,
  ActivityStatus,
} from "../database/models/index";
import Utils from "../lib/utils";

class CommonController {
  constructor() { }

  //USED FOR NON MEMBERSHIP PAYMENT PROCESS && POLICY DETAIL UPDATE PROCESS && MAP VIEW
  //ALSO USED IN VARIOUS PLACES WHICH ARE RELATED TO MASTER DATA
  getMasterDetails = async (req: Request, res: Response) => {
    try {
      const payload = req.body;

      const {
        clientId,
        aspId,
        subServiceId,
        vehicleTypeId,
        vehicleMakeId,
        vehicleModelId,
        stateId,
        cityId,
        // clientIds,
        // clientNames,
        customerStateId,
        customerCityId,
        paymentMethodId,
        cancelReasonId,
        subjectId,
        caseStatusId,
        callCenterId,
        aspIds,
        subServiceIds,
        serviceIds,
        activityStatusIds,
        aspActivityStatusIds,
        subjectIds,
        caseStatusIds,
        pickupDealerId,
        dropDealerId,
        pickupCityId,
        breakdownAreaId,
        getAllCallCenters,
        getAllClients,
        getAllUserAgentLevels,
        aspMechanicId,
        getAspMechanicWithoutValidation,
        additionalServiceId,
        getCaseSubjectWithoutValidation,
        getCaseStatusWithoutValidation,
        getImportConfiguration,
        getAllLanguages,
        getIgstTax,
        getCallCenterWithoutValidation,
        getCallStatusWithoutValidation,
        getPolicyTypeWithoutValidation,
        getAspActivityStatusWithoutValidation,
        getCityWithoutValidation,
        getAspsWithoutValidation,
        dropLocationTypeId,
        getChannelsWithoutValidation,
        getTosWithoutValidation,
        getCallTypesWithoutValidation,
        getServicesWithoutValidation,
        getSubServicesWithoutValidation,
        getReminderPrioritiesWithoutValidation,
        getReminderTypesWithoutValidation,
      } = payload;

      let clientData = null;
      let aspData = null;
      let subServiceData = null;
      let vehicleTypeData = null;
      let vehicleMakeData = null;
      let vehicleModelData = null;
      let stateData = null;
      let cityData = null;
      let customerStateData = null;
      let customerCityData = null;
      let paymentMethodData = null;
      // let clientsData = null;
      // let clientNamesData = null;
      let cancelReasonData = null;
      let subjectData = null;
      let caseStatusData = null;
      let callCenterData = null;
      let aspsInformation = null;
      let subServicesInformation = null;
      let servicesInformation = null;
      let activityStatusesInformation = null;
      let aspActivityStatusesInformation = null;
      let subjectsInformation = null;
      let caseStatusesInformation = null;
      let pickupDealerData = null;
      let dropDealerData = null;
      let pickupCityData = null;
      let breakdownAreaData = null;
      let allCallCenterData = null;
      let allClientData = null;
      let allUserAgentLevelData = null;
      let aspMechanicData = null;
      let aspMechanicWithoutValidationData = null;
      let serviceBasedSubServices = null;
      let caseSubjectWithoutValidationData = null;
      let caseStatusWithoutValidationData = null;
      let importConfigurationData = null;
      let allLanguageData = null;
      let igstTaxData = null;
      let callCenterWithoutValidationData = null;
      let callStatusWithoutValidationData = null;
      let policyTypeWithoutValidationData = null;
      let aspActivityStatusWithoutValidationData = null;
      let cityWithoutValidationData = null;
      let aspsWithoutValidationData = null;
      let dropLocationTypeData = null;
      let channelsWithoutValidationData = null;
      let tosWithoutValidationData = null;
      let callTypesWithoutValidationData = null;
      let servicesWithoutValidationData = null;
      let subServicesWithoutValidationData = null;
      let reminderPrioritiesWithoutValidationData = null;
      let reminderTypesWithoutValidationData = null;

      const [
        clientExists,
        aspExists,
        subServiceExists,
        vehicleTypeExists,
        vehicleMakeExists,
        vehicleModelExists,
        stateExists,
        cityExists,
        customerStateExists,
        customerCityExists,
        paymentMethodExists,
        cancelReasonExists,
        subjectExists,
        caseStatusExists,
        callCenterExists,
        subServices,
        allCallCenterExists,
        allClientExists,
        allUserAgentLevelExists,
        aspMechanicExists,
        aspMechanicWithoutValidationExists,
        serviceBasedSubServiceExists,
        caseSubjectWithoutValidationExists,
        caseStatusWithoutValidationExists,
        importConfigurationExists,
        allLanguageExists,
        igstTaxExists,
        callCenterWithoutValidationExists,
        callStatusWithoutValidationExists,
        policyTypeWithoutValidationExists,
        aspActivityStatusWithoutValidationExists,
        cityWithoutValidationExists,
        aspsWithoutValidationExists,
        dropLocationTypeExists,
        channelsWithoutValidationExists,
        tosWithoutValidationExists,
        callTypesWithoutValidationExists,
        servicesWithoutValidationExists,
        subServicesWithoutValidationExists,
        reminderPrioritiesWithoutValidationExists,
        reminderTypesWithoutValidationExists,
      ]: any = await Promise.all([
        clientId &&
        Utils.findByModelId(Client, clientId, [
          "id",
          "name",
          "aspTollFreeNumber",
          "customerTollFreeNumber",
        ]),
        aspId &&
        Utils.findByModelId(
          Asp,
          aspId,
          [
            "id",
            "code",
            "name",
            "latitude",
            "longitude",
            "hasMechanic",
            "contactNumber",
            "email",
            "workShopName",
            "addressLineOne",
            "addressLineTwo",
          ],
          [
            {
              model: City,
              as: "city",
              attributes: ["id", "name"],
              required: false,
            },
          ]
        ),
        subServiceId &&
        Utils.findByModelId(
          SubService,
          subServiceId,
          ["id", "name", "serviceId", "hasAspAssignment"],
          [
            {
              model: Service,
              as: "service",
              attributes: ["id", "name"],
              required: true,
              paranoid: false,
            },
          ]
        ),
        vehicleTypeId &&
        Utils.findByModelId(VehicleType, vehicleTypeId, ["id", "name"]),
        vehicleMakeId &&
        Utils.findByModelId(VehicleMake, vehicleMakeId, ["id", "name"]),
        vehicleModelId &&
        Utils.findByModelId(VehicleModel, vehicleModelId, [
          "id",
          "name",
          "vehicleMakeId",
          "vehicleTypeId",
        ]),
        stateId && Utils.findByModelId(State, stateId, ["id", "code", "name"]),
        cityId &&
        Utils.findByModelId(
          City,
          cityId,
          ["id", "name", "stateId"],
          [
            {
              model: State,
              as: "state",
              attributes: ["id", "code", "name"],
              required: true,
            },
            {
              model: Config,
              as: "locationType",
              attributes: ["id", "name"],
              required: false,
            },
            {
              model: Config,
              as: "locationCategory",
              attributes: ["id", "name"],
              required: false,
            },
          ]
        ),
        customerStateId &&
        Utils.findByModelId(State, customerStateId, ["id", "code", "name"]),
        customerCityId &&
        Utils.findByModelId(City, customerCityId, ["id", "name", "stateId"]),
        paymentMethodId &&
        Utils.findByModelId(PaymentMethod, paymentMethodId, ["id", "name"]),
        cancelReasonId &&
        Utils.findByModelId(CaseCancelReason, cancelReasonId, ["id", "name"]),
        subjectId &&
        Utils.findByModelId(CaseSubject, subjectId, [
          "id",
          "name",
          "clientId",
        ]),
        caseStatusId &&
        Utils.findByModelId(CaseStatus, caseStatusId, ["id", "name"]),
        callCenterId &&
        Utils.findByModelId(CallCenter, callCenterId, ["id", "name"]),
        SubService.findAll({
          attributes: ["id", "name", "serviceId"],
          paranoid: false,
          include: [
            {
              model: Service,
              as: "service",
              attributes: ["id", "name"],
              required: true,
              paranoid: false,
            },
          ],
        }),
        getAllCallCenters &&
        CallCenter.findAll({
          attributes: ["id", "name"],
          order: [["id", "ASC"]],
          paranoid: false,
        }),
        getAllClients &&
        Client.findAll({
          attributes: ["id", "name", "deletedAt"],
          order: [["id", "ASC"]],
          paranoid: false,
        }),
        getAllUserAgentLevels &&
        Config.findAll({
          where: {
            typeId: 78, //USER AGENT LEVELS
          },
          attributes: ["id", "name"],
          order: [["id", "ASC"]],
        }),

        aspMechanicId &&
        Utils.findByModelId(
          AspMechanic,
          aspMechanicId,
          [
            "id",
            "code",
            "name",
            "email",
            "contactNumber",
            "alternateContactNumber",
            "address",
          ],
          [
            {
              model: Asp,
              attributes: ["id", "code", "name", "workShopName"],
              required: false,
            },
            {
              model: City,
              as: "city",
              attributes: ["id", "name"],
              required: false,
            },
          ]
        ),

        getAspMechanicWithoutValidation &&
        Utils.findByModelId(
          AspMechanic,
          getAspMechanicWithoutValidation,
          [
            "id",
            "code",
            "name",
            "email",
            "contactNumber",
            "alternateContactNumber",
            "address",
          ],
          [
            {
              model: Asp,
              attributes: ["id", "code", "name", "workShopName"],
              required: false,
            },
            {
              model: City,
              as: "city",
              attributes: ["id", "name"],
              required: false,
            },
          ]
        ),

        additionalServiceId &&
        SubService.findAll({
          attributes: ["id"],
          where: {
            serviceId: additionalServiceId,
          },
        }),

        getCaseSubjectWithoutValidation &&
        Utils.findByModelId(CaseSubject, getCaseSubjectWithoutValidation, [
          "id",
          "name",
        ]),

        getCaseStatusWithoutValidation &&
        Utils.findByModelId(CaseStatus, getCaseStatusWithoutValidation, [
          "id",
          "name",
        ]),

        getImportConfiguration &&
        ImportConfiguration.findAll({
          attributes: ["id", "excelColumnName", "isRequired"],
          where: {
            importTypeId: getImportConfiguration,
          },
          order: [["id", "ASC"]],
          paranoid: false,
        }),

        getAllLanguages &&
        Language.findAll({
          attributes: ["id", "name"],
          order: [["id", "ASC"]],
          paranoid: false,
        }),

        getIgstTax &&
        Tax.findOne({
          attributes: ["id", "percentage"],
          where: {
            id: 3, //IGST
          },
        }),

        getCallCenterWithoutValidation &&
        Utils.findByModelId(CallCenter, getCallCenterWithoutValidation, [
          "id",
          "name",
          "spocEmailIds",
        ]),

        getCallStatusWithoutValidation &&
        Utils.findByModelId(Config, getCallStatusWithoutValidation, [
          "id",
          "name",
        ]),

        getPolicyTypeWithoutValidation &&
        Utils.findByModelId(Config, getPolicyTypeWithoutValidation, [
          "id",
          "name",
        ]),
        getAspActivityStatusWithoutValidation &&
        Utils.findByModelId(
          AspActivityStatus,
          getAspActivityStatusWithoutValidation,
          ["id", "name"]
        ),

        getCityWithoutValidation &&
        Utils.findByModelId(City, getCityWithoutValidation,
          [
            "id",
            "name",
            "stateId",
          ],
          [
            {
              model: State,
              as: "state",
              attributes: ["id", "name"],
              required: false,
            },
          ]
        ),

        getAspsWithoutValidation &&
        Asp.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: getAspsWithoutValidation,
            },
          },
          paranoid: false,
        }),
        dropLocationTypeId &&
        Utils.findByModelId(Config, dropLocationTypeId, [
          "id",
          "name",
        ]),
        getChannelsWithoutValidation &&
        Config.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: Array.isArray(getChannelsWithoutValidation)
                ? getChannelsWithoutValidation
                : [getChannelsWithoutValidation],
            },
            typeId: 26, // CHANNELS
          },
          paranoid: false,
        }),
        getTosWithoutValidation &&
        Config.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: Array.isArray(getTosWithoutValidation)
                ? getTosWithoutValidation
                : [getTosWithoutValidation],
            },
            typeId: 27, // INTERACTION TO TYPES
          },
          paranoid: false,
        }),
        getCallTypesWithoutValidation &&
        Config.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: Array.isArray(getCallTypesWithoutValidation)
                ? getCallTypesWithoutValidation
                : [getCallTypesWithoutValidation],
            },
            typeId: 28, // INTERACTION CALL TYPES
          },
          paranoid: false,
        }),
        getServicesWithoutValidation &&
        Service.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: getServicesWithoutValidation,
            },
          },
          paranoid: false,
        }),
        getSubServicesWithoutValidation &&
        SubService.findAll({
          attributes: ["id", "name", "serviceId"],
          where: {
            id: {
              [Op.in]: getSubServicesWithoutValidation,
            },
          },
          paranoid: false,
        }),
        getReminderPrioritiesWithoutValidation &&
        Config.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: getReminderPrioritiesWithoutValidation,
            },
            typeId: 49, // REMINDER PRIORITIES
          },
          paranoid: false,
        }),
        getReminderTypesWithoutValidation &&
        Config.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: getReminderTypesWithoutValidation,
            },
            typeId: 50, // REMINDER TYPES
          },
          paranoid: false,
        }),
      ]);

      if (aspIds && aspIds.length > 0) {
        const aspDetails: any = await Asp.findAll({
          attributes: ["id", "name", "code", "latitude", "longitude"],
          where: {
            id: {
              [Op.in]: aspIds,
            },
          },
          paranoid: false,
        });

        if (aspDetails.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Asp details not found",
          });
        }
        aspsInformation = aspDetails;
      }

      if (subServiceIds && subServiceIds.length > 0) {
        const subServiceDetails: any = await SubService.findAll({
          attributes: ["id", "name", "serviceId"],
          where: {
            id: {
              [Op.in]: subServiceIds,
            },
          },
          paranoid: false,
        });

        if (subServiceDetails.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Sub service details not found",
          });
        }
        subServicesInformation = subServiceDetails;
      }

      if (serviceIds && serviceIds.length > 0) {
        const serviceDetails: any = await Service.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: serviceIds,
            },
          },
          paranoid: false,
        });

        if (serviceDetails.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Service details not found",
          });
        }
        servicesInformation = serviceDetails;
      }

      if (activityStatusIds && activityStatusIds.length > 0) {
        const activityStatusDetails: any = await ActivityStatus.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: activityStatusIds,
            },
          },
          paranoid: false,
        });

        if (activityStatusDetails.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Activity status details not found",
          });
        }
        activityStatusesInformation = activityStatusDetails;
      }

      if (aspActivityStatusIds && aspActivityStatusIds.length > 0) {
        const aspActivityStatusDetails: any = await AspActivityStatus.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: aspActivityStatusIds,
            },
          },
        });

        if (aspActivityStatusDetails.length == 0) {
          return res.status(200).json({
            success: false,
            error: "ASP activity status details not found",
          });
        }
        aspActivityStatusesInformation = aspActivityStatusDetails;
      }

      if (subjectIds && subjectIds.length > 0) {
        const subjectDetails: any = await CaseSubject.findAll({
          attributes: ["id", "name", "clientId"],
          where: {
            id: {
              [Op.in]: subjectIds,
            },
          },
          paranoid: false,
        });

        if (subjectDetails.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Subject details not found",
          });
        }
        subjectsInformation = subjectDetails;
      }

      if (caseStatusIds && caseStatusIds.length > 0) {
        const caseStatusDetails: any = await CaseStatus.findAll({
          attributes: ["id", "name"],
          where: {
            id: {
              [Op.in]: caseStatusIds,
            },
          },
          paranoid: false,
        });

        if (caseStatusDetails.length == 0) {
          return res.status(200).json({
            success: false,
            error: "Case status details not found",
          });
        }
        caseStatusesInformation = caseStatusDetails;
      }

      const pickupDealerExists = pickupDealerId
        ? await Utils.findByModelId(
          Dealer,
          pickupDealerId,
          [
            "id",
            "name",
            "lat",
            "long",
            "correspondenceAddress",
            "stateId",
            "cityId",
            "pincode",
          ],
          { model: City, attributes: ["id", "name", "rmId"], required: false }
        )
        : null;

      const dropDealerExists = dropDealerId
        ? await Utils.findByModelId(Dealer, dropDealerId, [
          "id",
          "name",
          "lat",
          "long",
          "correspondenceAddress",
          "stateId",
          "cityId",
          "pincode",
        ])
        : null;

      const pickupCityExists = pickupCityId
        ? await Utils.findByModelId(City, pickupCityId, ["id", "name", "rmId"])
        : null;

      const breakdownAreaExists = breakdownAreaId
        ? await Utils.findByModelId(City, breakdownAreaId, [
          "id",
          "name",
          "rmId",
        ])
        : null;

      if (clientId && !clientExists) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }
      if (aspId && !aspExists) {
        return res.status(200).json({
          success: false,
          error: "Asp not found",
        });
      }
      if (subServiceId && !subServiceExists) {
        return res.status(200).json({
          success: false,
          error: "Sub service not found",
        });
      }
      if (vehicleTypeId && !vehicleTypeExists) {
        return res.status(200).json({
          success: false,
          error: "Vehicle type not found",
        });
      }
      if (vehicleMakeId && !vehicleMakeExists) {
        return res.status(200).json({
          success: false,
          error: "Vehicle make not found",
        });
      }
      if (vehicleModelId && !vehicleModelExists) {
        return res.status(200).json({
          success: false,
          error: "Vehicle model not found",
        });
      }
      if (stateId && !stateExists) {
        return res.status(200).json({
          success: false,
          error: "State not found",
        });
      }
      if (cityId && !cityExists) {
        return res.status(200).json({
          success: false,
          error: "City not found",
        });
      }
      if (customerStateId && !customerStateExists) {
        return res.status(200).json({
          success: false,
          error: "Customer state not found",
        });
      }
      if (customerCityId && !customerCityExists) {
        return res.status(200).json({
          success: false,
          error: "Customer city not found",
        });
      }
      if (paymentMethodId && !paymentMethodExists) {
        return res.status(200).json({
          success: false,
          error: "Payment method detail not found",
        });
      }
      if (cancelReasonId && !cancelReasonExists) {
        return res.status(200).json({
          success: false,
          error: "Case cancel reason not found",
        });
      }
      if (subjectId && !subjectExists) {
        return res.status(200).json({
          success: false,
          error: "Case subject not found",
        });
      }
      if (caseStatusId && !caseStatusExists) {
        return res.status(200).json({
          success: false,
          error: "Case status not found",
        });
      }
      if (callCenterId && !callCenterExists) {
        return res.status(200).json({
          success: false,
          error: "Call center not found",
        });
      }
      if (aspMechanicId && !aspMechanicExists) {
        return res.status(200).json({
          success: false,
          error: "Asp mechanic not found",
        });
      }

      if (pickupDealerId && !pickupDealerExists) {
        return res.status(200).json({
          success: false,
          error: "Pickup dealer not found",
        });
      }

      if (dropDealerId && !dropDealerExists) {
        return res.status(200).json({
          success: false,
          error: "Drop dealer not found",
        });
      }

      if (pickupCityId && !pickupCityExists) {
        return res.status(200).json({
          success: false,
          error: "Pickup city not found",
        });
      }

      if (breakdownAreaId && !breakdownAreaExists) {
        return res.status(200).json({
          success: false,
          error: "Breakdown area not found",
        });
      }

      clientData = clientExists;
      aspData = aspExists;
      subServiceData = subServiceExists;
      vehicleTypeData = vehicleTypeExists;
      vehicleMakeData = vehicleMakeExists;
      vehicleModelData = vehicleModelExists;
      stateData = stateExists;
      cityData = cityExists;
      stateData = cityExists?.state || null;
      customerStateData = customerStateExists;
      customerCityData = customerCityExists;
      paymentMethodData = paymentMethodExists;
      cancelReasonData = cancelReasonExists;
      subjectData = subjectExists;
      caseStatusData = caseStatusExists;
      callCenterData = callCenterExists;
      pickupDealerData = pickupDealerExists;
      dropDealerData = dropDealerExists;
      pickupCityData = pickupCityExists;
      breakdownAreaData = breakdownAreaExists;
      allCallCenterData = allCallCenterExists;
      allClientData = allClientExists;
      allUserAgentLevelData = allUserAgentLevelExists;
      aspMechanicData = aspMechanicExists;
      aspMechanicWithoutValidationData = aspMechanicWithoutValidationExists;
      serviceBasedSubServices = serviceBasedSubServiceExists;

      caseSubjectWithoutValidationData = caseSubjectWithoutValidationExists;
      caseStatusWithoutValidationData = caseStatusWithoutValidationExists;
      importConfigurationData = importConfigurationExists;
      allLanguageData = allLanguageExists;
      igstTaxData = igstTaxExists;
      callCenterWithoutValidationData = callCenterWithoutValidationExists;
      callStatusWithoutValidationData = callStatusWithoutValidationExists;
      policyTypeWithoutValidationData = policyTypeWithoutValidationExists;
      aspActivityStatusWithoutValidationData = aspActivityStatusWithoutValidationExists;
      cityWithoutValidationData = cityWithoutValidationExists;
      aspsWithoutValidationData = aspsWithoutValidationExists;
      dropLocationTypeData = dropLocationTypeExists;
      channelsWithoutValidationData = channelsWithoutValidationExists;
      tosWithoutValidationData = tosWithoutValidationExists;
      callTypesWithoutValidationData = callTypesWithoutValidationExists;
      servicesWithoutValidationData = servicesWithoutValidationExists;
      subServicesWithoutValidationData = subServicesWithoutValidationExists;
      reminderPrioritiesWithoutValidationData = reminderPrioritiesWithoutValidationExists;
      reminderTypesWithoutValidationData = reminderTypesWithoutValidationExists;
      // if (clientIds && clientIds.length > 0) {
      //   const clientDetails: any = await Client.findAll({
      //     where: {
      //       id: {
      //         [Op.in]: clientIds,
      //       },
      //     },
      //     attributes: ["id", "name"],
      //     paranoid: false,
      //   });

      //   if (clientDetails.length == 0) {
      //     return res.status(200).json({
      //       success: false,
      //       error: "Client not found",
      //     });
      //   }
      //   clientsData = clientDetails;
      // }

      // if (clientNames && clientNames.length > 0) {
      //   const clientNameDetails: any = await Client.findAll({
      //     where: {
      //       name: {
      //         [Op.in]: clientNames,
      //       },
      //     },
      //     attributes: ["id", "name"],
      //     paranoid: false,
      //   });

      //   if (clientNameDetails.length == 0) {
      //     return res.status(200).json({
      //       success: false,
      //       error: "Client not found",
      //     });
      //   }
      //   clientNamesData = clientNameDetails;
      // }

      //GET TOWING SUB SERVICES IDS
      const towingSubServiceDetails = await SubService.findAll({
        attributes: ["id"],
        where: {
          serviceId: 1, //Towing
        },
        paranoid: false,
      });

      const data = {
        client: clientData,
        asp: aspData,
        subService: subServiceData,
        vehicleType: vehicleTypeData,
        vehicleMake: vehicleMakeData,
        vehicleModel: vehicleModelData,
        state: stateData,
        city: cityData,
        customerState: customerStateData,
        customerCity: customerCityData,
        paymentMethod: paymentMethodData,
        // clients: clientsData,
        // clientNames: clientNamesData,
        cancelReason: cancelReasonData,
        subject: subjectData,
        caseStatus: caseStatusData,
        callCenter: callCenterData,
        aspsInformation,
        subServicesInformation,
        servicesInformation,
        activityStatusesInformation,
        aspActivityStatusesInformation,
        subjectsInformation,
        caseStatusesInformation,
        towingSubServiceDetails,
        pickupDealer: pickupDealerData,
        dropDealer: dropDealerData,
        pickupCity: pickupCityData,
        breakdownArea: breakdownAreaData,
        allSubServices: subServices,
        allCallCenters: allCallCenterData,
        allClients: allClientData,
        allUserAgentLevels: allUserAgentLevelData,
        aspMechanic: aspMechanicData,
        aspMechanicWithoutValidation: aspMechanicWithoutValidationData,
        serviceBasedSubServices: serviceBasedSubServices,
        caseSubjectWithoutValidation: caseSubjectWithoutValidationData,
        caseStatusWithoutValidation: caseStatusWithoutValidationData,
        importConfiguration: importConfigurationData,
        allLanguages: allLanguageData,
        igstTax: igstTaxData,
        callCenterWithoutValidation: callCenterWithoutValidationData,
        callStatusWithoutValidation: callStatusWithoutValidationData,
        policyTypeWithoutValidation: policyTypeWithoutValidationData,
        aspActivityStatusWithoutValidation: aspActivityStatusWithoutValidationData,
        cityWithoutValidation: cityWithoutValidationData,
        aspsWithoutValidation: aspsWithoutValidationData,
        dropLocationType: dropLocationTypeData,
        channelsWithoutValidation: channelsWithoutValidationData,
        tosWithoutValidation: tosWithoutValidationData,
        callTypesWithoutValidation: callTypesWithoutValidationData,
        servicesWithoutValidation: servicesWithoutValidationData,
        subServicesWithoutValidation: subServicesWithoutValidationData,
        reminderPrioritiesWithoutValidation: reminderPrioritiesWithoutValidationData,
        reminderTypesWithoutValidation: reminderTypesWithoutValidationData,
      };

      return res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  //USED IN CASE, SUB SERVICE, REIMBURSEMENT LISTING API
  getCitiesByRole = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const cities = await City.findAll({
        attributes: ["id", "name", "stateId", "locationCategoryId"],
        where: payload.where,
        paranoid: false,
      });

      if (cities.length == 0) {
        return res.status(200).json({
          success: false,
          error: "City not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: cities,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  //USED IN CASE, SUB SERVICE, REIMBURSEMENT LISTING API
  getCallCentersByRole = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      let callCenters: any = [];
      if (payload.type == 1) {
        //Get call center by call center head
        callCenters = await CallCenter.findAll({
          attributes: ["id", "name"],
          where: {
            callCentreHeadId: payload.userId,
          },
          paranoid: false,
        });
      }

      if (payload.type == 2) {
        //Get call center by call center manager
        const callCenterManagers = await CallCenterManager.findAll({
          attributes: ["id", "callCenterId"],
          where: {
            managerId: payload.userId,
          },
        });

        const callCenterIds = callCenterManagers.map(
          (callCenterManager: any) => callCenterManager.callCenterId
        );

        callCenters = await CallCenter.findAll({
          attributes: ["id", "name"],
          where: {
            id: { [Op.in]: callCenterIds },
          },
          paranoid: false,
        });
      }

      if (callCenters.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Call center not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: callCenters,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  //USED IN CASE, SUB SERVICE, REIMBURSEMENT LISTING API
  getClientsByRole = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const clients = await Client.findAll({
        attributes: ["id", "name"],
        where: payload.where,
        paranoid: false,
      });

      if (clients.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: clients,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new CommonController();
