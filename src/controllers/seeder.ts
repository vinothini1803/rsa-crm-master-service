import { Op } from "sequelize";
import * as ExcelJS from "exceljs";
import path from "path";
import axios from "axios";
import config from "../config/config.json";
import {
  VehicleType,
  VehicleMake,
  VehicleModel,
  Client,
  Country,
  State,
  City,
  Dealer,
  CaseSubject,
  CaseSubjectQuestionnaire,
  AnswerType,
  Service,
  SubService,
  ConfigType,
  Config,
  Asp,
  CaseStatus,
  ActivityStatus,
  AspActivityStatus,
  CaseCancelReason,
  AspActivityRejectReason,
  ActivityFinanceStatus,
  PaymentMethod,
  Inventory,
  CallCenter,
  AspMechanic,
  AdditionalCharge,
  Tax,
  DeliveryRequestPrice,
  ActivityAppStatus,
  AspActivityCancelReason,
  NewCaseEmailReceiver,
  FinancialYears,
  SerialNumberSegments,
  SerialNumberCategories,
  SerialNumberGroups,
  SerialNumberGroupSerialNumberSegments,
  MailConfiguration,
  Disposition,
  Language,
  ConditionOfVehicle,
  PolicyPremium,
  ManualLocationReason,
  SubjectService,
  Entitlement,
  NspFilter,
  Taluk,
  District,
  NearestCity,
  Shift,
  ServiceOrganisation,
  OwnPatrolVehicle,
  AspMechanicSubService,
  DropDealer,
  EscalationReason,
  SystemIssueReason,
  FuelType,
  SubServiceEntitlement,
  ImportConfiguration,
  Company,
  OwnPatrolVehicleHelper,
  FeedbackQuestion,
} from "../database/models/index";
import Utils from "../lib/utils";
import { uatAspSeeder } from "./asp";
import { uatDealerSeeder } from "./dealer";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class SeederController {
  constructor() { }

  public async seed(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./masterData.xlsx")
      );

      //VEHICLE TYPES
      const vehicleTypeWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await vehicleTypeWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (id && name) {
              const [vehicleType, created] = await VehicleType.findOrCreate({
                where: { id: id },
                defaults: {
                  name: name,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            }
          }
        }
      );

      //VEHICLE MAKES
      const vehicleMakeWorksheet: any = workbook.getWorksheet(2); // Assuming data is in the first worksheet
      await vehicleMakeWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name, deletedAt] = row.values;
            if (name) {
              let deletedAtVal = null;
              if (typeof deletedAt !== "undefined") {
                deletedAtVal = new Date();
              }
              const [vehicleMake, created] = await VehicleMake.findOrCreate({
                where: { id: id },
                defaults: {
                  name: name,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  deletedAt: deletedAtVal,
                },
              });
            }
          }
        }
      );

      //VEHICLE MODELS
      const vehicleModelWorksheet: any = workbook.getWorksheet(3); // Assuming data is in the first worksheet
      await vehicleModelWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name, vehicleMake, vehicleType, deletedAt] =
              row.values;
            if (name) {
              let vehicleMakeVal = null;
              if (typeof vehicleMake !== "undefined") {
                const vehicleMakeExist: any = await VehicleMake.findOne({
                  where: { name: vehicleMake },
                  attributes: ["id"],
                });
                vehicleMakeVal = vehicleMakeExist ? vehicleMakeExist.id : null;
              }

              let vehicleTypeVal = null;
              if (typeof vehicleType !== "undefined") {
                const vehicleTypeExist: any = await VehicleType.findOne({
                  where: { name: vehicleType },
                  attributes: ["id"],
                });
                vehicleTypeVal = vehicleTypeExist ? vehicleTypeExist.id : null;
              }

              let deletedAtVal = null;
              if (typeof deletedAt !== "undefined") {
                deletedAtVal = new Date();
              }

              const [vehicleModel, created] = await VehicleModel.findOrCreate({
                where: { id: id },
                defaults: {
                  name: name,
                  vehicleMakeId: vehicleMakeVal,
                  vehicleTypeId: vehicleTypeVal,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  deletedAt: deletedAtVal,
                },
              });
            }
          }
        }
      );

      //CLIENTS
      const clientWorksheet: any = workbook.getWorksheet(4); // Assuming data is in the first worksheet
      await clientWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name, phoneNumber, email, deletedAt] = row.values;
          if (name) {
            let deletedAtVal = null;
            if (typeof deletedAt !== "undefined") {
              deletedAtVal = new Date();
            }
            const [client, created] = await Client.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
                email: email ? email : null,
                contactNumber: phoneNumber ? phoneNumber : null,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: deletedAtVal,
              },
            });
          }
        }
      });

      //COUNTRIES
      const conuntryWorksheet: any = workbook.getWorksheet(5); // Assuming data is in the first worksheet
      const stateWorksheet: any = workbook.getWorksheet(6); // Assuming data is in the first worksheet
      const cityWorksheet: any = workbook.getWorksheet(7); // Assuming data is in the first worksheet

      await Promise.all([
        (async () => {
          await conuntryWorksheet.eachRow(
            async (row: any, rowNumber: number) => {
              if (rowNumber !== 1) {
                const [, id, code, name] = row.values;
                if (code && name) {
                  const [country, created] = await Country.findOrCreate({
                    where: { id: id },
                    defaults: {
                      code: code,
                      name: name,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    },
                  });
                }
              }
            }
          );
        })(),
        (async () => {
          await stateWorksheet.eachRow(async (row: any, rowNumber: number) => {
            if (rowNumber !== 1) {
              const [, id, code, name, country, deletedAt] = row.values;
              if (name) {
                let countryVal = null;
                if (typeof country !== "undefined") {
                  const countryExist: any = await Country.findOne({
                    where: { name: country },
                    attributes: ["id"],
                  });
                  countryVal = countryExist ? countryExist.id : null;
                }
                let deletedAtVal = null;
                if (typeof deletedAt !== "undefined") {
                  deletedAtVal = new Date();
                }
                const [state, created] = await State.findOrCreate({
                  where: { id: id },
                  defaults: {
                    code: code ? code : null,
                    name: name,
                    countryId: countryVal,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: deletedAtVal,
                  },
                });
              }
            }
          });
        })(),
        (async () => {
          await cityWorksheet.eachRow(async (row: any, rowNumber: number) => {
            if (rowNumber !== 1) {
              const [, id, name, state, deletedAt] = row.values;
              if (name) {
                let stateVal = null;
                if (typeof state !== "undefined") {
                  const stateExist: any = await State.findOne({
                    where: { name: state },
                    attributes: ["id"],
                  });
                  stateVal = stateExist ? stateExist.id : null;
                }
                // console.log(state, stateVal);
                let deletedAtVal = null;
                if (typeof deletedAt !== "undefined") {
                  deletedAtVal = new Date();
                }

                let cityData = {
                  id: id,
                  name: name,
                  stateId: stateVal,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  deletedAt: deletedAtVal,
                };
                const cityExist = await City.findOne({
                  where: { id: id },
                });
                if (!cityExist) {
                  await City.create(cityData);
                } else {
                  await City.update(cityData, { where: { id: id } });
                }
              }
            }
          });
        })(),
      ]);

      //DEALERS
      const dealerWorksheet: any = workbook.getWorksheet(8); // Assuming data is in the first worksheet
      await dealerWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [
            ,
            id,
            groupCode,
            code,
            name,
            mobile,
            email,
            client,
            addressLineOne,
            addressLineTwo,
            correspondenceAddress,
            state,
            city,
            area,
            pincode,
            lat,
            long,
            walletBalance,
            deletedAt,
          ] = row.values;
          if (name) {
            console.log(groupCode);

            let clientVal = null;
            if (typeof client !== "undefined") {
              const clientExist: any = await Client.findOne({
                where: { name: client },
                attributes: ["id"],
              });
              clientVal = clientExist ? clientExist.id : null;
            }

            let stateVal = null;
            if (typeof state !== "undefined") {
              const stateExist: any = await State.findOne({
                where: { name: state },
                attributes: ["id"],
              });
              stateVal = stateExist ? stateExist.id : null;
            }

            let cityVal = null;
            if (typeof city !== "undefined") {
              const cityExist: any = await City.findOne({
                where: { name: city },
                attributes: ["id"],
              });
              cityVal = cityExist ? cityExist.id : null;
            }

            let deletedAtVal = null;
            if (typeof deletedAt !== "undefined") {
              deletedAtVal = new Date();
            }

            let dealerData = {
              id: id,
              groupCode: groupCode,
              code: code,
              name: name,
              mobileNumber: mobile,
              email: email,
              clientId: clientVal,
              addressLineOne: addressLineOne,
              addressLineTwo: addressLineTwo,
              correspondenceAddress: correspondenceAddress,
              stateId: stateVal,
              cityId: cityVal,
              area: area,
              pincode: pincode,
              lat: lat,
              long: long,
              walletBalance: walletBalance,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: deletedAtVal,
            };
            const dealerExist = await Dealer.findOne({
              where: { id: id },
            });
            if (dealerExist) {
              await Dealer.update(dealerData, { where: { id: id } });
            } else {
              await Dealer.create(dealerData);
            }
          }
        }
      });

      //SUBJECTS
      const subjectWorksheet: any = workbook.getWorksheet(9); // Assuming data is in the first worksheet
      await subjectWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name, client, deletedAt] = row.values;
          if (name) {
            let clientVal = null;
            if (typeof client !== "undefined") {
              const clientExist: any = await Client.findOne({
                where: { name: client },
                attributes: ["id"],
              });
              clientVal = clientExist ? clientExist.id : null;
            }
            let deletedAtVal = null;
            if (typeof deletedAt !== "undefined") {
              deletedAtVal = new Date();
            }
            const [subject, created] = await CaseSubject.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
                clientId: clientVal,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: deletedAtVal,
              },
            });
          }
        }
      });

      //SERVICES
      const serviceWorksheet: any = workbook.getWorksheet(10); // Assuming data is in the first worksheet
      await serviceWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name, subject] = row.values;
          if (name) {
            let subjectVal = null;
            if (typeof subject !== "undefined") {
              const subjectExist: any = await CaseSubject.findOne({
                where: { name: subject },
                attributes: ["id"],
              });
              subjectVal = subjectExist ? subjectExist.id : null;
            }
            const [service, created] = await Service.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
                subjectId: subjectVal,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }
      });

      //SUB SERVICES
      const subServiceWorksheet: any = workbook.getWorksheet(11); // Assuming data is in the first worksheet
      await subServiceWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name, subject, service] = row.values;
          if (name) {
            let serviceVal = null;
            if (
              typeof subject !== "undefined" &&
              typeof service !== "undefined"
            ) {
              const subjectExist: any = await CaseSubject.findOne({
                where: { name: subject },
                attributes: ["id"],
              });
              if (subjectExist) {
                const serviceExist: any = await Service.findOne({
                  where: { name: service, subjectId: subjectExist.id },
                  attributes: ["id"],
                });
                serviceVal = serviceExist ? serviceExist.id : null;
              }
            }
            const [subService, created] = await SubService.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
                serviceId: serviceVal,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }
      });

      //CONFIG TYPES
      const configTypeWorksheet: any = workbook.getWorksheet(12); // Assuming data is in the first worksheet
      await configTypeWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name] = row.values;
          if (name) {
            const [configType, created] = await ConfigType.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
              },
            });
          }
        }
      });

      //CONFIGS
      const configWorksheet: any = workbook.getWorksheet(13); // Assuming data is in the first worksheet
      await configWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, typeId, name] = row.values;
          if (name && typeId) {
            const [config, created] = await Config.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
                typeId: typeId,
              },
            });
          }
        }
      });

      //ASPS
      const aspWorksheet: any = workbook.getWorksheet(14); // Assuming data is in the first worksheet
      await aspWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [
            ,
            id,
            tier,
            axaptaCode,
            salutation,
            workingHour,
            code,
            name,
            workshopName,
            whatsappNumber,
            contactNumber,
            rmName,
            rmContactNumber,
            lat,
            long,
            addressLineOne,
            addressLineTwo,
            state,
            city,
            location,
            pincode,
            hasMechanic,
            deletedAt,
          ] = row.values;
          if (name) {
            let salutationVal = null;
            if (typeof salutation !== "undefined") {
              const salutationExist: any = await Config.findOne({
                where: { name: salutation },
                attributes: ["id"],
              });
              salutationVal = salutationExist ? salutationExist.id : null;
            }

            let workingHourVal = null;
            if (typeof workingHour !== "undefined") {
              const workingHourExist: any = await Config.findOne({
                where: { name: workingHour },
                attributes: ["id"],
              });
              workingHourVal = workingHourExist ? workingHourExist.id : null;
            }

            let stateVal = null;
            if (typeof state !== "undefined") {
              const stateExist: any = await State.findOne({
                where: { name: state },
                attributes: ["id"],
              });
              stateVal = stateExist ? stateExist.id : null;
            }

            let cityVal = null;
            if (typeof city !== "undefined") {
              const cityExist: any = await City.findOne({
                where: { name: city },
                attributes: ["id"],
              });
              cityVal = cityExist ? cityExist.id : null;
            }

            let deletedAtVal = null;
            if (typeof deletedAt !== "undefined") {
              deletedAtVal = new Date();
            }
            const [asp, created] = await Asp.findOrCreate({
              where: { id: id },
              defaults: {
                tier: tier,
                axaptaCode: axaptaCode ? axaptaCode : null,
                salutationId: salutationVal,
                workingHourId: workingHourVal,
                code: code,
                name: name ? name : null,
                workshopName: workshopName ? workshopName : null,
                whatsAppNumber: whatsappNumber ? whatsappNumber : null,
                contactNumber: contactNumber ? contactNumber : null,
                rmName: rmName,
                rmContactNumber: rmContactNumber,
                latitude: lat ? lat : null,
                longitude: long ? long : null,
                addressLineOne: addressLineOne ? addressLineOne : null,
                addressLineTwo: addressLineTwo ? addressLineTwo : null,
                stateId: stateVal,
                cityId: cityVal,
                location: location ? location : null,
                pincode: pincode ? pincode : null,
                hasMechanic: hasMechanic,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: deletedAtVal,
              },
            });
          }
        }
      });

      //CASE STATUSES
      const caseStatusWorksheet: any = workbook.getWorksheet(15); // Assuming data is in the first worksheet
      await caseStatusWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name] = row.values;
          if (name) {
            const [caseStatus, created] = await CaseStatus.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }
      });

      //ACTIVITY STATUSES
      const activityStatusWorksheet: any = workbook.getWorksheet(16); // Assuming data is in the first worksheet
      await activityStatusWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (name) {
              const [activityStatus, created] =
                await ActivityStatus.findOrCreate({
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //ASP ACTIVITY STATUSES
      const aspActivityStatusWorksheet: any = workbook.getWorksheet(17); // Assuming data is in the first worksheet
      await aspActivityStatusWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (name) {
              const [aspActivityStatus, created] =
                await AspActivityStatus.findOrCreate({
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //CASE CANCEL REASONS
      const caseCancelReasonWorksheet: any = workbook.getWorksheet(18); // Assuming data is in the first worksheet
      await caseCancelReasonWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (name) {
              const [caseCancelReason, created] =
                await CaseCancelReason.findOrCreate({
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //ASP ACTIVITY REJECT REASONS
      const aspActivityReasonWorksheet: any = workbook.getWorksheet(19); // Assuming data is in the first worksheet
      await aspActivityReasonWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (name) {
              const [aspActivityRejectReason, created] =
                await AspActivityRejectReason.findOrCreate({
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //ASP ACTIVITY REJECT REASONS
      const activityFinanceStatusWorksheet: any = workbook.getWorksheet(20); // Assuming data is in the first worksheet
      await activityFinanceStatusWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (name) {
              const [activityFinanceStatus, created] =
                await ActivityFinanceStatus.findOrCreate({
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //PAMENT METHODS
      const paymentMethodWorksheet: any = workbook.getWorksheet(21); // Assuming data is in the first worksheet
      await paymentMethodWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (name) {
              const [paymentMethod, created] = await PaymentMethod.findOrCreate(
                {
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                }
              );
            }
          }
        }
      );

      //INVENTORIES
      const inventoryWorksheet: any = workbook.getWorksheet(22); // Assuming data is in the first worksheet
      await inventoryWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name, categoryId] = row.values;
          if (name) {
            const [inventory, created] = await Inventory.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
                categoryId: categoryId,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }
      });

      //CALL CENTERS
      const callCenterWorksheet: any = workbook.getWorksheet(23); // Assuming data is in the first worksheet
      await callCenterWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name, address, deletedAt] = row.values;
          if (name) {
            let deletedAtVal = null;
            if (typeof deletedAt !== "undefined") {
              deletedAtVal = new Date();
            }
            const [callCenter, created] = await CallCenter.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
                address: address,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: deletedAtVal,
              },
            });
          }
        }
      });

      //ASP MECHANICS
      const aspMechanicWorksheet: any = workbook.getWorksheet(24); // Assuming data is in the first worksheet
      await aspMechanicWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [
              ,
              id,
              aspCode,
              code,
              name,
              contactNumber,
              lat,
              long,
              deletedAt,
            ] = row.values;
            if (name) {
              let aspCodeVal = null;
              if (typeof aspCode !== "undefined") {
                const aspCodeExist: any = await Asp.findOne({
                  where: { code: aspCode },
                  attributes: ["id"],
                });
                aspCodeVal = aspCodeExist ? aspCodeExist.id : null;
              }
              let deletedAtVal = null;
              if (typeof deletedAt !== "undefined") {
                deletedAtVal = new Date();
              }
              const [aspMechanic, created] = await AspMechanic.findOrCreate({
                where: { id: id },
                defaults: {
                  aspId: aspCodeVal,
                  name: name,
                  code: code,
                  contactNumber: contactNumber,
                  latitude: lat,
                  longitude: long,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  deletedAt: deletedAtVal,
                },
              });
            }
          }
        }
      );

      //ADDITIONAL CHARGES
      const additionalChargeWorksheet: any = workbook.getWorksheet(25); // Assuming data is in the first worksheet
      await additionalChargeWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (name) {
              const [additionalCharge, created] =
                await AdditionalCharge.findOrCreate({
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //TAXES
      const taxWorksheet: any = workbook.getWorksheet(26); // Assuming data is in the first worksheet
      await taxWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name, percentage] = row.values;
          if (name) {
            const [tax, created] = await Tax.findOrCreate({
              where: { id: id },
              defaults: {
                name: name,
                percentage: percentage,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        }
      });

      //DELIVERY REQUEST PRICES
      const deliveryRequestPriceWorksheet: any = workbook.getWorksheet(27); // Assuming data is in the first worksheet
      await deliveryRequestPriceWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, client, rangeLimit, belowRangePrice, aboveRangePrice] =
              row.values;
            if (client) {
              let clientVal = null;
              if (typeof client !== "undefined") {
                const clientExist: any = await Client.findOne({
                  where: { name: client },
                  attributes: ["id"],
                });
                clientVal = clientExist ? clientExist.id : null;
              }

              const [deliveryRequestPrice, created] =
                await DeliveryRequestPrice.findOrCreate({
                  where: { id: id },
                  defaults: {
                    clientId: clientVal,
                    rangeLimit: rangeLimit,
                    belowRangePrice: belowRangePrice,
                    aboveRangePrice: aboveRangePrice,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //ACTIVITY APP STATUSES
      const activityAppStatusWorksheet: any = workbook.getWorksheet(28); // Assuming data is in the first worksheet
      await activityAppStatusWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (name) {
              const [activityAppStatus, created] =
                await ActivityAppStatus.findOrCreate({
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //ASP ACTIVITY CANCEL REASONS
      const aspActivityCancelReasonWorksheet: any = workbook.getWorksheet(29); // Assuming data is in the first worksheet
      await aspActivityCancelReasonWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (name) {
              const [aspActivityCancelReason, created] =
                await AspActivityCancelReason.findOrCreate({
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //NEW CASE EMAIL RECEIVERS
      const newCaseEmailReceiverWorksheet: any = workbook.getWorksheet(30); // Assuming data is in the first worksheet
      await newCaseEmailReceiverWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, email] = row.values;
            if (email) {
              const [newCaseEmailReceiver, created] =
                await NewCaseEmailReceiver.findOrCreate({
                  where: { id: id },
                  defaults: {
                    email: email,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeders Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async dropDealerSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./dropDealerData.xlsx")
      );

      const dropDealerDataWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await dropDealerDataWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, pickupDealerCode, dropDealerCode] = row.values;
            if (pickupDealerCode && dropDealerCode) {
              const pickupDealerCodeVal = String(pickupDealerCode).trim();
              const dropDealerCodeVal = String(dropDealerCode).trim();
              const [pickupDealerExist, dropDealerExist]: any =
                await Promise.all([
                  Dealer.findOne({
                    where: { code: pickupDealerCodeVal },
                    attributes: ["id"],
                    paranoid: false,
                  }),
                  Dealer.findOne({
                    where: { code: dropDealerCodeVal },
                    attributes: ["id"],
                    paranoid: false,
                  }),
                ]);
              if (pickupDealerExist && dropDealerExist) {
                await DropDealer.findOrCreate({
                  where: {
                    dealerId: pickupDealerExist.dataValues.id,
                    dropDealerId: dropDealerExist.dataValues.id,
                  },
                  defaults: {
                    dealerId: pickupDealerExist.dataValues.id,
                    dropDealerId: dropDealerExist.dataValues.id,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async serialNumberSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./serialNumberData.xlsx")
      );

      //FINANCIAL YEARS
      const financialYearWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await financialYearWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, code, from] = row.values;
            if (id && code && from) {
              const [financialYear, created] =
                await FinancialYears.findOrCreate({
                  where: { id: id },
                  defaults: {
                    code: code,
                    from: from,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //SERIAL NUMBER SEGMENTS
      const serialNumberSegmentWorksheet: any = workbook.getWorksheet(2); // Assuming data is in the first worksheet
      await serialNumberSegmentWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (id && name) {
              const [serialNumberSegment, created] =
                await SerialNumberSegments.findOrCreate({
                  where: { id: id },
                  defaults: {
                    name: name,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
            }
          }
        }
      );

      //SERIAL NUMBER CATEGORY
      const serialNumberCategoryWorksheet: any = workbook.getWorksheet(3); // Assuming data is in the first worksheet
      await serialNumberCategoryWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, client, name, shortName] = row.values;
            if (id && client && name && shortName) {
              const clientExist: any = await Client.findOne({
                where: { name: client },
                attributes: ["id"],
              });

              if (clientExist) {
                //SERIAL NUMBER CATEGORY SAVE
                const serialNumberCategoryExist =
                  await SerialNumberCategories.findOne({
                    where: { name: name, shortName: shortName },
                  });
                let serialNumberCategoryId = null;
                if (!serialNumberCategoryExist) {
                  const newSerialNumberCategory =
                    await SerialNumberCategories.create({
                      name: name,
                      shortName: shortName,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    });
                  serialNumberCategoryId =
                    newSerialNumberCategory.dataValues.id;
                } else {
                  serialNumberCategoryId =
                    serialNumberCategoryExist.dataValues.id;
                }

                //UPDATE SERIAL NUMBER CATEGORY
                await Client.update(
                  {
                    deliveryRequestSerialNumberCategoryId:
                      serialNumberCategoryId,
                  },
                  { where: { id: clientExist.dataValues.id } }
                );
              }
            }
          }
        }
      );

      //SERIAL NUMBER CATEGORY, SERIAL NUMBER GROUP AND SEGMENTS
      const serialNumberGroupWorksheet: any = workbook.getWorksheet(4); // Assuming data is in the first worksheet
      await serialNumberGroupWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, client, year] = row.values;
            if (id && client && year) {
              const financialYearExist: any = await FinancialYears.findOne({
                where: { from: year },
                attributes: ["id", "code"],
              });

              const clientExist: any = await Client.findOne({
                where: { name: client },
                attributes: ["id", "deliveryRequestSerialNumberCategoryId"],
              });

              if (clientExist && financialYearExist) {
                //SERIAL NUMBER CATEGORY SAVE
                const serialNumberCategoryExist =
                  await SerialNumberCategories.findOne({
                    where: {
                      id: clientExist.dataValues
                        .deliveryRequestSerialNumberCategoryId,
                    },
                    attributes: ["id", "shortName"],
                  });
                if (serialNumberCategoryExist) {
                  //SERIAL NUMBER GROUP SAVE
                  const serialNumberGroupExist =
                    await SerialNumberGroups.findOne({
                      where: {
                        categoryId: serialNumberCategoryExist.dataValues.id,
                        financialYearId: financialYearExist.dataValues.id,
                      },
                    });
                  let serialNumberGroupId = null;
                  if (!serialNumberGroupExist) {
                    const newSerialNumberGroup: any =
                      await SerialNumberGroups.create({
                        categoryId: serialNumberCategoryExist.dataValues.id,
                        financialYearId: financialYearExist.dataValues.id,
                        length: 7,
                        nextNumber: 1,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      });
                    serialNumberGroupId = newSerialNumberGroup.dataValues.id;
                  } else {
                    serialNumberGroupId = serialNumberGroupExist.dataValues.id;
                  }

                  //SERIAL NUMBER GROUP AND SEGMENT SAVE
                  await SerialNumberGroupSerialNumberSegments.findOrCreate({
                    where: {
                      serialNumberGroupId: serialNumberGroupId,
                      segmentId: 1, //STATIC TEXT
                    },
                    defaults: {
                      serialNumberGroupId: serialNumberGroupId,
                      segmentId: 1, //STATIC TEXT
                      value: serialNumberCategoryExist.dataValues.shortName,
                      displayOrder: 1,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    },
                  });

                  await SerialNumberGroupSerialNumberSegments.findOrCreate({
                    where: {
                      serialNumberGroupId: serialNumberGroupId,
                      segmentId: 2, //FINANCIAL YEAR
                    },
                    defaults: {
                      serialNumberGroupId: serialNumberGroupId,
                      segmentId: 2, //FINANCIAL YEAR
                      value: financialYearExist.dataValues.code,
                      displayOrder: 2,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    },
                  });
                }
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeders Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async financialYearSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./financialYears.xlsx")
      );

      //FINANCIAL YEARS
      const financialYearWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await financialYearWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, code, from] = row.values;
            if (id && code && from) {
              await FinancialYears.findOrCreate({
                where: { id: id },
                defaults: {
                  code: code,
                  from: from,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeders Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async genericSerialNumberCategorySeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./genericSerialNumberCategories.xlsx")
      );

      //SERIAL NUMBER CATEGORY
      const serialNumberCategoryWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await serialNumberCategoryWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name, shortName] = row.values;
            if (id && name && shortName) {
              //SERIAL NUMBER CATEGORY SAVE
              await SerialNumberCategories.findOrCreate({
                where: { name: name, shortName: shortName },
                defaults: {
                  name: name,
                  shortName: shortName,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
            }
          }
        }
      );

      //SERIAL NUMBER CATEGORY, SERIAL NUMBER GROUP AND SEGMENTS
      const serialNumberGroupWorksheet: any = workbook.getWorksheet(2); // Assuming data is in the first worksheet
      await serialNumberGroupWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, serialNumberCategory, year, length] = row.values;
            if (id && serialNumberCategory && year && length) {
              Utils.generateSerialNumberGroup(
                serialNumberCategory,
                year,
                length
              );
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeders Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async configTypeConfigSeeder(req: any, res: any) {
    try {
      const configTypes = [
        {
          id: 1,
          name: "Inventory Categories",
        },
        {
          id: 2,
          name: "ASP Mechanic Work Statuses",
        },
        {
          id: 3,
          name: "Delivery Request Schemes",
        },
        {
          id: 4,
          name: "Case Types",
        },
        {
          id: 5,
          name: "Dealer Approval Statuses",
        },
        {
          id: 6,
          name: "Razorpay Payable Types",
        },
        {
          id: 7,
          name: "Attachment Types",
        },
        {
          id: 8,
          name: "Attachment Of",
        },
        {
          id: 9,
          name: "Salutations",
        },
        {
          id: 10,
          name: "ASP Working Hours",
        },
        {
          id: 11,
          name: "User Types",
        },
        {
          id: 12,
          name: "Activity Additional Charges Types",
        },
        {
          id: 13,
          name: "Inventory Types",
        },
        {
          id: 14,
          name: "Activity Payment Types",
        },
        {
          id: 15,
          name: "Activity Transaction Types",
        },
        {
          id: 16,
          name: "Activity Payment Statuses",
        },
        {
          id: 17,
          name: "Dealer Wallet Transaction Types",
        },
        {
          id: 18,
          name: "Dealer Wallet Payment Statuses",
        },
        {
          id: 19,
          name: "Nearest Service Providers Filters",
        },
        {
          id: 20,
          name: "Permission Types",
        },
        {
          id: 21,
          name: "Activity Log Types",
        },
        {
          id: 22,
          name: "Dealer Types",
        },
        {
          id: 23,
          name: "Dealer Zones",
        },
        {
          id: 24,
          name: "ASP Performances",
        },
        {
          id: 25,
          name: "ASP Priorities",
        },
        {
          id: 26,
          name: "Interaction Channels",
        },
        {
          id: 27,
          name: "Interaction To Types",
        },
        {
          id: 28,
          name: "Interaction Call Types",
        },
        {
          id: 29,
          name: "ASP Tiers",
        },
        {
          id: 30,
          name: "Business Categories",
        },
        {
          id: 31,
          name: "Address Types",
        },
        {
          id: 32,
          name: "Address Of",
        },
        {
          id: 33,
          name: "SLA Types",
        },
        {
          id: 34,
          name: "Complimentary Waiting Time",
        },
        {
          id: 35,
          name: "Interaction Call From",
        },
        {
          id: 36,
          name: "Case Subject Types",
        },
        {
          id: 37,
          name: "Case Channels",
        },
        {
          id: 38,
          name: "Case Creation Types",
        },
        {
          id: 39,
          name: "Case Accident Types",
        },
        {
          id: 40,
          name: "Policy Types",
        },
        {
          id: 41,
          name: "Customer Vehicle Location Types",
        },
        {
          id: 42,
          name: "Drop Location Types",
        },
        {
          id: 43,
          name: "Customer Preferred Locations",
        },
        {
          id: 44,
          name: "Entitlement Units",
        },
        {
          id: 45,
          name: "Fuel Types",
        },
        {
          id: 46,
          name: "Get Location Via Types",
        },
        {
          id: 47,
          name: "Mail Configuration Types",
        },
        {
          id: 48,
          name: "Reminders",
        },
        {
          id: 49,
          name: "Reminder Priorities",
        },
        {
          id: 50,
          name: "Reminder Types",
        },
        {
          id: 51,
          name: "Reminder Status",
        },
        {
          id: 52,
          name: "Link Types",
        },
        {
          id: 53,
          name: "City Location Types",
        },
        {
          id: 54,
          name: "City Municipal Limits",
        },
        {
          id: 55,
          name: "City Location Categories",
        },
        {
          id: 56,
          name: "Attendance Maximum Shift Hour",
        },
        {
          id: 57,
          name: "ASP Mechanic ASP Types",
        },
        {
          id: 58,
          name: "ASP Mechanic Location Capture Via Types",
        },
        {
          id: 59,
          name: "ASP Mechanic Dynamic Types",
        },
        {
          id: 60,
          name: "Attendance Auto End Additional Seconds",
        },
        {
          id: 61,
          name: "Api Log Types",
        },
        {
          id: 62,
          name: "Attendance Max Time To Allow Shift Submit",
        },
        {
          id: 63,
          name: "Attendance Shift End Reminder Time",
        },
        {
          id: 64,
          name: "Template Types",
        },
        {
          id: 65,
          name: "Template Send To Types",
        },
        {
          id: 66,
          name: "Last Attended COCO Technicians Limit",
        },
        {
          id: 67,
          name: "Template Input Types",
        },
        {
          id: 68,
          name: "Template When To Cross Border Types",
        },
        {
          id: 69,
          name: "Template Log Entity Types",
        },
        {
          id: 70,
          name: "Template Vehicle Statuses",
        },
        {
          id: 71,
          name: "User Languages",
        },
        {
          id: 72,
          name: "Shift Types",
        },
        {
          id: 73,
          name: "User Statuses",
        },
        {
          id: 74,
          name: "Exceeded Expectation SLA Mins",
        },
        {
          id: 75,
          name: "Activity Log Action Types",
        },
        {
          id: 76,
          name: "Template Action Types",
        },
        {
          id: 77,
          name: "New COCO Technicians Limit",
        },
        {
          id: 78,
          name: "User Agent Levels",
        },
        {
          id: 79,
          name: "User Login Statuses",
        },

        {
          id: 80,
          name: "Advance Payment Methods",
        },
        {
          id: 81,
          name: "Advance Payment Paid Tos",
        },
        {
          id: 82,
          name: "Import Configuration Types",
        },
        {
          id: 83,
          name: "CRM Report Query Builder Condition Types",
        },
        {
          id: 84,
          name: "CRM Report Query Builder Input Types",
        },
        {
          id: 85,
          name: "Non Member Customer Types",
        },

        {
          id: 86,
          name: "Hub Caps Inventory Limit",
        },
        {
          id: 87,
          name: "Speakers Inventory Limit",
        },
        {
          id: 88,
          name: "Floor Mat Inventory Limit",
        },
        {
          id: 89,
          name: "VDM Approximate Vehicle Value Minimum Limit",
        },

        {
          id: 90,
          name: "VDM Enable Location Type",
        },

        {
          id: 91,
          name: "Customer Feedback Call Statuses",
        },

        {
          id: 92,
          name: "Refund Types",
        },
        {
          id: 93,
          name: "Refund Statuses",
        },
        {
          id: 94,
          name: "Refund Approval Statuses",
        },
      ];

      const configs = [
        //Inventory Categories
        {
          id: 1,
          typeId: 1,
          name: "New Vehicle",
        },
        {
          id: 2,
          typeId: 1,
          name: "FBT Vehicle",
        },

        // ASP Mechanic Work Statuses
        {
          id: 11,
          typeId: 2,
          name: "Offline",
        },
        {
          id: 12,
          typeId: 2,
          name: "Available",
        },
        {
          id: 13,
          typeId: 2,
          name: "Busy",
        },

        // Delivery Request Schemes
        {
          id: 21,
          typeId: 3,
          name: "OEM",
        },
        {
          id: 22,
          typeId: 3,
          name: "Dealer",
        },

        // Case Types
        {
          id: 31,
          typeId: 4,
          name: "RSA",
        },
        {
          id: 32,
          typeId: 4,
          name: "Delivery Request",
        },

        // Dealer Approval Statuses
        {
          id: 41,
          typeId: 5,
          name: "Requested",
        },
        {
          id: 42,
          typeId: 5,
          name: "Approved",
        },
        {
          id: 43,
          typeId: 5,
          name: "Rejected",
        },

        // Razorpay Payable Types
        {
          id: 51,
          typeId: 6,
          name: "Activity",
        },

        // Attachment Types
        {
          id: 61,
          typeId: 7,
          name: "Case Documents",
        },
        {
          id: 62,
          typeId: 7,
          name: "Activity Pickup Inventory Documents",
        },
        {
          id: 63,
          typeId: 7,
          name: "Activity Vehicle Front Side - Before",
        },
        {
          id: 64,
          typeId: 7,
          name: "Activity Vehicle Rear Side - Before",
        },
        {
          id: 65,
          typeId: 7,
          name: "Activity Vehicle Driver Side - Before",
        },
        {
          id: 66,
          typeId: 7,
          name: "Activity Vehicle Passenger Side - Before",
        },
        {
          id: 67,
          typeId: 7,
          name: "Activity Vehicle Damaged Area - Before",
        },
        {
          id: 68,
          typeId: 7,
          name: "Activity Vehicle Others - Before",
        },
        {
          id: 69,
          typeId: 7,
          name: "Activity Dealer Signature - Before",
        },
        {
          id: 70,
          typeId: 7,
          name: "Activity Driver Signature - Before",
        },
        {
          id: 71,
          typeId: 7,
          name: "Activity Vehicle Front Side - After",
        },
        {
          id: 72,
          typeId: 7,
          name: "Activity Vehicle Rear Side - After",
        },
        {
          id: 73,
          typeId: 7,
          name: "Activity Vehicle Driver Side - After",
        },
        {
          id: 74,
          typeId: 7,
          name: "Activity Vehicle Passenger Side - After",
        },
        {
          id: 75,
          typeId: 7,
          name: "Activity Vehicle Damaged Area - After",
        },
        {
          id: 76,
          typeId: 7,
          name: "Activity Vehicle Others - After",
        },
        {
          id: 77,
          typeId: 7,
          name: "Activity Dealer Signature - After",
        },
        {
          id: 78,
          typeId: 7,
          name: "Activity Driver Signature - After",
        },
        {
          id: 79,
          typeId: 7,
          name: "Activity Drop Inventory Documents",
        },
        {
          id: 80,
          typeId: 7,
          name: "Activity Drop Additional Charges Documents",
        },
        {
          id: 81,
          typeId: 7,
          name: "Case Policy Documents",
        },
        {
          id: 82,
          typeId: 7,
          name: "Case Accidental Documents",
        },
        {
          id: 83,
          typeId: 7,
          name: "Activity Issue Identification Recordings",
        },
        {
          id: 84,
          typeId: 7,
          name: "Activity Customer Signature - Before",
        },
        {
          id: 85,
          typeId: 7,
          name: "Photos Of Failed Parts",
        },
        {
          id: 86,
          typeId: 7,
          name: "Photo Of Vehicles",
        },
        {
          id: 87,
          typeId: 7,
          name: "Signature Of ASP - Breakdown",
        },
        {
          id: 88,
          typeId: 7,
          name: "Signature Of Customer - Breakdown",
        },
        {
          id: 89,
          typeId: 7,
          name: "Vehicle With Dealer Background - Breakdown",
        },
        {
          id: 90,
          typeId: 7,
          name: "Image Of Inner Cabin - Breakdown",
        },
        {
          id: 91,
          typeId: 7,
          name: "Image Of Cluster - Breakdown",
        },
        {
          id: 92,
          typeId: 7,
          name: "Image Of Car In Towing Vehicle - Breakdown",
        },
        {
          id: 93,
          typeId: 7,
          name: "Signature Of ASP - Drop",
        },
        {
          id: 94,
          typeId: 7,
          name: "Signature Of Customer - Drop",
        },
        {
          id: 95,
          typeId: 7,
          name: "Vehicle With Dealer Background - Drop",
        },
        {
          id: 96,
          typeId: 7,
          name: "Image Of Inner Cabin - Drop",
        },
        {
          id: 97,
          typeId: 7,
          name: "Image Of Cluster - Drop",
        },
        {
          id: 98,
          typeId: 7,
          name: "Image Of Car In Towing Vehicle - Drop",
        },
        {
          id: 99,
          typeId: 7,
          name: "Signature Of Dealership",
        },
        {
          id: 100,
          typeId: 7,
          name: "Other Service Attachments",
        },

        // Attachment Of
        {
          id: 101,
          typeId: 8,
          name: "Case",
        },
        {
          id: 102,
          typeId: 8,
          name: "Activity",
        },
        {
          id: 103,
          typeId: 8,
          name: "User",
        },
        {
          id: 104,
          typeId: 8,
          name: "Location Log",
        },

        // Salutations
        {
          id: 120,
          typeId: 9,
          name: "Mr.",
        },
        {
          id: 121,
          typeId: 9,
          name: "Ms.",
        },
        {
          id: 122,
          typeId: 9,
          name: "Mrs.",
        },

        // ASP Working Hours
        {
          id: 130,
          typeId: 10,
          name: "DAY",
        },
        {
          id: 131,
          typeId: 10,
          name: "NIGHT",
        },
        {
          id: 132,
          typeId: 10,
          name: "24HRS",
        },

        // User Types
        {
          id: 140,
          typeId: 11,
          name: "Dealer",
        },
        {
          id: 141,
          typeId: 11,
          name: "Agent",
        },
        {
          id: 142,
          typeId: 11,
          name: "ASP",
        },
        {
          id: 143,
          typeId: 11,
          name: "ASP Mechanic",
        },
        {
          id: 144,
          typeId: 11,
          name: "Own Patrol Vehicle Helper",
        },

        // Activity Additional Charges Types
        {
          id: 150,
          typeId: 12,
          name: "Estimated",
        },
        {
          id: 151,
          typeId: 12,
          name: "Actual / Charges Not Collected",
        },
        {
          id: 152,
          typeId: 12,
          name: "Charges Collected From Customer",
        },

        // Inventory Types
        {
          id: 160,
          typeId: 13,
          name: "Pickup",
        },
        {
          id: 161,
          typeId: 13,
          name: "Drop",
        },
        {
          id: 162,
          typeId: 13,
          name: "Breakdown",
        },

        // Activity Payment Types
        {
          id: 170,
          typeId: 14,
          name: "Advance",
        },
        {
          id: 171,
          typeId: 14,
          name: "Balance",
        },
        {
          id: 172,
          typeId: 14,
          name: "Excess",
        },
        {
          id: 173,
          typeId: 14,
          name: "Advance Refund",
        },
        {
          id: 174,
          typeId: 14,
          name: "One Time Service",
        },
        {
          id: 175,
          typeId: 14,
          name: "Reimbursement",
        },

        // Activity Transaction Types
        {
          id: 180,
          typeId: 15,
          name: "Credit",
        },
        {
          id: 181,
          typeId: 15,
          name: "Debit",
        },

        // Activity Payment Statuses
        {
          id: 190,
          typeId: 16,
          name: "Pending",
        },
        {
          id: 191,
          typeId: 16,
          name: "Success",
        },
        {
          id: 192,
          typeId: 16,
          name: "Failed",
        },

        // Dealer Wallet Transaction Types
        {
          id: 200,
          typeId: 17,
          name: "Credit",
        },
        {
          id: 201,
          typeId: 17,
          name: "Debit",
        },

        // Dealer Wallet Payment Statuses
        {
          id: 210,
          typeId: 18,
          name: "Pending",
        },
        {
          id: 211,
          typeId: 18,
          name: "Success",
        },
        {
          id: 212,
          typeId: 18,
          name: "Failed",
        },

        // Nearest Service Providers Filters
        {
          id: 219,
          typeId: 19,
          name: "Nearest ASP to Breakdown Location",
        },
        {
          id: 220,
          typeId: 19,
          name: "Nearest ASP to Pickup Location",
        },
        {
          id: 221,
          typeId: 19,
          name: "Nearest ASP to Drop Location",
        },
        {
          id: 222,
          typeId: 19,
          name: "Nearest 5 ASP’s",
        },
        {
          id: 223,
          typeId: 19,
          name: "50 km – 100 km",
        },
        {
          id: 224,
          typeId: 19,
          name: "100 km – 200 km",
        },
        {
          id: 225,
          typeId: 19,
          name: "200 km – 500 km",
        },

        // Permission Types
        {
          id: 230,
          typeId: 20,
          name: "Web",
        },
        {
          id: 231,
          typeId: 20,
          name: "Mobile",
        },

        // Activity Log Types
        {
          id: 240,
          typeId: 21,
          name: "Web",
        },
        {
          id: 241,
          typeId: 21,
          name: "Mobile",
        },
        {
          id: 242,
          typeId: 21,
          name: "Interaction",
        },
        {
          id: 243,
          typeId: 21,
          name: "Reminder",
        },
        {
          id: 244,
          typeId: 21,
          name: "Notification",
        },
        {
          id: 245,
          typeId: 21,
          name: "Dialer",
        },

        // DEALER TYPES
        {
          id: 250,
          typeId: 22,
          name: "Dealer",
        },

        // DEALER ZONES
        {
          id: 255,
          typeId: 23,
          name: "North",
        },
        {
          id: 256,
          typeId: 23,
          name: "South",
        },
        {
          id: 257,
          typeId: 23,
          name: "East",
        },
        {
          id: 258,
          typeId: 23,
          name: "West",
        },
        {
          id: 259,
          typeId: 23,
          name: "Central",
        },

        // ASP PERFORMANCES
        {
          id: 261,
          typeId: 24,
          name: "EXCELLENT",
        },
        {
          id: 262,
          typeId: 24,
          name: "VERY GOOD",
        },
        {
          id: 263,
          typeId: 24,
          name: "GOOD",
        },
        {
          id: 264,
          typeId: 24,
          name: "AVERAGE",
        },
        {
          id: 265,
          typeId: 24,
          name: "POOR",
        },

        // ASP PRIORITIES
        {
          id: 270,
          typeId: 25,
          name: "1",
        },
        {
          id: 271,
          typeId: 25,
          name: "2",
        },
        {
          id: 272,
          typeId: 25,
          name: "3",
        },
        {
          id: 273,
          typeId: 25,
          name: "4",
        },
        {
          id: 274,
          typeId: 25,
          name: "5",
        },
        {
          id: 275,
          typeId: 25,
          name: "6",
        },
        {
          id: 276,
          typeId: 25,
          name: "7",
        },
        {
          id: 277,
          typeId: 25,
          name: "8",
        },
        {
          id: 278,
          typeId: 25,
          name: "9",
        },
        {
          id: 279,
          typeId: 25,
          name: "10",
        },

        // INTERACTION CHANNELS
        {
          id: 290,
          typeId: 26,
          name: "Email",
        },
        {
          id: 291,
          typeId: 26,
          name: "Phone",
        },
        {
          id: 292,
          typeId: 26,
          name: "SMS",
        },

        // INTERACTION TO TYPES
        {
          id: 300,
          typeId: 27,
          name: "Pickup Dealer",
        },
        {
          id: 301,
          typeId: 27,
          name: "Drop Dealer",
        },
        {
          id: 302,
          typeId: 27,
          name: "ASP",
        },
        {
          id: 303,
          typeId: 27,
          name: "ASP Mechanic",
        },
        {
          id: 304,
          typeId: 27,
          name: "Customer",
        },
        {
          id: 305,
          typeId: 27,
          name: "RM",
        },
        {
          id: 306,
          typeId: 27,
          name: "ZM",
        },
        {
          id: 307,
          typeId: 27,
          name: "NM",
        },

        // INTERACTION CALL TYPES
        {
          id: 310,
          typeId: 28,
          name: "In Bound",
        },
        {
          id: 311,
          typeId: 28,
          name: "Out Bound",
        },

        // ASP TIERS
        {
          id: 320,
          typeId: 29,
          name: "TIER 1",
        },
        {
          id: 321,
          typeId: 29,
          name: "TIER 2",
        },
        {
          id: 322,
          typeId: 29,
          name: "TIER 3",
        },
        {
          id: 323,
          typeId: 29,
          name: "TIER 4",
        },
        {
          id: 324,
          typeId: 29,
          name: "TIER 5",
        },

        // BUSINESS CATEGORIES
        {
          id: 330,
          typeId: 30,
          name: "B2B",
        },
        {
          id: 331,
          typeId: 30,
          name: "B2B2C",
        },
        {
          id: 332,
          typeId: 30,
          name: "B2C",
        },

        // ADDRESS TYPES
        {
          id: 340,
          typeId: 31,
          name: "Billing Address",
        },
        {
          id: 341,
          typeId: 31,
          name: "Shipping Address",
        },

        // ADDRESS OF
        {
          id: 350,
          typeId: 32,
          name: "Client",
        },

        // SLA TYPES
        {
          id: 360,
          typeId: 33,
          name: "Agent Assignment",
        },
        {
          id: 361,
          typeId: 33,
          name: "ASP Assignment & Acceptance",
        },
        {
          id: 362,
          typeId: 33,
          name: "Dealer Advance Payment - Initial Warning",
        },
        {
          id: 363,
          typeId: 33,
          name: "Dealer Advance Payment - Final Warning",
        },
        {
          id: 364,
          typeId: 33,
          name: "Dealer Advance Payment - Escalation",
        },
        {
          id: 365,
          typeId: 33,
          name: "ASP Reached Pickup",
        },

        {
          id: 366,
          typeId: 33,
          name: "L2 Agent Pick time SLA - L1",
        },
        {
          id: 367,
          typeId: 33,
          name: "L2 Agent Pick time SLA - L2",
        },
        {
          id: 368,
          typeId: 33,
          name: "ASP Assignment SLA - Auto Assignment",
        },
        // {
        //   id: 369,
        //   typeId: 33,
        //   name: "ASP Acceptance SLA - Auto Assignment L1",
        // },
        // {
        //   id: 370,
        //   typeId: 33,
        //   name: "ASP Acceptance SLA - Auto Assignment L2",
        // },

        //COMPLIMENTARY WAITING TIME
        {
          id: 371,
          typeId: 34,
          name: "90",
        },

        //INTERACTION CALL FROM
        {
          id: 375,
          typeId: 35,
          name: "Customer",
        },
        {
          id: 376,
          typeId: 35,
          name: "ASP",
        },
        {
          id: 377,
          typeId: 35,
          name: "TVS SPOC",
        },
        {
          id: 378,
          typeId: 35,
          name: "Dealer",
        },
        {
          id: 379,
          typeId: 35,
          name: "OEM",
        },

        //CASE SUBJECT TYPES
        {
          id: 391,
          typeId: 36,
          name: "NON - RSA",
        },
        {
          id: 392,
          typeId: 36,
          name: "RSA",
        },

        //CASE CHANNELS
        {
          id: 401,
          typeId: 37,
          name: "Phone",
        },
        {
          id: 402,
          typeId: 37,
          name: "SMS",
        },
        {
          id: 403,
          typeId: 37,
          name: "WhatsApp",
        },
        {
          id: 404,
          typeId: 37,
          name: "Email",
        },

        //CASE CREATION TYPES
        // {
        //   id: 411,
        //   typeId: 38,
        //   name: "None",
        // },
        {
          id: 412,
          typeId: 38,
          name: "Non - Accidental",
        },
        {
          id: 413,
          typeId: 38,
          name: "Accidental",
        },

        //CASE ACCIDENT TYPES
        // {
        //   id: 421,
        //   typeId: 39,
        //   name: "None",
        // },
        {
          id: 422,
          typeId: 39,
          name: "Major",
        },
        {
          id: 423,
          typeId: 39,
          name: "Minor",
        },

        //POLICY TYPES
        {
          id: 431,
          typeId: 40,
          name: "Warranty",
        },
        {
          id: 432,
          typeId: 40,
          name: "Extended Warranty",
        },
        {
          id: 433,
          typeId: 40,
          name: "RSA Retail",
        },
        {
          id: 434,
          typeId: 40,
          name: "Non Member",
        },

        //CUSTOMER VEHICLE LOCATION TYPES
        {
          id: 441,
          typeId: 41,
          name: "Home",
        },
        {
          id: 442,
          typeId: 41,
          name: "On Road",
        },

        //DROP LOCATION TYPES
        {
          id: 451,
          typeId: 42,
          name: "Customer Preferred Location",
        },
        {
          id: 452,
          typeId: 42,
          name: "Dealer",
        },

        //CUSTOMER PREFERRED LOCATIONS
        {
          id: 461,
          typeId: 43,
          name: "Dealer",
        },
        {
          id: 462,
          typeId: 43,
          name: "Home",
        },
        {
          id: 463,
          typeId: 43,
          name: "Garage",
        },
        {
          id: 464,
          typeId: 43,
          name: "Charging Station",
        },

        //ENTITLEMENT UNITS
        {
          id: 471,
          typeId: 44,
          name: "KM",
        },
        {
          id: 472,
          typeId: 44,
          name: "Litre",
        },
        {
          id: 473,
          typeId: 44,
          name: "Amount",
        },

        //FUEL TYPES
        {
          id: 481,
          typeId: 45,
          name: "Petrol",
        },
        {
          id: 482,
          typeId: 45,
          name: "Diesel",
        },
        {
          id: 483,
          typeId: 45,
          name: "CNG",
        },
        {
          id: 484,
          typeId: 45,
          name: "Others",
        },

        //GET LOCATION VIA TYPES
        {
          id: 491,
          typeId: 46,
          name: "SMS",
        },
        {
          id: 492,
          typeId: 46,
          name: "WhatsApp",
        },
        {
          id: 493,
          typeId: 46,
          name: "Manually",
        },

        //MAIL CONFIGURATION  TYPES
        {
          id: 501,
          typeId: 47,
          name: "ASP Unavailability Alert",
        },
        {
          id: 502,
          typeId: 47,
          name: "Policy Interested Customer Report",
        },

        //REMINDERS
        {
          id: 521,
          typeId: 48,
          name: "10 min",
        },
        {
          id: 522,
          typeId: 48,
          name: "15 min",
        },
        {
          id: 523,
          typeId: 48,
          name: "30 min",
        },
        {
          id: 524,
          typeId: 48,
          name: "45 min",
        },
        {
          id: 525,
          typeId: 48,
          name: "1 Hour",
        },
        {
          id: 526,
          typeId: 48,
          name: "2 Hours",
        },
        {
          id: 527,
          typeId: 48,
          name: "4 Hours",
        },
        {
          id: 528,
          typeId: 48,
          name: "Others",
        },

        //REMINDER PRIORITIES
        {
          id: 551,
          typeId: 49,
          name: "Normal",
        },
        {
          id: 552,
          typeId: 49,
          name: "High",
        },

        //REMINDER TYPES
        {
          id: 561,
          typeId: 50,
          name: "Call",
        },
        {
          id: 562,
          typeId: 50,
          name: "Email",
        },

        //REMINDER STATUS
        {
          id: 571,
          typeId: 51,
          name: "Open",
        },
        {
          id: 572,
          typeId: 51,
          name: "Completed",
        },

        //ATTACHMENT TYPES (600-700 DO NOT USE THESE IDs)
        {
          id: 600,
          typeId: 7,
          name: "Customer Vehicle ODO Reading",
        },
        {
          id: 601,
          typeId: 7,
          name: "Inventory Photo",
        },
        {
          id: 602,
          typeId: 7,
          name: "Activity Customer Signature - After",
        },
        {
          id: 603,
          typeId: 7,
          name: "Activity Issue Identification Images",
        },
        {
          id: 604,
          typeId: 7,
          name: "User Attendance Selfie Image",
        },
        {
          id: 605,
          typeId: 7,
          name: "Breakdown Vehicle Image",
        },
        {
          id: 606,
          typeId: 7,
          name: "Other Service - Vehicle Hand Over Signature",
        },
        {
          id: 607,
          typeId: 7,
          name: "Technician ID Card Image",
        },
        {
          id: 608,
          typeId: 7,
          name: "E Way Bill - Before",
        },
        {
          id: 609,
          typeId: 7,
          name: "Lorry Receipt - Before",
        },
        {
          id: 610,
          typeId: 7,
          name: "E Way Bill - After",
        },
        {
          id: 611,
          typeId: 7,
          name: "Lorry Receipt - After",
        },
        {
          id: 612,
          typeId: 7,
          name: "Delivery Request Dealer Documents",
        },
        {
          id: 613,
          typeId: 7,
          name: "Reimbursement Bank Detail Attachments",
        },
        {
          id: 614,
          typeId: 7,
          name: "Before Photos",
        },
        {
          id: 615,
          typeId: 7,
          name: "After Photos",
        },
        {
          id: 616,
          typeId: 7,
          name: "Digital Inventory",
        },

        //LINK TYPES
        {
          id: 701,
          typeId: 52,
          name: "Case Detail",
        },
        {
          id: 702,
          typeId: 52,
          name: "Activity",
        },

        //CITY LOCATION TYPES
        {
          id: 730,
          typeId: 53,
          name: "City",
        },
        {
          id: 731,
          typeId: 53,
          name: "Highways",
        },
        {
          id: 732,
          typeId: 53,
          name: "Hilly terrain",
        },

        //CITY MUNICIPAL LIMITS
        {
          id: 740,
          typeId: 54,
          name: "With in Municiple limit",
        },
        {
          id: 741,
          typeId: 54,
          name: "Out of Municiple limit",
        },

        //CITY LOCATION CATEGORIES
        {
          id: 751,
          typeId: 55,
          name: "ASP Location",
        },
        {
          id: 752,
          typeId: 55,
          name: "COCO Location",
        },

        //ATTENDANCE MAXIMUM SHIFT HOUR
        {
          id: 761,
          typeId: 56,
          name: "86400",
        },

        //ASP MECHANIC ASP TYPES
        {
          id: 771,
          typeId: 57,
          name: "COCO",
        },
        {
          id: 772,
          typeId: 57,
          name: "3rd Party",
        },

        //ASP MECHANIC LOCATION CAPTURE VIA TYPES
        {
          id: 781,
          typeId: 58,
          name: "Stationary",
        },
        {
          id: 782,
          typeId: 58,
          name: "Dynamic",
        },

        //ASP MECHANIC DYNAMIC TYPES
        {
          id: 791,
          typeId: 59,
          name: "Mobile",
        },
        {
          id: 792,
          typeId: 59,
          name: "GPS",
        },

        //ATTENDANCE AUTO END ADDITIONAL SECONDS
        {
          id: 801,
          typeId: 60,
          name: "300",
        },

        //API LOG TYPES
        {
          id: 811,
          typeId: 61,
          name: "Case",
        },
        {
          id: 812,
          typeId: 61,
          name: "Activity",
        },
        {
          id: 813,
          typeId: 61,
          name: "Approved Activities",
        },
        {
          id: 814,
          typeId: 61,
          name: "Approved Activity Preview",
        },
        {
          id: 815,
          typeId: 61,
          name: "Create ASP Invoice",
        },
        {
          id: 816,
          typeId: 61,
          name: "ASP Invoice List",
        },
        {
          id: 817,
          typeId: 61,
          name: "ASP Invoice View",
        },
        {
          id: 818,
          typeId: 61,
          name: "Non Membership Payment",
        },

        //ATTENDANCE MAX TIME TO ALLOW SHIFT SUBMIT
        {
          id: 851,
          typeId: 62,
          name: "300",
        },

        //ATTENDANCE SHIFT END REMINDER TIME
        {
          id: 852,
          typeId: 63,
          name: "600",
        },

        //SLA TYPES
        // {
        //   id: 865,
        //   typeId: 33,
        //   name: "ASP Acceptance SLA - Auto Assignment L3",
        // },
        {
          id: 866,
          typeId: 33,
          name: "ASP Acceptance  SLA - Manual Assignment L1",
        },
        {
          id: 867,
          typeId: 33,
          name: "ASP Acceptance  SLA - Manual Assignment L2",
        },
        {
          id: 868,
          typeId: 33,
          name: "Remainder Setting SLA - No remainder set L1",
        },
        {
          id: 869,
          typeId: 33,
          name: "Remainder Setting SLA - No remainder set L2",
        },
        {
          id: 870,
          typeId: 33,
          name: "ASP Breakdown Reach Time SLA - L1",
        },
        {
          id: 871,
          typeId: 33,
          name: "ASP Breakdown Reach Time SLA - L2",
        },
        {
          id: 872,
          typeId: 33,
          name: "ASP Breakdown Reach Time SLA - L3",
        },
        {
          id: 873,
          typeId: 33,
          name: "ASP Breakdown Reach Time SLA - L4",
        },
        {
          id: 874,
          typeId: 33,
          name: "Financial entry and Case closure - L1",
        },
        {
          id: 875,
          typeId: 33,
          name: "Financial entry and Case closure - L2",
        },
        {
          id: 876,
          typeId: 33,
          name: "Financial entry and Case closure  - L3",
        },
        {
          id: 877,
          typeId: 33,
          name: "ASP Acceptance  SLA - Manual Assignment L3",
        },

        //TEMPLATE TYPES
        {
          id: 900,
          typeId: 64,
          name: "SMS",
        },
        {
          id: 901,
          typeId: 64,
          name: "Email",
        },
        // {
        //   id: 902,
        //   typeId: 64,
        //   name: "Whatsapp",
        // },

        //TEMPLATE SEND TO TYPES
        {
          id: 911,
          typeId: 65,
          name: "Internal",
        },
        {
          id: 912,
          typeId: 65,
          name: "External",
        },

        //LAST ATTENDED COCO TECHNICIANS LIMIT
        {
          id: 920,
          typeId: 66,
          name: "5",
        },

        //TEMPLATE INPUT TYPES
        {
          id: 931,
          typeId: 67,
          name: "Free Text Box",
        },
        {
          id: 932,
          typeId: 67,
          name: "Dropdown Selection",
        },
        {
          id: 933,
          typeId: 67,
          name: "Number Text Box",
        },
        {
          id: 934,
          typeId: 67,
          name: "Radio Button",
        },
        {
          id: 935,
          typeId: 67,
          name: "Time Picker",
        },

        //TEMPLATE WHEN TO CROSS BORDER TYPES
        {
          id: 941,
          typeId: 68,
          name: "While going to breakdown spot",
        },
        {
          id: 942,
          typeId: 68,
          name: "While going to Drop the vehicle",
        },

        //TEMPLATE LOG ENTITY TYPES
        {
          id: 951,
          typeId: 69,
          name: "Case Detail",
        },
        {
          id: 952,
          typeId: 69,
          name: "Activity",
        },
        {
          id: 953,
          typeId: 69,
          name: "Call Initiation",
        },

        //TEMPLATE VEHICLE STATUS
        {
          id: 961,
          typeId: 70,
          name: "New vehicle",
        },
        {
          id: 962,
          typeId: 70,
          name: "One year old",
        },
        {
          id: 963,
          typeId: 70,
          name: "Out of warranty vehicle",
        },

        //USER LANGUAGES
        {
          id: 971,
          typeId: 71,
          name: "Primary",
        },
        {
          id: 972,
          typeId: 71,
          name: "Secondary",
        },
        {
          id: 973,
          typeId: 71,
          name: "Others",
        },

        //SHIFT TYPES
        {
          id: 981,
          typeId: 72,
          name: "Day",
        },
        {
          id: 982,
          typeId: 72,
          name: "Night",
        },

        //USER STATUSES
        {
          id: 991,
          typeId: 73,
          name: "Available",
        },
        {
          id: 992,
          typeId: 73,
          name: "Offline",
        },
        {
          id: 993,
          typeId: 73,
          name: "Break",
        },

        //EXCEEDED EXPECTATION SLA MINS
        {
          id: 1001,
          typeId: 74,
          name: "10",
        },

        //ACTIVITY LOG ACTION TYPES
        {
          id: 1010,
          typeId: 75,
          name: "Activity Accept",
        },
        {
          id: 1011,
          typeId: 75,
          name: "Activity start to pickup",
        },
        {
          id: 1012,
          typeId: 75,
          name: "Activity reached to pickup",
        },
        {
          id: 1013,
          typeId: 75,
          name: "Activity start to breakdown",
        },
        {
          id: 1014,
          typeId: 75,
          name: "Activity reached to breakdown",
        },

        //TEMPLATE ACTION TYPES
        {
          id: 1031,
          typeId: 76,
          name: "Manual",
        },
        {
          id: 1032,
          typeId: 76,
          name: "Auto",
        },

        //NEW COCO TECHNICIANS LIMIT
        {
          id: 1035,
          typeId: 77,
          name: "5",
        },

        //USER AGENT LEVELS
        {
          id: 1045,
          typeId: 78,
          name: "L1",
        },
        {
          id: 1046,
          typeId: 78,
          name: "L2",
        },
        {
          id: 1047,
          typeId: 78,
          name: "L1 & L2",
        },

        //USER LOGIN STATUSES
        {
          id: 1055,
          typeId: 79,
          name: "Offline",
        },
        {
          id: 1056,
          typeId: 79,
          name: "Active",
        },
        {
          id: 1057,
          typeId: 79,
          name: "Busy",
        },
        {
          id: 1058,
          typeId: 79,
          name: "Break",
        },
        {
          id: 1059,
          typeId: 79,
          name: "Away",
        },
        {
          id: 1060,
          typeId: 79,
          name: "Meal Break",
        },

        //ADVANCE PAYMENT METHODS
        {
          id: 1069,
          typeId: 80,
          name: "Cash",
        },
        {
          id: 1070,
          typeId: 80,
          name: "Online",
        },

        //ADVANCE PAYMENT PAID TOS
        {
          id: 1080,
          typeId: 81,
          name: "ASP",
        },
        {
          id: 1081,
          typeId: 81,
          name: "Online",
        },

        //Import Configuration Types
        {
          id: 1091,
          typeId: 82,
          name: "Client",
        },
        {
          id: 1092,
          typeId: 82,
          name: "Client Service Entitlement",
        },
        {
          id: 1093,
          typeId: 82,
          name: "User",
        },
        {
          id: 1094,
          typeId: 82,
          name: "ASP",
        },
        {
          id: 1095,
          typeId: 82,
          name: "ASP Mechanic",
        },
        {
          id: 1096,
          typeId: 82,
          name: "COCO Vehicle",
        },
        {
          id: 1097,
          typeId: 82,
          name: "COCO Vehicle Helper",
        },
        {
          id: 1098,
          typeId: 82,
          name: "Service Organization",
        },
        {
          id: 1099,
          typeId: 82,
          name: "Call Center",
        },
        {
          id: 1100,
          typeId: 82,
          name: "Dealer",
        },
        {
          id: 1101,
          typeId: 82,
          name: "Vehicle Make",
        },
        {
          id: 1102,
          typeId: 82,
          name: "Vehicle Type",
        },
        {
          id: 1103,
          typeId: 82,
          name: "Vehicle Model",
        },
        {
          id: 1104,
          typeId: 82,
          name: "ASP Reject Reason",
        },
        {
          id: 1105,
          typeId: 82,
          name: "Case Subject",
        },
        {
          id: 1106,
          typeId: 82,
          name: "Sub Service",
        },
        {
          id: 1107,
          typeId: 82,
          name: "SLA Reason",
        },
        {
          id: 1108,
          typeId: 82,
          name: "Escalation Reason",
        },
        {
          id: 1109,
          typeId: 82,
          name: "System Issue Reason",
        },
        {
          id: 1110,
          typeId: 82,
          name: "Language",
        },
        {
          id: 1111,
          typeId: 82,
          name: "City",
        },
        {
          id: 1112,
          typeId: 82,
          name: "Region",
        },
        {
          id: 1113,
          typeId: 82,
          name: "State",
        },
        {
          id: 1114,
          typeId: 82,
          name: "Taluk",
        },
        {
          id: 1115,
          typeId: 82,
          name: "District",
        },
        {
          id: 1116,
          typeId: 82,
          name: "Nearest City",
        },
        {
          id: 1117,
          typeId: 82,
          name: "Asp Rejected CC Detail Reason",
        },

        {
          id: 1118,
          typeId: 82,
          name: "Condition Of Vehicle",
        },
        {
          id: 1119,
          typeId: 82,
          name: "Manual Location Reason",
        },
        {
          id: 1120,
          typeId: 82,
          name: "Case Cancel Reason",
        },
        {
          id: 1121,
          typeId: 82,
          name: "Policy Premium",
        },
        {
          id: 1122,
          typeId: 82,
          name: "Disposition",
        },
        {
          id: 1123,
          typeId: 82,
          name: "ASP Activity Cancel Reason",
        },
        {
          id: 1124,
          typeId: 82,
          name: "User Skill",
        },
        {
          id: 1125,
          typeId: 82,
          name: "Client Entitlement",
        },
        {
          id: 1126,
          typeId: 82,
          name: "Case Subject Questionnaire",
        },
        {
          id: 1127,
          typeId: 82,
          name: "Proposed Delay Reason",
        },
        {
          id: 1128,
          typeId: 82,
          name: "ROS Failure Reason",
        },
        {
          id: 1129,
          typeId: 82,
          name: "ROS Success Reason",
        },

        //CRM REPORT QUERY BUILDER CONDITION TYPES
        {
          id: 1130,
          typeId: 83,
          name: "Equals to",
        },
        {
          id: 1131,
          typeId: 83,
          name: "Not equals to",
        },
        {
          id: 1132,
          typeId: 83,
          name: "Less than",
        },
        {
          id: 1133,
          typeId: 83,
          name: "Greater than",
        },
        {
          id: 1134,
          typeId: 83,
          name: "Between",
        },
        {
          id: 1135,
          typeId: 83,
          name: "Less than or equal to",
        },
        {
          id: 1136,
          typeId: 83,
          name: "Greater than or equal to",
        },

        //CRM REPORT QUERY BUILDER INPUT TYPES
        {
          id: 1140,
          typeId: 84,
          name: "Text",
        },
        {
          id: 1141,
          typeId: 84,
          name: "Date Picker",
        },
        {
          id: 1142,
          typeId: 84,
          name: "From Date And To Date Picker",
        },

        //NON MEMBER CUSTOMER TYPES
        {
          id: 1150,
          typeId: 85,
          name: "Company",
        },
        {
          id: 1151,
          typeId: 85,
          name: "Individual",
        },

        // HUB CAPS INVENTORY LIMIT
        {
          id: 1155,
          typeId: 86,
          name: "10",
        },

        // SPEAKERS INVENTORY LIMIT
        {
          id: 1156,
          typeId: 87,
          name: "10",
        },

        // FLLOR MAT INVENTORY LIMIT
        {
          id: 1157,
          typeId: 88,
          name: "10",
        },

        // VDM APPROXIMATE VEHICLE VALUE MINIMUM LIMIT
        {
          id: 1171,
          typeId: 89,
          name: "100000",
        },

        // VDM ENABLE LOCATION TYPE
        {
          id: 1172,
          typeId: 90,
          name: "false",
        },

        // CUSTOMER FEEDBACK CALL STATUSES
        {
          id: 1180,
          typeId: 91,
          name: "Answered",
        },
        {
          id: 1181,
          typeId: 91,
          name: "Language Barrier",
        },
        {
          id: 1182,
          typeId: 91,
          name: "Call Back",
        },
        {
          id: 1183,
          typeId: 91,
          name: "Customer No Response",
        },
        {
          id: 1184,
          typeId: 91,
          name: "Customer Disconnected",
        },
        {
          id: 1185,
          typeId: 91,
          name: "Not Answered",
        },

        // Refund Types
        {
          id: 1201,
          typeId: 92,
          name: "Full",
        },
        {
          id: 1202,
          typeId: 92,
          name: "Partial",
        },

        // Refund Statuses
        {
          id: 1301,
          typeId: 93,
          name: "Pending",
        },
        {
          id: 1302,
          typeId: 93,
          name: "Processed",
        },
        {
          id: 1303,
          typeId: 93,
          name: "Failed",
        },

        //Refund Approval Status
        {
          id: 1311,
          typeId: 94,
          name: "Waiting for BO Approval",
        },
        {
          id: 1312,
          typeId: 94,
          name: "Rejected",
        },
        {
          id: 1313,
          typeId: 94,
          name: "Approved",
        },

        {
          id: 1400,
          typeId: 82,
          name: "Tow Success Reason",
        },
        {
          id: 1401,
          typeId: 82,
          name: "Tow Failure Reason",
        },
        {
          id: 1402,
          typeId: 82,
          name: "Service Description",
        },
      ];

      //CONFIG TYPE SAVE
      for (const configTypeVal of configTypes) {
        const configTypeExists = await ConfigType.findByPk(configTypeVal.id);
        const configTypeData = {
          id: configTypeVal.id,
          name: configTypeVal.name,
        };
        //CREATE
        if (!configTypeExists) {
          await ConfigType.create(configTypeData);
        } else {
          //UPDATE
          await ConfigType.update(configTypeData, {
            where: {
              id: configTypeVal.id,
            },
          });
        }
      }

      //CONFIG SAVE
      for (const configVal of configs) {
        const configExists = await Config.findByPk(configVal.id);
        const configData = {
          id: configVal.id,
          typeId: configVal.typeId,
          name: configVal.name,
        };
        //CREATE
        if (!configExists) {
          await Config.create(configData);
        } else {
          //UPDATE
          await Config.update(configData, {
            where: {
              id: configVal.id,
            },
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Seeders Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async aspDataUpdationSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./aspUpdationData.xlsx")
      );

      const aspUpdationWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await aspUpdationWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [
              ,
              code,
              performance,
              priority,
              ownPatrol,
              rmContactNumber,
              tier,
            ] = row.values;
            if (code) {
              const aspCode = String(code).trim();
              const aspExist: any = await Asp.findOne({
                where: { code: aspCode },
                attributes: ["id"],
                paranoid: false,
              });

              if (aspExist) {
                const performanceName = performance.trim();
                const performanceExist: any = await Config.findOne({
                  where: {
                    name: performanceName,
                    typeId: 24, //ASP Performances
                  },
                  attributes: ["id"],
                });
                let performanceId = null;
                if (performanceExist) {
                  performanceId = performanceExist.dataValues.id;
                }

                const priorityName = String(priority).trim();
                const priorityExist: any = await Config.findOne({
                  where: {
                    name: priorityName,
                    typeId: 25, //ASP Priorities
                  },
                  attributes: ["id"],
                });
                let priorityId = null;
                if (priorityExist) {
                  priorityId = priorityExist.dataValues.id;
                }

                const ownPatrolName = ownPatrol.trim();
                let isOwnPatrol = 0;
                if (ownPatrolName == "Yes") {
                  isOwnPatrol = 1;
                }

                //REGIONAL MANAGER
                const userServiceResponse: any = await axios.post(
                  `${userServiceUrl}/user/${userServiceEndpoint.getUserByUserName}`,
                  { userName: String(rmContactNumber) }
                );
                let rmId = null;
                if (
                  userServiceResponse.data &&
                  userServiceResponse.data.success
                ) {
                  rmId = userServiceResponse.data.data.id;
                }

                const tierName = String(tier).trim();
                const tierExist: any = await Config.findOne({
                  where: {
                    name: tierName,
                    typeId: 29, //ASP TIERS
                  },
                  attributes: ["id"],
                });
                let tierId = null;
                if (tierExist) {
                  tierId = tierExist.dataValues.id;
                }

                aspExist.tierId = tierId;
                aspExist.performanceId = performanceId;
                aspExist.priorityId = priorityId;
                aspExist.isOwnPatrol = isOwnPatrol;
                aspExist.rmId = rmId;
                await aspExist.save();
              } else {
                console.log(`ASP (${aspCode}) not exists`);
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async dealerDataUpdationSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./dealerUpdationData.xlsx")
      );

      const dealerUpdationWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await dealerUpdationWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [
              ,
              dealerCode,
              legalName,
              tradeName,
              gstin,
              pan,
              cin,
              dealerType,
              rsaPersonName,
              rsaPersonNumber,
              rsaPersonAlterNateNumber,
              smName,
              smNumber,
              smAlternateNumber,
              oemAsmName,
              oemAsmNumber,
              oemAsmAlternateNumber,
              zone,
            ] = row.values;
            if (dealerCode) {
              const code = String(dealerCode).trim();
              const dealerExist: any = await Dealer.findOne({
                where: { code: code },
                attributes: ["id"],
                paranoid: false,
              });

              if (dealerExist) {
                const type = String(dealerType).trim();
                const typeExist: any = await Config.findOne({
                  where: {
                    name: type,
                    typeId: 22, //Dealer Types
                  },
                  attributes: ["id"],
                });
                let typeId = null;
                if (typeExist) {
                  typeId = typeExist.dataValues.id;
                }

                const dealerZone = String(zone).trim();
                const dealerZoneExist: any = await Config.findOne({
                  where: {
                    name: dealerZone,
                    typeId: 23, //Dealer Zones
                  },
                  attributes: ["id"],
                });
                let dealerZoneId = null;
                if (dealerZoneExist) {
                  dealerZoneId = dealerZoneExist.dataValues.id;
                }

                //SAVE
                dealerExist.legalName = legalName.trim();
                dealerExist.tradeName = tradeName.trim();
                dealerExist.gstin = String(gstin).trim();
                dealerExist.pan = String(pan).trim();
                if (cin) {
                  const trimedCin = String(cin).trim();
                  if (trimedCin) {
                    dealerExist.cin = trimedCin;
                  }
                }
                dealerExist.typeId = typeId;
                dealerExist.rsaPersonName = rsaPersonName.trim();
                dealerExist.rsaPersonNumber = String(rsaPersonNumber).trim();
                if (rsaPersonAlterNateNumber) {
                  const trimedRsaPersonAlterNateNumber = String(
                    rsaPersonAlterNateNumber
                  ).trim();
                  if (trimedRsaPersonAlterNateNumber) {
                    dealerExist.rsaPersonAlternateNumber =
                      trimedRsaPersonAlterNateNumber;
                  }
                }
                if (smName) {
                  const trimedSmName = smName.trim();
                  if (trimedSmName) {
                    dealerExist.smName = trimedSmName;
                  }
                }
                if (smNumber) {
                  const trimedSmNumber = String(smNumber).trim();
                  if (trimedSmNumber) {
                    dealerExist.smNumber = trimedSmNumber;
                  }
                }
                if (smAlternateNumber) {
                  const trimedSmAlternateNumber =
                    String(smAlternateNumber).trim();
                  if (trimedSmAlternateNumber) {
                    dealerExist.smAlternateNumber = trimedSmAlternateNumber;
                  }
                }
                if (oemAsmName) {
                  const trimedOemAsmName = oemAsmName.trim();
                  if (trimedOemAsmName) {
                    dealerExist.oemAsmName = trimedOemAsmName;
                  }
                }
                dealerExist.oemAsmNumber = String(oemAsmNumber).trim();
                if (oemAsmAlternateNumber) {
                  const trimedOemAsmAlternateNumber = String(
                    oemAsmAlternateNumber
                  ).trim();
                  if (trimedOemAsmAlternateNumber) {
                    dealerExist.oemAsmAlternateNumber =
                      trimedOemAsmAlternateNumber;
                  }
                }
                dealerExist.zoneId = dealerZoneId;
                await dealerExist.save();
              } else {
                console.log(`Dealer (${code}) not exists`);
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async aspMechanicUpdationSeeder(req: any, res: any) {
    try {
      // const workbook = new ExcelJS.Workbook();
      // await workbook.xlsx.readFile(
      //   path.resolve("seeder-files", "./aspMechanicUpdationData-1.xlsx")
      // );

      // const aspMechanicUpdationWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      // await aspMechanicUpdationWorksheet.eachRow(
      //   async (row: any, rowNumber: number) => {
      //     if (rowNumber !== 1) {
      //       const [
      //         ,
      //         aspCode,
      //         code,
      //         contactNumber,
      //         alternateContactNumber,
      //         performance,
      //         priority,
      //         address,
      //       ] = row.values;
      //       if (aspCode && code) {
      //         const trimedCode = String(code).trim();
      //         const trimedAspCode = String(aspCode).trim();
      //         const trimedContactNumber = String(contactNumber).trim();

      //         const aspExist: any = await Asp.findOne({
      //           where: { code: trimedAspCode },
      //           attributes: ["id"],
      //           paranoid: false,
      //         });

      //         if (aspExist) {
      //           const aspMechanicExist: any = await AspMechanic.findOne({
      //             where: {
      //               code: trimedCode,
      //               aspId: aspExist.dataValues.id,
      //               contactNumber: trimedContactNumber,
      //             },
      //             attributes: ["id"],
      //             paranoid: false,
      //           });

      //           if (aspMechanicExist) {
      //             const performanceName = performance.trim();
      //             const performanceExist: any = await Config.findOne({
      //               where: {
      //                 name: performanceName,
      //                 typeId: 24, //ASP Performances
      //               },
      //               attributes: ["id"],
      //             });
      //             let performanceId = null;
      //             if (performanceExist) {
      //               performanceId = performanceExist.dataValues.id;
      //             }

      //             const priorityName = String(priority).trim();
      //             const priorityExist: any = await Config.findOne({
      //               where: {
      //                 name: priorityName,
      //                 typeId: 25, //ASP Priorities
      //               },
      //               attributes: ["id"],
      //             });
      //             let priorityId = null;
      //             if (priorityExist) {
      //               priorityId = priorityExist.dataValues.id;
      //             }

      //             aspMechanicExist.performanceId = performanceId;
      //             aspMechanicExist.priorityId = priorityId;
      //             if (alternateContactNumber) {
      //               const trimedAlternateContactNumber = String(
      //                 alternateContactNumber
      //               ).trim();
      //               if (trimedAlternateContactNumber) {
      //                 aspMechanicExist.alternateContactNumber =
      //                   trimedAlternateContactNumber;
      //               }
      //             }
      //             aspMechanicExist.address = address.trim();
      //             await aspMechanicExist.save();
      //           } else {
      //             console.log(`ASP Mechanic (${code}) not exists`);
      //           }
      //         } else {
      //           console.log(`ASP (${aspCode}) not exists`);
      //         }
      //       }
      //     }
      //   }
      // );

      // VDM OWN PATROL PROCESS EXISTING ASP MECHANIC UPDATE

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./aspMechanicUpdationData.xlsx")
      );

      const aspMechanicUpdationWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await aspMechanicUpdationWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name, code, aspType, state, city] = row.values;
            if (id) {
              const [aspTypeExists, stateExists]: any = await Promise.all([
                Config.findOne({
                  attributes: ["id"],
                  where: {
                    name: String(aspType).trim(),
                    typeId: 57, //ASP Mechanic ASP Types
                  },
                  paranoid: false,
                }),
                State.findOne({
                  attributes: ["id"],
                  where: {
                    name: String(state).trim(),
                  },
                }),
              ]);

              const aspTypeId = aspTypeExists?.dataValues?.id || null;
              const stateId = stateExists?.dataValues?.id || null;

              let cityId = null;
              if (stateId) {
                const cityExists: any = await City.findOne({
                  where: {
                    name: String(city).trim(),
                    stateId: stateId,
                  },
                  attributes: ["id"],
                });
                cityId = cityExists?.dataValues?.id || null;
              }

              const aspMechanicExists = await AspMechanic.findOne({
                // where: { code: code },
                where: { id: id },
                attributes: ["id"],
                paranoid: false,
              });
              if (aspMechanicExists) {
                await AspMechanic.update(
                  {
                    aspTypeId: aspTypeId,
                    cityId: cityId,
                    locationCapturedViaId: 781, //STATIONARY
                    dynamicTypeId: null,
                  },
                  {
                    where: { id: aspMechanicExists.dataValues.id },
                    paranoid: false,
                  }
                );
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async mailConfigurationSeeder(req: any, res: any) {
    try {
      const mailConfigurations = [
        {
          id: 1,
          configId: 501, //ASP Unavailability Alert
          toEmail: "karthick.r@uitoux.in",
          ccEmail: "ramakrishnan@uitoux.in",
        },
        {
          id: 2,
          configId: 502, //Policy Interested Customer Report
          toEmail: "karthick.r@uitoux.in",
          ccEmail: "ramakrishnan@uitoux.in",
        },
      ];

      for (const mailConfiguration of mailConfigurations) {
        const mailConfigurationExists: any = await MailConfiguration.findOne({
          where: {
            id: mailConfiguration.id,
          },
          paranoid: false,
        });
        //CREATE
        if (!mailConfigurationExists) {
          await MailConfiguration.create(mailConfiguration);
        } else {
          //UPDATE
          await MailConfiguration.update(mailConfiguration, {
            where: {
              id: mailConfiguration.id,
            },
            paranoid: false,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Seeders Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async dispositionSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./dispositionData.xlsx")
      );

      const dispositionWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await dispositionWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, name, typeId] = row.values;

            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }
            if (!typeId) {
              console.log(`Record : ${rowNumber} typeId is required`);
            }
            if (name && typeId) {
              const trimedName = String(name).trim();

              const dispositionData = {
                name: trimedName,
                typeId: typeId,
              };

              const dispositionExist: any = await Disposition.findOne({
                where: { name: trimedName, typeId: typeId },
                attributes: ["id"],
                paranoid: false,
              });
              if (!dispositionExist) {
                await Disposition.create(dispositionData);
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async languageSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./languageData.xlsx")
      );

      const languageWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await languageWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name] = row.values;
          if (!name) {
            console.log(`Record : ${rowNumber} name is required`);
          }

          if (name) {
            const trimedName = String(name).trim();
            const contactLanguageData = {
              id: id,
              name: trimedName,
            };

            const contactLanguageExist: any = await Language.findOne({
              where: { id: id },
              attributes: ["id"],
              paranoid: false,
            });
            if (!contactLanguageExist) {
              await Language.create(contactLanguageData);
            }
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async serviceSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./serviceData.xlsx")
      );

      const serviceWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await serviceWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name] = row.values;
          if (!name) {
            console.log(`Record : ${rowNumber} name is required`);
          }

          if (name) {
            const trimedName = String(name).trim();
            const serviceData = {
              id: id,
              name: trimedName,
            };

            const serviceExist: any = await Service.findOne({
              where: { id: id },
              attributes: ["id"],
              paranoid: false,
            });
            if (!serviceExist) {
              await Service.create(serviceData);
            }
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async subServiceSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./subServiceData.xlsx")
      );

      const subServiceWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await subServiceWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [
            ,
            id,
            name,
            serviceName,
            hasLimit,
            hasAspAssignment,
            hasEntitlement,
            entitlementNames,
          ] = row.values;

          if (!name) {
            console.log(`Record : ${rowNumber} name is required`);
          }
          if (!serviceName) {
            console.log(`Record : ${rowNumber} service Name is required`);
          }
          if (name && serviceName) {
            const trimedName = String(name).trim();
            const trimedServiceName = String(serviceName).trim();

            const serviceExist: any = await Service.findOne({
              where: {
                name: trimedServiceName,
              },
              attributes: ["id"],
              paranoid: false,
            });
            let serviceId = null;
            if (serviceExist) {
              serviceId = serviceExist.dataValues.id;
            }

            const subServiceData = {
              id: id,
              name: trimedName,
              serviceId: serviceId,
              hasLimit: hasLimit,
              hasAspAssignment: hasAspAssignment,
              hasEntitlement: hasEntitlement,
            };

            const subServiceExist: any = await SubService.findOne({
              where: { id: id },
              attributes: ["id"],
              paranoid: false,
            });

            if (!subServiceExist) {
              await SubService.create(subServiceData);
            } else {
              await SubService.update(subServiceData, {
                where: { id: subServiceExist.dataValues.id },
              });
            }

            //PROCESS SUB SERVICE ENTITLEMENTS
            await SubServiceEntitlement.destroy({
              where: {
                subServiceId: id,
              },
              force: true,
            });

            if (hasEntitlement == 1 && entitlementNames) {
              const splittedEntitlementNames = entitlementNames.split(",");
              for (const splittedEntitlementName of splittedEntitlementNames) {
                const entitlementExist: any = await Entitlement.findOne({
                  attributes: ["id"],
                  where: { name: splittedEntitlementName },
                  paranoid: false,
                });
                if (entitlementExist) {
                  await SubServiceEntitlement.create({
                    subServiceId: id,
                    entitlementId: entitlementExist.id,
                  });
                }
              }
            }
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async talukSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./talukUpdationData.xlsx")
      );
      const talukWorksheet: any = workbook.getWorksheet(1);
      await talukWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name] = row.values;
          if (id && name) {
            const trimedName = String(name).trim();

            let talukData = {
              id: id,
              name: trimedName,
            };
            const talukExist = await Taluk.findOne({
              where: { id: id },
            });
            if (!talukExist) {
              await Taluk.create(talukData);
            } else {
              await Taluk.update(talukData, { where: { id: id } });
            }
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async conditionOfVehicleSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./conditionOfVehicleData.xlsx")
      );

      const conditionOfVehicleWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await conditionOfVehicleWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }

            if (name) {
              const trimedName = String(name).trim();
              const conditionOfVehicleData = {
                id: id,
                name: trimedName,
              };

              const conditionOfVehicleExist: any =
                await ConditionOfVehicle.findOne({
                  where: { id: id },
                  attributes: ["id"],
                  paranoid: false,
                });
              if (!conditionOfVehicleExist) {
                await ConditionOfVehicle.create(conditionOfVehicleData);
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async policyPremiumSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./policyPremiumData.xlsx")
      );

      const policyPremiumWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await policyPremiumWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }

            if (name) {
              const trimedName = String(name).trim();
              const policyPremiumData = {
                id: id,
                name: trimedName,
              };

              const policyPremiumExist: any = await PolicyPremium.findOne({
                where: { id: id },
                attributes: ["id"],
                paranoid: false,
              });
              if (!policyPremiumExist) {
                await PolicyPremium.create(policyPremiumData);
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async manualLocationReasonSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./manualLocationReasonData.xlsx")
      );

      const manualLocationReasonWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await manualLocationReasonWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }

            if (name) {
              const trimedName = String(name).trim();
              const manualLocationReasonData = {
                id: id,
                name: trimedName,
              };

              const manualLocationReasonExist: any =
                await ManualLocationReason.findOne({
                  where: { id: id },
                  attributes: ["id"],
                  paranoid: false,
                });
              if (!manualLocationReasonExist) {
                await ManualLocationReason.create(manualLocationReasonData);
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async caseCancelReasonSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./caseCancelReasonData.xlsx")
      );

      const caseCancelReasonWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await caseCancelReasonWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }

            if (name) {
              const trimedName = String(name).trim();
              const caseCancelReasonData = {
                id: id,
                name: trimedName,
              };

              const caseCancelReasonExist: any = await CaseCancelReason.findOne(
                {
                  where: { id: id },
                  attributes: ["id"],
                  paranoid: false,
                }
              );
              if (!caseCancelReasonExist) {
                await CaseCancelReason.create(caseCancelReasonData);
              } else {
                await CaseCancelReason.update(caseCancelReasonData, {
                  where: { id: caseCancelReasonExist.dataValues.id },
                });
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async vehicleTypeSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./vehicleTypeData.xlsx")
      );

      const vehicleTypeWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await vehicleTypeWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }

            if (name) {
              const trimedName = String(name).trim();
              const vehicleTypeData = {
                id: id,
                name: trimedName,
              };

              const vehicleTypeExist: any = await VehicleType.findOne({
                where: { id: id },
                attributes: ["id"],
                paranoid: false,
              });
              if (!vehicleTypeExist) {
                await VehicleType.create(vehicleTypeData);
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async vehicleMakeSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./vehicleMakeData.xlsx")
      );

      const vehicleMakeWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await vehicleMakeWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }

            if (name) {
              const trimedName = String(name).trim();
              const vehicleMakeData = {
                id: id,
                name: trimedName,
              };

              const vehicleMakeExist: any = await VehicleMake.findOne({
                where: { id: id },
                attributes: ["id"],
                paranoid: false,
              });
              if (!vehicleMakeExist) {
                await VehicleMake.create(vehicleMakeData);
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async vehicleModelSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./vehicleModelData.xlsx")
      );

      const vehicleModelWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await vehicleModelWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name, vehicleMakeName, deletedAt] = row.values;

            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }
            if (!vehicleMakeName) {
              console.log(
                `Record : ${rowNumber} vehicle make name is required`
              );
            }
            if (name && vehicleMakeName) {
              const trimedName = String(name).trim();
              const trimedVehicleMakeName = String(vehicleMakeName).trim();

              const makeExist: any = await VehicleMake.findOne({
                where: {
                  name: trimedVehicleMakeName,
                },
                attributes: ["id"],
                paranoid: false,
              });
              let vehicleMakeId = null;
              if (makeExist) {
                vehicleMakeId = makeExist.dataValues.id;
              }

              let deletedAtVal = null;
              if (typeof deletedAt !== "undefined") {
                deletedAtVal = new Date();
              }

              const vehicleModelData = {
                id: id,
                name: trimedName,
                vehicleMakeId: vehicleMakeId,
                deletedAt: deletedAtVal,
              };

              const vehicleModelExist: any = await VehicleModel.findOne({
                where: { id: id },
                attributes: ["id"],
                paranoid: false,
              });
              if (!vehicleModelExist) {
                await VehicleModel.create(vehicleModelData);
              } else {
                await VehicleModel.update(vehicleModelData, {
                  where: { id: vehicleModelExist.dataValues.id },
                });
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async caseSubjectSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./caseSubjectData.xlsx")
      );

      const caseSubjectWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await caseSubjectWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name, clientName, caseTypeName, services] = row.values;

            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }
            if (!clientName) {
              console.log(`Record : ${rowNumber} client name is required`);
            }
            if (!caseTypeName) {
              console.log(`Record : ${rowNumber} case type is required`);
            }

            if (name && clientName && caseTypeName) {
              const trimedName = String(name).trim();
              const trimedClientName = String(clientName).trim();

              const clientExist: any = await Client.findOne({
                where: {
                  name: trimedClientName,
                },
                attributes: ["id"],
                paranoid: false,
              });
              if (!clientExist) {
                console.log(`Record : ${rowNumber} client "${trimedClientName}" not found`);
                return;
              }
              const clientId = clientExist.dataValues.id;

              // Handle Case Type field - map by name to caseTypeId (required)
              // Normalize dash characters (en dash, em dash) to regular hyphen and normalize spaces
              const trimmedCaseTypeName = String(caseTypeName)
                .trim()
                .replace(/[–—]/g, "-") // Replace en dash (U+2013) and em dash (U+2014) with regular hyphen
                .replace(/\s+/g, " "); // Normalize multiple spaces to single space

              // Try exact match first
              let caseType: any = await Config.findOne({
                where: {
                  name: trimmedCaseTypeName,
                  typeId: 38, // Case Creation Types
                },
                attributes: ["id"],
              });

              // If not found, try case-insensitive search
              if (!caseType) {
                const allCaseTypes: any = await Config.findAll({
                  where: {
                    typeId: 38, // Case Creation Types
                  },
                  attributes: ["id", "name"],
                });
                caseType = allCaseTypes.find((ct: any) =>
                  ct.name.trim().replace(/[–—]/g, "-").replace(/\s+/g, " ").toLowerCase() ===
                  trimmedCaseTypeName.toLowerCase()
                );
              }

              if (!caseType) {
                console.log(`Record : ${rowNumber} case type "${trimmedCaseTypeName}" not found`);
                return;
              }
              const caseTypeId = caseType.dataValues.id;

              const caseSubjectData = {
                id: id,
                name: trimedName,
                clientId: clientId,
                caseTypeId: caseTypeId,
              };

              const caseSubjectExist: any = await CaseSubject.findOne({
                where: { id: id },
                attributes: ["id"],
                paranoid: false,
              });
              let caseSubjectId = null;
              if (!caseSubjectExist) {
                const newCaseSubject = await CaseSubject.create(
                  caseSubjectData
                );
                caseSubjectId = newCaseSubject.dataValues.id;
              } else {
                // Update existing case subject
                await CaseSubject.update(caseSubjectData, {
                  where: { id: id },
                  paranoid: false,
                });
                caseSubjectId = caseSubjectExist.dataValues.id;
              }

              //SERVICES
              // Get existing services for this case subject
              const existingSubjectServices: any = await SubjectService.findAll({
                where: { subjectId: caseSubjectId },
                attributes: ["id", "serviceId"],
                paranoid: false,
              });

              // Collect service IDs from Excel
              const excelServiceIds: number[] = [];
              if (services) {
                let servicesNames = String(services).trim().split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                for (const serviceName of servicesNames) {
                  const serviceExist: any = await Service.findOne({
                    where: {
                      name: serviceName,
                    },
                    attributes: ["id"],
                    paranoid: false,
                  });

                  if (serviceExist) {
                    const serviceId = serviceExist.dataValues.id;
                    excelServiceIds.push(serviceId);

                    const subjectServiceData = {
                      subjectId: caseSubjectId,
                      serviceId: serviceId,
                    };

                    const subjectServiceExist: any = await SubjectService.findOne(
                      {
                        where: { subjectId: caseSubjectId, serviceId: serviceId },
                        attributes: ["id"],
                        paranoid: false,
                      }
                    );
                    if (!subjectServiceExist) {
                      await SubjectService.create(subjectServiceData);
                    }
                  }
                }
              }

              // Delete services that are not in the Excel file
              for (const existingService of existingSubjectServices) {
                if (!excelServiceIds.includes(existingService.dataValues.serviceId)) {
                  await SubjectService.destroy({
                    where: {
                      id: existingService.dataValues.id,
                    },
                    force: true,
                  });
                }
              }
            }
          }
        }
      );

      // Process Sheet 2 - Case Subject Questionnaires
      const questionnaireWorksheet: any = workbook.getWorksheet(2);
      if (questionnaireWorksheet) {
        await questionnaireWorksheet.eachRow(
          async (row: any, rowNumber: number) => {
            if (rowNumber !== 1) {
              const [, caseSubjectName, clientName, question, answerTypeName, sequence] = row.values;

              if (!caseSubjectName) {
                console.log(`Questionnaire Record ${rowNumber}: Case Subject Name is required`);
                return;
              }
              if (!clientName) {
                console.log(`Questionnaire Record ${rowNumber}: Client Name is required`);
                return;
              }
              if (!question) {
                console.log(`Questionnaire Record ${rowNumber}: Question is required`);
                return;
              }
              if (!answerTypeName) {
                console.log(`Questionnaire Record ${rowNumber}: Answer Type Name is required`);
                return;
              }
              if (sequence === null || sequence === undefined || sequence === '') {
                console.log(`Questionnaire Record ${rowNumber}: Sequence is required`);
                return;
              }

              const trimmedCaseSubjectName = String(caseSubjectName).trim();
              const trimmedQuestion = String(question).trim();
              const trimmedAnswerTypeName = String(answerTypeName).trim();
              const trimmedClientName = String(clientName).trim();

              // Find Client
              const clientExist: any = await Client.findOne({
                where: {
                  name: trimmedClientName,
                },
                attributes: ["id"],
                paranoid: false,
              });

              if (!clientExist) {
                console.log(
                  `Questionnaire Record ${rowNumber}: Client "${trimmedClientName}" not found`
                );
                return;
              }

              // Find Case Subject
              let caseSubjectId = null;
              const caseSubjectWhere: any = {
                name: trimmedCaseSubjectName,
                clientId: clientExist.dataValues.id,
              };

              const caseSubjectExist: any = await CaseSubject.findOne({
                where: caseSubjectWhere,
                attributes: ["id"],
                paranoid: false,
              });

              if (!caseSubjectExist) {
                console.log(
                  `Questionnaire Record ${rowNumber}: Case Subject "${trimmedCaseSubjectName}" not found`
                );
                return;
              }
              caseSubjectId = caseSubjectExist.dataValues.id;

              // Find Answer Type
              const answerTypeExist: any = await AnswerType.findOne({
                where: {
                  name: trimmedAnswerTypeName,
                },
                attributes: ["id"],
                paranoid: false,
              });

              if (!answerTypeExist) {
                console.log(
                  `Questionnaire Record ${rowNumber}: Answer Type "${trimmedAnswerTypeName}" not found`
                );
                return;
              }
              const answerTypeId = answerTypeExist.dataValues.id;

              // Parse Sequence
              const parsedSequence = parseInt(String(sequence));
              if (isNaN(parsedSequence) || parsedSequence < 0) {
                console.log(
                  `Questionnaire Record ${rowNumber}: Sequence must be a valid non-negative number`
                );
                return;
              }
              const sequenceValue = parsedSequence;

              // Check if questionnaire already exists
              const questionnaireExist: any = await CaseSubjectQuestionnaire.findOne({
                where: {
                  caseSubjectId: caseSubjectId,
                  question: trimmedQuestion,
                  answerTypeId: answerTypeId,
                },
                attributes: ["id"],
                paranoid: false,
              });

              if (!questionnaireExist) {
                await CaseSubjectQuestionnaire.create({
                  caseSubjectId: caseSubjectId,
                  question: trimmedQuestion,
                  answerTypeId: answerTypeId,
                  sequence: sequenceValue,
                });
              } else {
                // Update existing questionnaire if needed (e.g., sequence changed)
                await CaseSubjectQuestionnaire.update(
                  {
                    sequence: sequenceValue,
                  },
                  {
                    where: {
                      id: questionnaireExist.dataValues.id,
                    },
                    paranoid: false,
                  }
                );
              }
            }
          }
        );
      }

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async entitlementSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./entitlementData.xlsx")
      );

      const entitlementWorksheet: any = workbook.getWorksheet(1); // Assuming data is in the first worksheet
      await entitlementWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name, unit, hasLimit] = row.values;

            if (!name) {
              console.log(`Record : ${rowNumber} name is required`);
            }
            if (!unit) {
              console.log(`Record : ${rowNumber} unit is required`);
            }
            if (!hasLimit) {
              console.log(`Record : ${rowNumber} has limit is required`);
            }

            if (name) {
              const trimedName = String(name).trim();
              const trimedUnit = String(unit).trim();
              const trimedHasLimit = Number(hasLimit);

              const unitExist: any = await Config.findOne({
                where: {
                  typeId: 44, //ENTITLEMENT UNITS
                  name: trimedUnit,
                },
                attributes: ["id"],
              });
              let unitId = null;
              if (unitExist) {
                unitId = unitExist.dataValues.id;
              }

              const entitlementData = {
                id: id,
                name: trimedName,
                unitId: unitId,
                hasLimit: trimedHasLimit,
              };

              const entitlementExist: any = await Entitlement.findOne({
                where: { id: id },
                attributes: ["id"],
                paranoid: false,
              });
              if (!entitlementExist) {
                await Entitlement.create(entitlementData);
              } else {
                await Entitlement.update(entitlementData, {
                  where: { id: entitlementExist.dataValues.id },
                });
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  public async nspFilterSeeder(req: any, res: any) {
    try {
      const nspFilters = [
        {
          id: 1,
          typeId: 31, //RSA
          name: "Nearest ASP to Breakdown Location",
          limitQuery: 10,
          havingQuery: "distance <= 30",
          kmLimit: "30",
          displayOrder: 1,
        },
        {
          id: 2,
          typeId: 31, //RSA
          name: "Nearest ASP to Drop Location",
          limitQuery: 10,
          havingQuery: "distance <= 10",
          kmLimit: "10",
          displayOrder: 2,
        },
        {
          id: 3,
          typeId: 31, //RSA
          name: "Nearest 5 ASP’s",
          limitQuery: 5,
          havingQuery: "distance <= 30",
          kmLimit: "30",
          displayOrder: 3,
        },
        {
          id: 4,
          typeId: 31, //RSA
          name: "30 km – 100 km",
          limitQuery: 10,
          havingQuery: "distance >= 30 AND distance <= 100",
          kmLimit: "100",
          displayOrder: 4,
        },
        {
          id: 5,
          typeId: 31, //RSA
          name: "100 km – 200 km",
          limitQuery: 10,
          havingQuery: "distance >= 100 AND distance <= 200",
          kmLimit: "200",
          displayOrder: 5,
        },
        {
          id: 6,
          typeId: 31, //RSA
          name: "200 km – 500 km",
          limitQuery: 10,
          havingQuery: "distance >= 200 AND distance <= 500",
          kmLimit: "500",
          displayOrder: 6,
        },

        {
          id: 7,
          typeId: 32, //Vehicle Delivery
          name: "Nearest ASP to Pickup Location",
          limitQuery: 10,
          havingQuery: "distance <= 50",
          kmLimit: "50",
          displayOrder: 1,
        },
        {
          id: 8,
          typeId: 32, //Vehicle Delivery
          name: "Nearest ASP to Drop Location",
          limitQuery: 10,
          havingQuery: "distance <= 50",
          kmLimit: "50",
          displayOrder: 2,
        },
        {
          id: 9,
          typeId: 32, //Vehicle Delivery
          name: "Nearest 5 ASP’s",
          limitQuery: 5,
          havingQuery: "distance <= 50",
          kmLimit: "50",
          displayOrder: 3,
        },
        {
          id: 10,
          typeId: 32, //Vehicle Delivery
          name: "50 km – 100 km",
          limitQuery: 10,
          havingQuery: "distance >= 50 AND distance <= 100",
          kmLimit: "100",
          displayOrder: 4,
        },
        {
          id: 11,
          typeId: 32, //Vehicle Delivery
          name: "100 km – 200 km",
          limitQuery: 10,
          havingQuery: "distance >= 100 AND distance <= 200",
          kmLimit: "200",
          displayOrder: 5,
        },
        {
          id: 12,
          typeId: 32, //Vehicle Delivery
          name: "200 km – 500 km",
          limitQuery: 10,
          havingQuery: "distance >= 200 AND distance <= 500",
          kmLimit: "500",
          displayOrder: 6,
        },
      ];

      for (const nspFilter of nspFilters) {
        const nspFilterExists: any = await NspFilter.findOne({
          where: {
            id: nspFilter.id,
          },
          paranoid: false,
        });
        //CREATE
        if (!nspFilterExists) {
          await NspFilter.create(nspFilter);
        } else {
          //UPDATE
          await NspFilter.update(nspFilter, {
            where: {
              id: nspFilter.id,
            },
            paranoid: false,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Seeders Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async districtSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./districtUpdationData.xlsx")
      );
      const districtWorksheet: any = workbook.getWorksheet(1);
      await districtWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name] = row.values;
          if (id && name) {
            const trimedName = String(name).trim();
            let districtData = {
              id: id,
              name: trimedName,
            };
            const districtExist = await District.findOne({
              where: { id: id },
            });
            if (!districtExist) {
              await District.create(districtData);
            } else {
              await District.update(districtData, { where: { id: id } });
            }
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async nearestCitySeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./nearestCityUpdationData.xlsx")
      );
      const nearestCityWorksheet: any = workbook.getWorksheet(1);
      await nearestCityWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (id && name) {
              const trimedName = String(name).trim();
              let nearestCityData = {
                id: id,
                name: trimedName,
              };
              const nearestCityExist = await NearestCity.findOne({
                where: { id: id },
              });
              if (!nearestCityExist) {
                await NearestCity.create(nearestCityData);
              } else {
                await NearestCity.update(nearestCityData, {
                  where: { id: id },
                });
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async cityUpdationSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./cityUpdationData.xlsx")
      );
      const cityUpdationWorksheet: any = workbook.getWorksheet(1);

      const rows: any = [];
      cityUpdationWorksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          rows.push(row.values);
        }
      });

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const promises = batch.map(async (row: any) => {
          const [
            ,
            id,
            office,
            taluk,
            district,
            state,
            pinCode,
            latitude,
            longitude,
            locationType,
            municipalLimit,
            nearestCity,
            locationCategory,
            rmId,
            regionalManagerName,
          ] = row;

          if (id) {
            const trimedOffice = String(office).trim();
            const trimedTaluk = taluk ? String(taluk).trim() : null;
            const trimedDistrict = district ? String(district).trim() : null;
            const trimedPinCode = pinCode ? String(pinCode).trim() : null;
            const trimedLatitude = latitude ? String(latitude).trim() : null;
            const trimedLongitude = longitude ? String(longitude).trim() : null;
            const trimedLocationType = locationType
              ? String(locationType).trim()
              : null;
            const trimedMunicipalLimit = municipalLimit
              ? String(municipalLimit).trim()
              : null;
            const trimedNearestCity = nearestCity
              ? String(nearestCity).trim()
              : null;
            const trimedLocationCategory = locationCategory
              ? String(locationCategory).trim()
              : null;

            const [
              talukExists,
              districtExists,
              locationTypeExists,
              municipalLimitExists,
              nearestCityExists,
              locationCategoryExists,
              cityExists,
            ]: any = await Promise.all([
              Taluk.findOne({
                where: { name: trimedTaluk },
                attributes: ["id"],
                paranoid: false,
              }),
              District.findOne({
                where: { name: trimedDistrict },
                attributes: ["id"],
                paranoid: false,
              }),
              Config.findOne({
                where: { name: trimedLocationType, typeId: 53 },
                attributes: ["id"],
              }),
              Config.findOne({
                where: { name: trimedMunicipalLimit, typeId: 54 },
                attributes: ["id"],
              }),
              NearestCity.findOne({
                where: { name: trimedNearestCity },
                attributes: ["id"],
                paranoid: false,
              }),
              Config.findOne({
                where: { name: trimedLocationCategory, typeId: 55 },
                attributes: ["id"],
              }),
              City.findOne({
                where: { id: id },
                attributes: ["id"],
                paranoid: false,
              }),
            ]);

            if (cityExists) {
              cityExists.name = trimedOffice;
              cityExists.talukId = talukExists
                ? talukExists.dataValues.id
                : null;
              cityExists.districtId = districtExists
                ? districtExists.dataValues.id
                : null;
              cityExists.pincode = trimedPinCode;
              cityExists.latitude = trimedLatitude;
              cityExists.longitude = trimedLongitude;
              cityExists.locationTypeId = locationTypeExists
                ? locationTypeExists.dataValues.id
                : null;
              cityExists.municipalLimitId = municipalLimitExists
                ? municipalLimitExists.dataValues.id
                : null;
              cityExists.nearestCityId = nearestCityExists
                ? nearestCityExists.dataValues.id
                : null;
              cityExists.locationCategoryId = locationCategoryExists
                ? locationCategoryExists.dataValues.id
                : null;
              cityExists.rmId = rmId ? rmId : null;
              return cityExists.save();
            } else {
              console.log(`CITY (${office}) not exists`);
            }
          }
        });

        await Promise.all(promises);
      }

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async shiftUpdationSeeder(req: any, res: any) {
    try {
      const shifts = [
        {
          id: 1,
          name: "Weekly Off",
          value: null,
          typeId: 3, //BOTH
          displayOrder: 1,
        },
        {
          id: 2,
          name: "8 Hours",
          value: "28800",
          typeId: 1, //VDM
          displayOrder: 2,
        },
        {
          id: 3,
          name: "12 Hours",
          value: "43200",
          typeId: 1, //VDM
          displayOrder: 3,
        },
        {
          id: 4,
          name: "14 Hours",
          value: "50400",
          typeId: 1, //VDM
          displayOrder: 4,
        },
        {
          id: 5,
          name: "16 Hours",
          value: "57600",
          typeId: 1, //VDM
          displayOrder: 5,
        },
        {
          id: 6,
          name: "24 Hours",
          value: "86400",
          typeId: 1, //VDM
          displayOrder: 6,
        },
        {
          id: 7,
          name: "Off-Shift",
          value: "86400",
          typeId: 1, //VDM
          displayOrder: 7,
        },
        {
          id: 8,
          name: "12 Hrs Day Shift",
          value: "43200",
          typeId: 2, //RSA
          displayOrder: 2,
        },
        {
          id: 9,
          name: "12 Hrs Night Shift",
          value: "43200",
          typeId: 2, //RSA
          displayOrder: 3,
        },
        {
          id: 10,
          name: "24 Hrs Shift",
          value: "86400",
          typeId: 2, //RSA
          displayOrder: 4,
        },
        {
          id: 11,
          name: "12 Hrs Week Off On Duty",
          value: "43200",
          typeId: 2, //RSA
          displayOrder: 5,
        },
        {
          id: 12,
          name: "24 Hrs Week Off On Duty",
          value: "86400",
          typeId: 2, //RSA
          displayOrder: 6,
        },
      ];

      for (const shift of shifts) {
        const shiftExist = await Shift.findOne({
          where: { id: shift.id },
        });
        if (shiftExist) {
          await Shift.update(shift, { where: { id: shift.id } });
        } else {
          await Shift.create(shift);
        }
      }
      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async serviceOrganizationSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./serviceOrganizationData.xlsx")
      );
      const serviceOrganizationWorksheet: any = workbook.getWorksheet(1);
      await serviceOrganizationWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (id && name) {
              const trimedName = String(name).trim();
              let serviceOrganizationData = {
                id: id,
                name: trimedName,
              };
              const serviceOrganizationExist =
                await ServiceOrganisation.findOne({
                  where: { id: id },
                  paranoid: false,
                });
              if (!serviceOrganizationExist) {
                await ServiceOrganisation.create(serviceOrganizationData);
              } else {
                await ServiceOrganisation.update(serviceOrganizationData, {
                  where: { id: id },
                });
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // OWN PATROL ASP CREATION ONLY
  public async vdmOwnPatrolAspSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./vdmOwnPatrolAspData.xlsx")
      );
      const ownPatrolAspWorksheet: any = workbook.getWorksheet(1);

      const rows: any = [];
      ownPatrolAspWorksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          rows.push(row.values);
        }
      });

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const promises = batch.map(async (row: any) => {
          const [
            ,
            tier,
            axaptaCode,
            salutation,
            name,
            aspCode,
            workshopName,
            email,
            whatsAppNumber,
            contactNumber,
            workingHours,
            performance,
            priority,
            regionalManagerUserName,
            addressLineOne,
            addressLineTwo,
            state,
            city,
            pincode,
            location,
            latitude,
            longitude,
          ] = row;

          if (aspCode) {
            const [
              tierExists,
              salutationExists,
              workingHourExists,
              performanceExists,
              priorityExists,
              stateExists,
              rmExists,
            ]: any = await Promise.all([
              Config.findOne({
                where: {
                  name: String(tier).trim(),
                  typeId: 29, //ASP TIERS
                },
                attributes: ["id"],
              }),
              Config.findOne({
                where: {
                  name: String(salutation).trim(),
                  typeId: 9, //Salutations
                },
                attributes: ["id"],
              }),
              Config.findOne({
                where: {
                  name: String(workingHours).trim(),
                  typeId: 10, //ASP Working Hours
                },
                attributes: ["id"],
              }),
              Config.findOne({
                where: {
                  name: String(performance).trim(),
                  typeId: 24, //ASP Performances
                },
                attributes: ["id"],
              }),
              Config.findOne({
                where: {
                  name: Number(priority) + 1,
                  typeId: 25, //ASP Priorities
                },
                attributes: ["id"],
              }),
              State.findOne({
                attributes: ["id", "name"],
                where: {
                  name: String(state).trim(),
                },
                paranoid: false,
              }),
              axios.post(
                `${userServiceUrl}/user/${userServiceEndpoint.getUserByUserName}`,
                { userName: String(regionalManagerUserName).trim() }
              ),
            ]);

            const tierId = tierExists?.dataValues?.id || null;
            const salutationId = salutationExists?.dataValues?.id || null;
            const workingHourId = workingHourExists?.dataValues?.id || null;
            const performanceId = performanceExists?.dataValues?.id || null;
            const priorityId = priorityExists?.dataValues?.id || null;
            const rmId = rmExists?.data?.data?.id || null;
            const stateId = stateExists?.dataValues?.id || null;
            const isOwnPatrol = 1;
            let cityId = null;
            if (stateId) {
              const cityExists: any = await City.findOne({
                where: {
                  name: String(city).trim(),
                  stateId: stateId,
                },
                attributes: ["id"],
              });
              cityId = cityExists?.dataValues?.id || null;
            }

            await Asp.findOrCreate({
              where: { code: aspCode },
              defaults: {
                tierId: tierId,
                axaptaCode: axaptaCode,
                salutationId: salutationId,
                workingHourId: workingHourId,
                code: aspCode,
                name: name,
                workshopName: workshopName ? workshopName : null,
                email: email ? email : null,
                whatsAppNumber: whatsAppNumber ? whatsAppNumber : null,
                contactNumber: contactNumber ? contactNumber : null,
                performanceId: performanceId,
                priorityId: priorityId,
                isOwnPatrol: isOwnPatrol,
                rmId: rmId,
                latitude: latitude ? latitude : null,
                longitude: longitude ? longitude : null,
                addressLineOne: addressLineOne ? addressLineOne : null,
                addressLineTwo: addressLineTwo ? addressLineTwo : null,
                stateId: stateId,
                cityId: cityId,
                location: location ? location : null,
                pincode: pincode ? pincode : null,
                hasMechanic: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
              },
            });
          }
        });
        await Promise.all(promises);
      }

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async ownPatrolVehicleSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./ownPatrolVehicleData.xlsx")
      );
      const ownPatrolVehicleWorksheet: any = workbook.getWorksheet(1);

      const rows: any = [];
      ownPatrolVehicleWorksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          rows.push(row.values);
        }
      });

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const promises = batch.map(async (row: any) => {
          const [
            ,
            vehicleRegistrationNumber,
            vehicleType,
            aspCode,
            gpsDeviceId,
            serviceOrganisation,
            lastLatitude,
            lastLongitude,
            lastGpsCaptured,
          ] = row;

          if (vehicleRegistrationNumber) {
            const trimedVehicleRegistrationNumber = String(
              vehicleRegistrationNumber
            ).trim();
            const trimedVehicleType = vehicleType
              ? String(vehicleType).trim()
              : null;
            const trimedAspCode = aspCode ? String(aspCode).trim() : null;
            const trimedGpsDeviceId = gpsDeviceId
              ? String(gpsDeviceId).trim()
              : null;
            const trimedServiceOrganisation = serviceOrganisation
              ? String(serviceOrganisation).trim()
              : null;
            const trimedLastLatitude = lastLatitude
              ? String(lastLatitude).trim()
              : null;
            const trimedLastLongitude = lastLongitude
              ? String(lastLongitude).trim()
              : null;
            const trimedLastGpsCaptured = lastGpsCaptured
              ? String(lastGpsCaptured).trim()
              : null;

            const [
              vehicleTypeExists,
              aspExists,
              serviceOrganisationExists,
              ownPatrolVehicleExists,
            ]: any = await Promise.all([
              VehicleType.findOne({
                where: { name: trimedVehicleType },
                attributes: ["id"],
                paranoid: false,
              }),
              Asp.findOne({
                where: { code: trimedAspCode },
                attributes: ["id"],
                paranoid: false,
              }),
              ServiceOrganisation.findOne({
                where: { name: trimedServiceOrganisation },
                attributes: ["id"],
                paranoid: false,
              }),
              OwnPatrolVehicle.findOne({
                where: {
                  vehicleRegistrationNumber: trimedVehicleRegistrationNumber,
                },
                attributes: ["id"],
                paranoid: false,
              }),
            ]);

            let data: any = {
              vehicleRegistrationNumber: trimedVehicleRegistrationNumber,
              vehicleTypeId: vehicleTypeExists
                ? vehicleTypeExists.dataValues.id
                : null,
              aspId: aspExists ? aspExists.dataValues.id : null,
              gpsDeviceId: trimedGpsDeviceId,
              serviceOrganisationId: serviceOrganisationExists
                ? serviceOrganisationExists.dataValues.id
                : null,
              lastLatitude: trimedLastLatitude,
              lastLongitude: trimedLastLongitude,
              lastGpsCaptured: trimedLastGpsCaptured,
            };

            if (!ownPatrolVehicleExists) {
              await OwnPatrolVehicle.create(data);
            } else {
              await OwnPatrolVehicle.update(data, {
                where: {
                  vehicleRegistrationNumber: trimedVehicleRegistrationNumber,
                },
              });
            }
          }
        });
        await Promise.all(promises);
      }

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async ownPatrolVehicleHelperSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./ownPatrolVehicleHelperData.xlsx")
      );
      const ownPatrolVehicleHelperWorksheet: any = workbook.getWorksheet(1);

      const rows: any = [];
      ownPatrolVehicleHelperWorksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          rows.push(row.values);
        }
      });

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const promises = batch.map(async (row: any) => {
          const [
            ,
            code,
            name,
            email,
            mobileNumber,
            address,
            stateName,
            cityName,
            username,
            password,
            changePassword,
            status,
          ] = row;

          if (code) {
            const [ownPatrolVehicleHelperExists, stateExists]: any =
              await Promise.all([
                OwnPatrolVehicleHelper.findOne({
                  attributes: ["id"],
                  where: {
                    code: String(code).trim(),
                  },
                  paranoid: false,
                }),
                State.findOne({
                  attributes: ["id", "name"],
                  where: {
                    name: String(stateName).trim(),
                  },
                  paranoid: false,
                }),
              ]);
            const stateId = stateExists?.dataValues?.id || null;
            let cityId = null;
            if (stateId) {
              const cityExists: any = await City.findOne({
                where: {
                  name: String(cityName).trim(),
                  stateId: stateId,
                },
                attributes: ["id"],
              });
              cityId = cityExists?.dataValues?.id || null;
            }

            let deletedAt = null;
            //INACTIVE
            if (status.toLowerCase() == "inactive") {
              deletedAt = new Date();
            }

            const data: any = {
              code: code,
              name: name,
              email: email ? email : null,
              mobileNumber: mobileNumber,
              address: address ? address : null,
              cityId: cityId,
              deletedAt: deletedAt,
            };

            let userEntityId = null;
            if (!ownPatrolVehicleHelperExists) {
              const newOwnPatrolVehicleHelper: any =
                await OwnPatrolVehicleHelper.create(data);
              userEntityId = newOwnPatrolVehicleHelper.dataValues.id;
            } else {
              await OwnPatrolVehicleHelper.update(data, {
                where: {
                  id: ownPatrolVehicleHelperExists.dataValues.id,
                },
              });
              userEntityId = ownPatrolVehicleHelperExists.dataValues.id;
            }

            const getEntityUser: any = await axios.get(
              `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getEntityUser}?userTypeId=144&entityId=${userEntityId}`
            );

            const userData = {
              userId: getEntityUser?.data?.data?.id || null,
              roleId: 9,
              userTypeId: 144, //OWN PATROL VEHICLE HELPER
              entityId: userEntityId,
              code: String(code).trim(),
              name: name,
              mobileNumber: String(mobileNumber).trim(),
              email: email ? email : null,
              userName: String(username).trim(),
              password: String(password).trim(),
              address: address ? address : null,
              changePassword: changePassword.toLowerCase() == "yes" ? 1 : 0,
              status: status.toLowerCase() == "active" ? 1 : 0,
            };

            //SAVE USER ENTITY
            const saveUserEntity = await axios.post(
              `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
              userData
            );
            if (!saveUserEntity.data.success) {
              console.log(code, saveUserEntity.data);
            }
          }
        });
        await Promise.all(promises);
      }

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  // ASP MECHANIC(BOTH COCO & THIRD PARTY) CREATION ONLY
  public async aspMechanicSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./aspMechanics.xlsx")
      );
      const aspMechanicAspTypeWorksheet: any = workbook.getWorksheet(1);
      const rows: any = [];
      aspMechanicAspTypeWorksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          rows.push(row.values);
        }
      });

      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const promises = batch.map(async (row: any) => {
          const [
            ,
            aspType,
            aspCode,
            name,
            code,
            email,
            contactNumber,
            alternateContactNumber,
            latitude,
            longitude,
            performance,
            priority,
            address,
            state,
            city,
            locationCaptureVia,
            dynamicType,
            username,
            password,
          ] = row;

          if (code) {
            const [
              aspTypeExists,
              performanceExists,
              priorityExists,
              stateExists,
              locationCapturedViaExists,
              dynamicTypeExists,
              aspMechanicExists,
            ]: any = await Promise.all([
              Config.findOne({
                attributes: ["id"],
                where: {
                  name: String(aspType).trim(),
                  typeId: 57, //ASP Types
                },
              }),
              Config.findOne({
                attributes: ["id"],
                where: {
                  name: String(performance).trim(),
                  typeId: 24, //ASP Performance
                },
              }),
              Config.findOne({
                attributes: ["id"],
                where: {
                  name: String(priority).trim(),
                  typeId: 25, //ASP Priority
                },
              }),
              State.findOne({
                attributes: ["id"],
                where: {
                  name: String(state).trim(),
                },
              }),
              locationCaptureVia
                ? Config.findOne({
                  attributes: ["id"],
                  where: {
                    name: String(locationCaptureVia).trim(),
                    typeId: 58, //Location Capture Via Types
                  },
                })
                : Promise.resolve(null),
              dynamicType
                ? Config.findOne({
                  attributes: ["id"],
                  where: {
                    name: String(dynamicType).trim(),
                    typeId: 59, //Dynamic Types
                  },
                })
                : Promise.resolve(null),
              AspMechanic.findOne({
                where: {
                  code: String(code).trim(),
                },
                attributes: ["id"],
                paranoid: false,
              }),
            ]);

            const aspTypeId = aspTypeExists?.dataValues?.id || null;
            const performanceId = performanceExists?.dataValues?.id || null;
            const priorityId = priorityExists?.dataValues?.id || null;
            const locationCapturedViaId =
              locationCapturedViaExists?.dataValues?.id || null;
            const dynamicTypeId = dynamicTypeExists?.dataValues?.id || null;

            const stateId = stateExists?.dataValues?.id || null;
            let cityId = null;
            if (stateId) {
              const cityExists: any = await City.findOne({
                where: {
                  name: String(city).trim(),
                  stateId: stateId,
                },
                attributes: ["id"],
              });
              cityId = cityExists?.dataValues?.id || null;
            }

            let aspId = null;
            // IF THIRD PARTY TYPE
            if (aspTypeId == 772) {
              const aspExists: any = await Asp.findOne({
                where: {
                  code: String(aspCode).trim(),
                },
                attributes: ["id"],
                paranoid: false,
              });
              aspId = aspExists?.dataValues?.id || null;
            }

            // CREATE IF ASP MECHANIC NOT EXISTS
            if (!aspMechanicExists) {
              const newAspMechanic = await AspMechanic.create({
                aspTypeId: aspTypeId,
                aspId: aspId,
                name: name,
                code: code,
                email: email ? email : null,
                contactNumber: contactNumber,
                alternateContactNumber: alternateContactNumber
                  ? alternateContactNumber
                  : null,
                latitude: latitude ? latitude : null,
                longitude: longitude ? longitude : null,
                performanceId: performanceId,
                priorityId: priorityId,
                address: address ? address : null,
                cityId: cityId,
                locationCapturedViaId: locationCapturedViaId
                  ? locationCapturedViaId
                  : null,
                dynamicTypeId: dynamicTypeId ? dynamicTypeId : null,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
              });

              const aspMechanicUserData = {
                userId: null,
                roleId: 5,
                userTypeId: 143, //ASP MECHANIC
                entityId: newAspMechanic.dataValues.id,
                code: String(code).trim(),
                name: name,
                mobileNumber: String(contactNumber).trim(),
                email: email,
                userName: String(username).trim(),
                password: String(password).trim(),
                address: address,
                changePassword: 1,
                status: 1,
              };

              //SAVE USER ENTITY
              const saveAspMechanicUserEntity = await axios.post(
                `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.save}`,
                aspMechanicUserData
              );
              if (!saveAspMechanicUserEntity.data.success) {
                console.log(saveAspMechanicUserEntity.data);
              }
            }
          }
        });
        await Promise.all(promises);
      }

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async aspMechanicSubServiceSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./aspMechanicSubServiceData.xlsx")
      );

      const aspMechanicSubServiceWorksheet: any = workbook.getWorksheet(1);
      await aspMechanicSubServiceWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, aspMechanicCode, subServiceName] = row.values;
            if (aspMechanicCode && subServiceName) {
              const trimmedAspMechanicCode = String(aspMechanicCode).trim();
              const trimmedSubServiceName = String(subServiceName).trim();

              const [aspMechanicExist, subServiceExist] = await Promise.all([
                AspMechanic.findOne({
                  attributes: ["id"],
                  where: { id: id },
                  // where: { code: trimmedAspMechanicCode },
                  paranoid: false,
                }),
                SubService.findOne({
                  attributes: ["id"],
                  where: {
                    name: trimmedSubServiceName,
                  },
                  paranoid: false,
                }),
              ]);

              if (aspMechanicExist && subServiceExist) {
                const aspMechanicSubServiceExist =
                  await AspMechanicSubService.findOne({
                    attributes: ["id"],
                    where: {
                      aspMechanicId: aspMechanicExist.dataValues.id,
                      subServiceId: subServiceExist.dataValues.id,
                    },
                    paranoid: false,
                  });
                if (!aspMechanicSubServiceExist) {
                  await AspMechanicSubService.create({
                    aspMechanicId: aspMechanicExist.dataValues.id,
                    subServiceId: subServiceExist.dataValues.id,
                  });
                }
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async escalationReasonSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./escalationReasonData.xlsx")
      );

      const escalationReasonWorksheet: any = workbook.getWorksheet(1);
      await escalationReasonWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (id) {
              let escalationReasonData = {
                id: id,
                name: name,
              };
              const escalationReasonExist = await EscalationReason.findOne({
                attributes: ["id"],
                where: { id: id },
                paranoid: false,
              });
              if (!escalationReasonExist) {
                await EscalationReason.create(escalationReasonData);
              } else {
                await EscalationReason.update(escalationReasonData, {
                  where: { id: id },
                });
              }
            }
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async systemIssueReasonSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./systemIssueReasonData.xlsx")
      );

      const systemIssueReasonWorksheet: any = workbook.getWorksheet(1);
      await systemIssueReasonWorksheet.eachRow(
        async (row: any, rowNumber: number) => {
          if (rowNumber !== 1) {
            const [, id, name] = row.values;
            if (id) {
              let systemIssueReasonData = {
                id: id,
                name: name,
              };
              const systemIssueReasonExist = await SystemIssueReason.findOne({
                attributes: ["id"],
                where: { id: id },
                paranoid: false,
              });
              if (!systemIssueReasonExist) {
                await SystemIssueReason.create(systemIssueReasonData);
              } else {
                await SystemIssueReason.update(systemIssueReasonData, {
                  where: { id: id },
                });
              }
            }
          }
        }
      );
      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async fuelTypeSeeder(req: any, res: any) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./fuelTypeUpdationData.xlsx")
      );
      const fuelTypeWorksheet: any = workbook.getWorksheet(1);
      await fuelTypeWorksheet.eachRow(async (row: any, rowNumber: number) => {
        if (rowNumber !== 1) {
          const [, id, name, displayName] = row.values;
          if (id && name) {
            const trimedName = String(name).trim();
            const trimedDisplayName = String(displayName).trim();
            let fuelTypeData = {
              id: id,
              name: trimedName,
              displayName: trimedDisplayName,
            };
            const fuelTypeExist = await FuelType.findOne({
              where: { id: id },
            });
            if (!fuelTypeExist) {
              await FuelType.create(fuelTypeData);
            } else {
              await FuelType.update(fuelTypeData, { where: { id: id } });
            }
          }
        }
      });

      return res.status(200).json({
        success: true,
        message: "Seeder Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async importConfigurationSeeder(req: any, res: any) {
    try {
      const importConfigurations = [
        //CLIENT
        {
          importTypeId: 1091,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Invoice Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Business Category",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Invoice Code",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Legal Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Trade Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Axapta Code",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Financial Dimension",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Gstin",
          isRequired: 1,
        },
        // {
        //   importTypeId: 1091,
        //   excelColumnName: "Toll Free Number",
        //   isRequired: 1,
        // },
        {
          importTypeId: 1091,
          excelColumnName: "Call Center Names",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Email",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Contact Number",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Customer Toll Free Number",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "ASM Toll Free Number",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "NM Toll Free Number",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "FH Toll Free Number",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "ASP Toll Free Number",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "RM Toll Free Number",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "DID Number",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Billing Address",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Billing Country Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Billing State Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Billing City Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Billing Address Pincode",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Shipping Address",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Shipping Country Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Shipping State Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Shipping City Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Shipping Address Pincode",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "SPOC User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Vehicle Type Names",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Vehicle Make Names",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Dialer Campaign Name",
          isRequired: 1,
        },
        {
          importTypeId: 1091,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //CLIENT SERVICE ENTITLEMENT
        {
          importTypeId: 1092,
          excelColumnName: "Client Name",
          isRequired: 1,
        },
        {
          importTypeId: 1092,
          excelColumnName: "Service Name",
          isRequired: 1,
        },
        {
          importTypeId: 1092,
          excelColumnName: "Policy Type Name",
          isRequired: 1,
        },
        {
          importTypeId: 1092,
          excelColumnName: "Membership Type Name",
          isRequired: 1,
        },
        {
          importTypeId: 1092,
          excelColumnName: "Total Service",
          isRequired: 1,
        },
        {
          importTypeId: 1092,
          excelColumnName: "Sub Service Name",
          isRequired: 1,
        },
        {
          importTypeId: 1092,
          excelColumnName: "Limit",
          isRequired: 1,
        },
        {
          importTypeId: 1092,
          excelColumnName: "Entitlement Name",
          isRequired: 1,
        },

        //USERS
        {
          importTypeId: 1093,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Code",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Role Name",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Email",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Mobile Number",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Password",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Change Password",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Call Center Name",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Client Names",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Address",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "RM User Names",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "ZM User Names",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Replacement User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Level Name",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Team Leader User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "SME User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1093,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //ASP
        {
          importTypeId: 1094,
          excelColumnName: "Tier",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Axapta Code",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Salutation",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "ASP Code",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Workshop Name",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Email",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "WhatsApp Number",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Contact Number",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Working Hours",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Performance",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Priority",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Regional Manager User Name",
          isRequired: 1,
        },

        {
          importTypeId: 1094,
          excelColumnName: "Own Patrol",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Has Mechanic",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Username",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Password",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Change Password",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Status",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Address Line One",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Address Line Two",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "State",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "City",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Pincode",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Location",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Latitude",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Longitude",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Is Finance Admin",
          isRequired: 1,
        },
        {
          importTypeId: 1094,
          excelColumnName: "Finance Admin Code",
          isRequired: 1,
        },

        //ASP MECHANICS
        {
          importTypeId: 1095,
          excelColumnName: "ASP Type",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "ASP Code",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Code",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Email",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Contact Number",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Alternate Contact Number",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Latitude",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Longitude",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Performance",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Priority",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Address",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "State",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "City",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Location Capture Via",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Dynamic Type",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "COCO Vehicle",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Sub Services",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Username",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Password",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Change Password",
          isRequired: 1,
        },
        {
          importTypeId: 1095,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //COCO VEHICLE MASTER
        {
          importTypeId: 1096,
          excelColumnName: "Vehicle Registration Number",
          isRequired: 1,
        },
        {
          importTypeId: 1096,
          excelColumnName: "Vehicle Type Name",
          isRequired: 1,
        },
        {
          importTypeId: 1096,
          excelColumnName: "Vehicle Make Name",
          isRequired: 1,
        },
        {
          importTypeId: 1096,
          excelColumnName: "Vehicle Model Name",
          isRequired: 1,
        },
        {
          importTypeId: 1096,
          excelColumnName: "ASP Code",
          isRequired: 1,
        },
        {
          importTypeId: 1096,
          excelColumnName: "GPS Device Id",
          isRequired: 1,
        },
        {
          importTypeId: 1096,
          excelColumnName: "Service Organisation Name",
          isRequired: 1,
        },
        {
          importTypeId: 1096,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //COCO VEHICLE HELPER
        {
          importTypeId: 1097,
          excelColumnName: "Code",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "Email",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "Mobile Number",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "Address",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "State Name",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "City Name",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "Username",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "Password",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "Change Password",
          isRequired: 1,
        },
        {
          importTypeId: 1097,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //SERVICE ORGANIZATION
        {
          importTypeId: 1098,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1098,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //CALL CENTER
        {
          importTypeId: 1099,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Address",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Call Centre Head User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Call Centre Manager User Names",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Is Command Center",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Email",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Phone Number",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Toll Free Number",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Whatsapp Number",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Spoc Email Ids",
          isRequired: 1,
        },
        {
          importTypeId: 1099,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //DEALERS
        {
          importTypeId: 1100,
          excelColumnName: "Group Code",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Code",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Type",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Legal Name",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Trade Name",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Mobile Number",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Email",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "GSTIN",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "PAN",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "CIN",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Mechanical Type",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Is Exclusive",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Body Part Type",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Client",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "RSA Person Name",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "RSA Person Number",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "RSA Person Alternate Number",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "SM Name",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "SM Number",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "SM Number",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "SM Alternate Number",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "OEM ASM Name",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "OEM ASM Number",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "OEM ASM Alternate Number",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Auto Cancel For Delivery",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "UserName",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Password",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Change Password",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Address Line One",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Address Line Two",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Correspondence Address",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "State",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "City",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Area",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Pin Code",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Latitude",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Longitude",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Zone",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Drop Dealer Codes",
          isRequired: 1,
        },
        {
          importTypeId: 1100,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //POLICY PREMIUMS
        {
          importTypeId: 1121,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1121,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //VEHICLE MAKE
        {
          importTypeId: 1101,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1101,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //VEHICLE TYPE
        {
          importTypeId: 1102,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1102,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //VEHICLE MODEL
        {
          importTypeId: 1103,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1103,
          excelColumnName: "Vehicle Make",
          isRequired: 1,
        },
        {
          importTypeId: 1103,
          excelColumnName: "Vehicle Type",
          isRequired: 1,
        },
        {
          importTypeId: 1103,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //ASP REJECT REASON
        {
          importTypeId: 1104,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1104,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //CASE SUBJECT
        {
          importTypeId: 1105,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1105,
          excelColumnName: "Client Name",
          isRequired: 1,
        },
        {
          importTypeId: 1105,
          excelColumnName: "Case Type",
          isRequired: 1,
        },
        {
          importTypeId: 1105,
          excelColumnName: "Services",
          isRequired: 1,
        },
        {
          importTypeId: 1105,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //SUB SERVICE
        {
          importTypeId: 1106,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1106,
          excelColumnName: "Service Name",
          isRequired: 1,
        },
        {
          importTypeId: 1106,
          excelColumnName: "Has Asp Assignment",
          isRequired: 1,
        },
        {
          importTypeId: 1106,
          excelColumnName: "Has Limit",
          isRequired: 1,
        },
        {
          importTypeId: 1106,
          excelColumnName: "Has Entitlement",
          isRequired: 1,
        },
        {
          importTypeId: 1106,
          excelColumnName: "Entitlement Names",
          isRequired: 1,
        },
        {
          importTypeId: 1106,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //SLA REASON
        {
          importTypeId: 1107,
          excelColumnName: "Role Names",
          isRequired: 1,
        },
        {
          importTypeId: 1107,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1107,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //Escalation Reason
        {
          importTypeId: 1108,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1108,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //SYSTEM ISSUE REASON
        {
          importTypeId: 1109,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1109,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //LANGUAGE
        {
          importTypeId: 1110,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1110,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //ASP REJECTED CC DETAIL REASON
        {
          importTypeId: 1117,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1117,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //CONDITION OF VEHICLE
        {
          importTypeId: 1118,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1118,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //MANUAL LOCATION REASON
        {
          importTypeId: 1119,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1119,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //CASE CANCEL REASON
        {
          importTypeId: 1120,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1120,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //DISPOSITION
        {
          importTypeId: 1122,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1122,
          excelColumnName: "Type Name",
          isRequired: 1,
        },
        {
          importTypeId: 1122,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //ASP ACTIVITY CANCEL REASON
        {
          importTypeId: 1123,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1123,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //CITY
        {
          importTypeId: 1111,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Taluk Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "District Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Pin Code",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Latitude",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Longitude",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Location Type Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Municipal Limit Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Nearest City Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Location Category Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "RM User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Network Head User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Customer Experience Head User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Command Centre Head User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Service Head User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "BO Head User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Country",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "State",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Service Organisation Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Region Name",
          isRequired: 1,
        },
        {
          importTypeId: 1111,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //REGION
        {
          importTypeId: 1112,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1112,
          excelColumnName: "Code",
          isRequired: 1,
        },
        {
          importTypeId: 1112,
          excelColumnName: "Country",
          isRequired: 1,
        },
        {
          importTypeId: 1112,
          excelColumnName: "State",
          isRequired: 1,
        },
        {
          importTypeId: 1112,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //STATE
        {
          importTypeId: 1113,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1113,
          excelColumnName: "Code",
          isRequired: 1,
        },
        {
          importTypeId: 1113,
          excelColumnName: "Country",
          isRequired: 1,
        },
        {
          importTypeId: 1113,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //TALUK
        {
          importTypeId: 1114,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1114,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //DISTRICT
        {
          importTypeId: 1115,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1115,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //NEAREST CITY
        {
          importTypeId: 1116,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1116,
          excelColumnName: "Location Category",
          isRequired: 1,
        },
        {
          importTypeId: 1116,
          excelColumnName: "State",
          isRequired: 1,
        },
        {
          importTypeId: 1116,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //USER SKILL
        {
          importTypeId: 1124,
          excelColumnName: "User Name",
          isRequired: 1,
        },
        {
          importTypeId: 1124,
          excelColumnName: "Language Name",
          isRequired: 1,
        },
        {
          importTypeId: 1124,
          excelColumnName: "Rating",
          isRequired: 1,
        },
        {
          importTypeId: 1124,
          excelColumnName: "Is Primary Language",
          isRequired: 1,
        },

        //CLIENT ENTITLEMENT
        {
          importTypeId: 1125,
          excelColumnName: "Client Name",
          isRequired: 1,
        },
        {
          importTypeId: 1125,
          excelColumnName: "Entitlement Name",
          isRequired: 1,
        },
        {
          importTypeId: 1125,
          excelColumnName: "Limit",
          isRequired: 1,
        },

        //CASE SUBJECT QUESTIONNAIRE
        {
          importTypeId: 1126,
          excelColumnName: "Case Subject Name",
          isRequired: 1,
        },
        {
          importTypeId: 1126,
          excelColumnName: "Client Name",
          isRequired: 1,
        },
        {
          importTypeId: 1126,
          excelColumnName: "Question",
          isRequired: 1,
        },
        {
          importTypeId: 1126,
          excelColumnName: "Answer Type Name",
          isRequired: 1,
        },
        {
          importTypeId: 1126,
          excelColumnName: "Sequence",
          isRequired: 0,
        },

        //Proposed Delay Reason
        {
          importTypeId: 1127,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1127,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //ROS Failure Reason
        {
          importTypeId: 1128,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1128,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //ROS Success Reason
        {
          importTypeId: 1129,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1129,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //Tow Success Reason
        {
          importTypeId: 1400,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1400,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //Tow Failure Reason
        {
          importTypeId: 1401,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1401,
          excelColumnName: "Status",
          isRequired: 1,
        },

        //Service Description
        {
          importTypeId: 1402,
          excelColumnName: "Name",
          isRequired: 1,
        },
        {
          importTypeId: 1402,
          excelColumnName: "Status",
          isRequired: 1,
        },
      ];

      for (const importConfiguration of importConfigurations) {
        const importConfigurationExists: any =
          await ImportConfiguration.findOne({
            attributes: ["id"],
            where: {
              importTypeId: importConfiguration.importTypeId,
              excelColumnName: importConfiguration.excelColumnName,
            },
            paranoid: false,
          });
        //CREATE
        if (!importConfigurationExists) {
          await ImportConfiguration.create(importConfiguration);
        } else {
          //UPDATE
          await ImportConfiguration.update(importConfiguration, {
            where: {
              id: importConfigurationExists.id,
            },
            paranoid: false,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Seeders Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async uatAspSeeder(req: any, res: any) {
    try {
      console.log("----------------Start-----------------");

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./uatAspData.xlsx")
      );

      const response: any = {};
      const isFinanceAdminSheet: any = workbook.getWorksheet(1);
      const isFinanceAdminSheetResponse: any = await uatAspSeeder(
        isFinanceAdminSheet
      );
      response.isFinanceAdminSheetResponse = isFinanceAdminSheetResponse;
      if (isFinanceAdminSheetResponse?.success) {
        const notFinanceAdminSheet: any = workbook.getWorksheet(2);
        const notFinanceAdminSheetResponse = await uatAspSeeder(
          notFinanceAdminSheet
        );
        response.notFinanceAdminSheetResponse = notFinanceAdminSheetResponse;
      }

      console.log("---------------End---------------");
      return res.status(200).json(response);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async uatDealerSeeder(req: any, res: any) {
    try {
      console.log("----------------Start-----------------");

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(
        path.resolve("seeder-files", "./uatDealerData.xlsx")
      );
      const sheet: any = workbook.getWorksheet(1);
      const response = await uatDealerSeeder(sheet);

      console.log("---------------End---------------");
      return res.status(200).json(response);
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async companySeeder(req: any, res: any) {
    try {
      const companies = [
        {
          id: 1,
          name: "TVS Automobile Solutions Private Limited",
          shortName: null,
          legalName: "TVS Automobile Solutions Private Limited",
          tradeName: "TVS Automobile Solutions Private Limited",
          gstin: "33AAGCM0329K1ZM",
          phoneNumber: "9840516229",
          email: "HYDER.ABBAS@TVS.IN",
          address: "10, JAWAHAR ROAD, CHOKKIKULAM, MADURAI – 625002.",
        },
      ];

      for (const company of companies) {
        const companyExists: any = await Company.findOne({
          where: { id: company.id },
          attributes: ["id"],
          paranoid: false,
        });

        const companyData = {
          id: company.id,
          name: company.name,
          shortName: company.shortName,
          legalName: company.legalName,
          tradeName: company.tradeName,
          gstin: company.gstin,
          phoneNumber: company.phoneNumber,
          email: company.email,
          address: company.address,
        };

        if (!companyExists) {
          await Company.create(companyData);
        } else {
          await Company.update(companyData, {
            where: { id: companyExists.id },
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Seeders Run Successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  public async customerFeedbackSeeder(req: any, res: any) {
    try {
      // Get all clients from client master
      const allClients: any = await Client.findAll({
        attributes: ["id", "name"],
        where: {
          deletedAt: null,
        },
        order: [["id", "ASC"]],
      });

      if (!allClients || allClients.length === 0) {
        return res.status(200).json({
          success: false,
          error: "Client not found",
        });
      }

      // Process each client
      for (const client of allClients) {
        try {
          const clientId = client.id;
          const isTataClient = clientId === parseInt(process.env.TATA_CLIENT_ID || "0");

          // TATA CLIENT - Special Questions
          if (isTataClient) {
            // Parent question: Customer Feedback (for Connected/Answered)
            const customerFeedbackQuestion = {
              callStatusId: 1180,
              question: "Customer Feedback",
              questionType: "customer_feedback",
              parentQuestionId: null,
              sequence: 1,
              answerTypeId: 21,
              isActive: true,
              clientId: clientId,
            };

            // Find or create parent question
            const [parentQuestion, parentCreated] = await FeedbackQuestion.findOrCreate({
              where: {
                callStatusId: customerFeedbackQuestion.callStatusId,
                question: customerFeedbackQuestion.question,
                questionType: customerFeedbackQuestion.questionType,
                parentQuestionId: customerFeedbackQuestion.parentQuestionId,
                sequence: customerFeedbackQuestion.sequence,
                answerTypeId: customerFeedbackQuestion.answerTypeId,
                isActive: customerFeedbackQuestion.isActive,
                clientId: customerFeedbackQuestion.clientId,
              },
              defaults: customerFeedbackQuestion,
            });

            if (!parentCreated) {
              await FeedbackQuestion.update(customerFeedbackQuestion, {
                where: { id: (parentQuestion as any).id },
              });
            }
            const parentQuestionId = (parentQuestion as any).id;

            // Create TATA-specific satisfied questions (only 2 questions) - bulk upsert
            const tataSatisfiedQuestions = [
              {
                callStatusId: 1180,
                question: "Are you satisfied with the RSA service?",
                questionType: "satisfied_question",
                parentQuestionId: parentQuestionId,
                sequence: 1,
                answerTypeId: 20,
                isActive: true,
                clientId: clientId,
                reportColumn: "areYouSatisfiedWithTheRsaService",
              },
              {
                callStatusId: 1180,
                question: "Would you recommend our RSA service to your friends and family?",
                questionType: "satisfied_question",
                parentQuestionId: parentQuestionId,
                sequence: 2,
                answerTypeId: 20,
                isActive: true,
                clientId: clientId,
                reportColumn: "wouldYouRecommendOurRsaServiceToYourFriendsAndFamily",
              },
            ];

            // Find or create satisfied questions
            for (const questionData of tataSatisfiedQuestions) {
              const [questionRecord, created] = await FeedbackQuestion.findOrCreate({
                where: {
                  callStatusId: questionData.callStatusId,
                  question: questionData.question,
                  questionType: questionData.questionType,
                  parentQuestionId: questionData.parentQuestionId,
                  sequence: questionData.sequence,
                  answerTypeId: questionData.answerTypeId,
                  isActive: questionData.isActive,
                  clientId: questionData.clientId,
                },
                defaults: questionData,
              });

              if (!created) {
                await FeedbackQuestion.update(questionData, {
                  where: { id: (questionRecord as any).id },
                });
              }
            }

            // Not Connected question - find or create
            const notConnectedQuestionData = {
              callStatusId: 1185,
              question: "Reasons for not connecting",
              questionType: "not_connected_reason",
              parentQuestionId: null,
              sequence: 1,
              answerTypeId: 25,
              isActive: true,
              clientId: clientId,
              reportColumn: "reasonsForNotConnecting",
            };

            const [notConnectedQuestion, notConnectedCreated] = await FeedbackQuestion.findOrCreate({
              where: {
                callStatusId: notConnectedQuestionData.callStatusId,
                question: notConnectedQuestionData.question,
                questionType: notConnectedQuestionData.questionType,
                parentQuestionId: notConnectedQuestionData.parentQuestionId,
                sequence: notConnectedQuestionData.sequence,
                answerTypeId: notConnectedQuestionData.answerTypeId,
                isActive: notConnectedQuestionData.isActive,
                clientId: notConnectedQuestionData.clientId,
              },
              defaults: notConnectedQuestionData,
            });

            if (!notConnectedCreated) {
              await FeedbackQuestion.update(notConnectedQuestionData, {
                where: { id: (notConnectedQuestion as any).id },
              });
            }
          } else {
            // OTHER CLIENTS - Standard Questions
            const parentQuestionData = {
              callStatusId: 1180,
              question: "Customer Feedback",
              questionType: "customer_feedback",
              parentQuestionId: null,
              sequence: 1,
              answerTypeId: 21,
              isActive: true,
              clientId: clientId,
            };

            const satisfiedQuestions = [
              {
                callStatusId: 1180,
                question: "How would you rate the overall service provided to you?",
                questionType: "satisfied_question",
                sequence: 1,
                answerTypeId: 19,
                isActive: true,
                clientId: clientId,
                reportColumn: "howWouldYouRateTheOverallServiceProvidedToYou",
              },
              {
                callStatusId: 1180,
                question: "Was the call center agent helpful in coordinating the service?",
                questionType: "satisfied_question",
                sequence: 2,
                answerTypeId: 19,
                isActive: true,
                clientId: clientId,
                reportColumn: "wasTheCallCenterAgentHelpfulInCoordinatingTheService",
              },
              {
                callStatusId: 1180,
                question: "Did the technician or towing driver arrive on time at your breakdown location?",
                questionType: "satisfied_question",
                sequence: 3,
                answerTypeId: 20,
                isActive: true,
                clientId: clientId,
                reportColumn: "didTheTechnicianOrTowingDriverArriveOnTimeAtYourBdLocation",
              },
              {
                callStatusId: 1180,
                question: "How was the behavior of the technician or towing driver towards you?",
                questionType: "satisfied_question",
                sequence: 4,
                answerTypeId: 19,
                isActive: true,
                clientId: clientId,
                reportColumn: "howWasTheBehaviorOfTheTechnicianOrTowingDriverTowardsYou",
              },
              {
                callStatusId: 1180,
                question: "Would you recommend our RSA service to your friends or relatives?",
                questionType: "satisfied_question",
                sequence: 5,
                answerTypeId: 20,
                isActive: true,
                clientId: clientId,
                reportColumn: "wouldYouRecommendOurRsaServiceToYourFriendsOrRelatives",
              },
            ];

            const notSatisfiedQuestions = [
              {
                callStatusId: 1180,
                question: "Issues With",
                questionType: "not_satisfied_question",
                sequence: 1,
                answerTypeId: 22,
                isActive: true,
                clientId: clientId,
                reportColumn: "issuesWith",
              },
              {
                callStatusId: 1180,
                question: "Bifurcation of Issue Severity:",
                questionType: "not_satisfied_question",
                sequence: 2,
                answerTypeId: 23,
                isActive: true,
                clientId: clientId,
                reportColumn: "bifurcationOfIssueSeverity",
              },
              {
                callStatusId: 1180,
                question: "Reason for Not Satisfied:",
                questionType: "not_satisfied_question",
                sequence: 3,
                answerTypeId: 24,
                isActive: true,
                clientId: clientId,
                reportColumn: "reasonForNotSatisfied",
              },
            ];

            const notConnectedQuestion = {
              callStatusId: 1185,
              question: "Reasons for not connecting",
              questionType: "not_connected_reason",
              parentQuestionId: null,
              sequence: 1,
              answerTypeId: 25,
              isActive: true,
              clientId: clientId,
              reportColumn: "reasonsForNotConnecting",
            };

            // Find or create parent question
            const [parentQuestion, parentCreated] = await FeedbackQuestion.findOrCreate({
              where: {
                callStatusId: parentQuestionData.callStatusId,
                question: parentQuestionData.question,
                questionType: parentQuestionData.questionType,
                parentQuestionId: parentQuestionData.parentQuestionId,
                sequence: parentQuestionData.sequence,
                answerTypeId: parentQuestionData.answerTypeId,
                isActive: parentQuestionData.isActive,
                clientId: parentQuestionData.clientId,
              },
              defaults: parentQuestionData,
            });

            if (!parentCreated) {
              await FeedbackQuestion.update(parentQuestionData, {
                where: { id: (parentQuestion as any).id },
              });
            }
            const parentQuestionId = (parentQuestion as any).id;

            for (const questionData of satisfiedQuestions) {
              const questionWithParent = { ...questionData, parentQuestionId };
              const [questionRecord, created] = await FeedbackQuestion.findOrCreate({
                where: {
                  callStatusId: questionWithParent.callStatusId,
                  question: questionWithParent.question,
                  questionType: questionWithParent.questionType,
                  parentQuestionId: questionWithParent.parentQuestionId,
                  sequence: questionWithParent.sequence,
                  answerTypeId: questionWithParent.answerTypeId,
                  isActive: questionWithParent.isActive,
                  clientId: questionWithParent.clientId,
                },
                defaults: questionWithParent,
              });

              if (!created) {
                await FeedbackQuestion.update(questionWithParent, {
                  where: { id: (questionRecord as any).id },
                });
              }
            }

            // Find or create not satisfied questions
            for (const questionData of notSatisfiedQuestions) {
              const questionWithParent = { ...questionData, parentQuestionId };
              const [questionRecord, created] = await FeedbackQuestion.findOrCreate({
                where: {
                  callStatusId: questionWithParent.callStatusId,
                  question: questionWithParent.question,
                  questionType: questionWithParent.questionType,
                  parentQuestionId: questionWithParent.parentQuestionId,
                  sequence: questionWithParent.sequence,
                  answerTypeId: questionWithParent.answerTypeId,
                  isActive: questionWithParent.isActive,
                  clientId: questionWithParent.clientId,
                },
                defaults: questionWithParent,
              });

              if (!created) {
                await FeedbackQuestion.update(questionWithParent, {
                  where: { id: (questionRecord as any).id },
                });
              }
            }

            // Find or create not connected question
            const [notConnectedRecord, notConnectedCreated] = await FeedbackQuestion.findOrCreate({
              where: {
                callStatusId: notConnectedQuestion.callStatusId,
                question: notConnectedQuestion.question,
                questionType: notConnectedQuestion.questionType,
                parentQuestionId: notConnectedQuestion.parentQuestionId,
                sequence: notConnectedQuestion.sequence,
                answerTypeId: notConnectedQuestion.answerTypeId,
                isActive: notConnectedQuestion.isActive,
                clientId: notConnectedQuestion.clientId,
              },
              defaults: notConnectedQuestion,
            });

            if (!notConnectedCreated) {
              await FeedbackQuestion.update(notConnectedQuestion, {
                where: { id: (notConnectedRecord as any).id },
              });
            }
          }
        } catch (clientError: any) {
          console.error(`Error processing client ${client.name}:`, clientError);
        }
      }

      return res.status(200).json({
        success: true,
        message: `Customer feedback seeder successfully completed`,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export default new SeederController();
