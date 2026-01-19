import { Op, Sequelize } from "sequelize";
import {
  City,
  Config,
  Country,
  District,
  NearestCity,
  Region,
  ServiceOrganisation,
  State,
  Taluk,
} from "../database/models/index";
import { Request, Response } from "express";
import { Validator } from "node-input-validator";
import sequelize from "../database/connection";
import moment, { MomentInput } from "moment-timezone";
import axios from "axios";
import config from "../config/config.json";
import Utils from "../lib/utils";

import {
  createDataAsUser,
  generateXLSXAndXLSExport,
  generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class CityController {
  private static defaultLimit: number = 50;
  private static defaultOffset: number = 0;
  constructor() {}

  getList = async (req: any, res: any) => {
    try {
      const { limit, offset, stateId, search, status, apiType } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      if (stateId) {
        where.stateId = stateId;
      }

      let cities = null;
      if (apiType == "dropdown") {
        if (search) {
          where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
        }

        cities = await City.findAll({
          where,
          attributes: ["id", "name", "pincode"],
          order: [["id", "asc"]],
        });

        if (cities.length === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      } else {
        if (search) {
          where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            Sequelize.literal(`taluk.name LIKE "%${search}%"`),
            Sequelize.literal(`district.name LIKE "%${search}%"`),
            Sequelize.literal(`nearestCity.name LIKE "%${search}%"`),
            Sequelize.literal(`serviceOrganisation.name LIKE "%${search}%"`),
            Sequelize.literal(`region.name LIKE "%${search}%"`),
            Sequelize.literal(`locationType.name LIKE "%${search}%"`),
            Sequelize.literal(`municipalLimit.name LIKE "%${search}%"`),
            Sequelize.literal(`locationCategory.name LIKE "%${search}%"`),
            Sequelize.literal(`state.name LIKE "%${search}%"`),
            {
              "$state.country.name$": { [Op.like]: `%${search}%` },
            },
            Sequelize.literal(`taluk.name LIKE "%${search}%"`),
            Sequelize.literal(`district.name LIKE "%${search}%"`),
            Sequelize.literal(`locationType.name LIKE "%${search}%"`),
            Sequelize.literal(`municipalLimit.name LIKE "%${search}%"`),
            Sequelize.literal(`nearestCity.name LIKE "%${search}%"`),
            Sequelize.literal(`locationCategory.name LIKE "%${search}%"`),
            Sequelize.literal(
              `( IF (city.deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
            ),
          ];
        }

        if (status) {
          //ACTIVE
          if (status.toLowerCase() == "active") {
            where.deletedAt = {
              [Op.is]: null,
            };
          } else if (status.toLowerCase() == "inactive") {
            //INACTIVE
            where.deletedAt = {
              [Op.not]: null,
            };
          }
        }

        // Limitation value setup
        let limitValue: number = CityController.defaultLimit;

        if (limit !== undefined) {
          const parsedLimit = parseInt(limit);
          if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
            limitValue = parsedLimit;
          }
        }

        // Offset value config
        let offsetValue: number = CityController.defaultOffset;

        if (offset !== undefined) {
          const parsedOffset = parseInt(offset);
          if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
            offsetValue = parsedOffset;
          }
        }

        cities = await City.findAndCountAll({
          where,
          attributes: [
            "id",
            "name",
            [Sequelize.col("taluk.name"), "talukName"],
            [Sequelize.col("district.name"), "districtName"],
            [Sequelize.col("nearestCity.name"), "nearestCityName"],
            [
              Sequelize.col("serviceOrganisation.name"),
              "serviceOrganisationName",
            ],
            [Sequelize.col("region.name"), "regionName"],
            [Sequelize.col("locationType.name"), "locationTypeName"],
            [Sequelize.col("municipalLimit.name"), "municipalLimitName"],
            [Sequelize.col("locationCategory.name"), "locationCategoryName"],
            [Sequelize.col("state.name"), "stateName"],
            [Sequelize.col("state.country.name"), "countryName"],
            [Sequelize.col("taluk.name"), "talukName"],
            [Sequelize.col("district.name"), "districtName"],
            "pincode",
            "latitude",
            "longitude",
            [Sequelize.col("locationType.name"), "locationTypeName"],
            [Sequelize.col("municipalLimit.name"), "municipalLimitName"],
            [Sequelize.col("nearestCity.name"), "nearestCityName"],
            [Sequelize.col("locationCategory.name"), "locationCategoryName"],
            [
              Sequelize.literal(
                "( SELECT DATE_FORMAT(city.createdAt,'%d/%m/%Y %h:%i %p') )"
              ),
              "createdAt",
            ],
            [
              Sequelize.literal(
                "( SELECT IF (city.deletedAt IS NULL, 'Active', 'Inactive') )"
              ),
              "status",
            ],
          ],
          include: [
            {
              model: State,
              as: "state",
              attributes: [],
              required: false,
              paranoid: false,
              include: [
                {
                  model: Country,
                  as: "country",
                  attributes: [],
                  required: false,
                  paranoid: false,
                },
              ],
            },

            {
              model: Taluk,
              as: "taluk",
              attributes: [],
              required: false,
              paranoid: false,
            },
            {
              model: District,
              as: "district",
              attributes: [],
              required: false,
              paranoid: false,
            },
            {
              model: Config,
              as: "locationType",
              attributes: [],
              required: false,
            },
            {
              model: Config,
              as: "municipalLimit",
              attributes: [],
              required: false,
            },
            {
              model: NearestCity,
              as: "nearestCity",
              attributes: [],
              required: false,
              paranoid: false,
            },
            {
              model: Config,
              as: "locationCategory",
              attributes: [],
              required: false,
            },
            {
              model: ServiceOrganisation,
              as: "serviceOrganisation",
              attributes: [],
              required: false,
              paranoid: false,
            },
            {
              model: Region,
              as: "region",
              attributes: [],
              required: false,
              paranoid: false,
            },
          ],
          order: [["id", "desc"]],
          limit: limitValue,
          offset: offsetValue,
          paranoid: false,
        });

        if (cities.count === 0) {
          return res.status(200).json({
            success: false,
            error: "No data found",
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: cities,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getFormData = async (req: Request, res: Response) => {
    try {
      const { cityId } = req.query;
      let cityData = null;
      if (cityId) {
        const cityExists: any = await City.findOne({
          where: {
            id: cityId,
          },
          include: [
            {
              model: State,
              as: "state",
              attributes: ["countryId"],
              required: false,
              paranoid: false,
            },
            {
              model: Taluk,
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
            {
              model: District,
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
            {
              model: NearestCity,
              attributes: ["id", "name"],
              required: false,
              paranoid: false,
            },
          ],
          paranoid: false,
        });

        if (!cityExists) {
          return res.status(200).json({
            success: false,
            error: "City not found",
          });
        }

        let rmDetails = null;
        if (cityExists.dataValues.rmId) {
          const getRmDetail = await axios.post(
            `${userServiceUrl}/user/${userServiceEndpoint.getUser}`,
            {
              id: cityExists.dataValues.rmId,
            }
          );
          if (getRmDetail.data.success) {
            rmDetails = {
              id: cityExists.dataValues.rmId,
              code: getRmDetail.data.user.code,
              name: getRmDetail.data.user.name,
            };
          }
        }

        cityData = {
          id: cityExists.dataValues.id,
          name: cityExists.dataValues.name,
          talukId: cityExists.dataValues.talukId,
          taluk: cityExists.dataValues.taluk
            ? cityExists.dataValues.taluk
            : null,
          districtId: cityExists.dataValues.districtId,
          district: cityExists.dataValues.district
            ? cityExists.dataValues.district
            : null,
          stateId: cityExists.dataValues.stateId,
          countryId: cityExists.dataValues.state
            ? cityExists.dataValues.state.countryId
            : null,
          pincode: cityExists.dataValues.pincode,
          latitude: cityExists.dataValues.latitude,
          longitude: cityExists.dataValues.longitude,
          locationTypeId: cityExists.dataValues.locationTypeId,
          municipalLimitId: cityExists.dataValues.municipalLimitId,
          nearestCityId: cityExists.dataValues.nearestCityId,
          nearestCity: cityExists.dataValues.nearestCity
            ? cityExists.dataValues.nearestCity
            : null,
          locationCategoryId: cityExists.dataValues.locationCategoryId,
          rmId: cityExists.dataValues.rmId,
          rmDetails: rmDetails,
          networkHeadId: cityExists.dataValues.networkHeadId,
          customerExperienceHeadId:
            cityExists.dataValues.customerExperienceHeadId,
          commandCentreHeadId: cityExists.dataValues.commandCentreHeadId,
          serviceHeadId: cityExists.dataValues.serviceHeadId,
          boHeadId: cityExists.dataValues.boHeadId,
          serviceOrganisationId: cityExists.dataValues.serviceOrganisationId,
          regionId: cityExists.dataValues.regionId,
          status: cityExists.dataValues.deletedAt ? 0 : 1,
        };
      }

      const [countries, getUsersResponse, configs, serviceOrganisations] =
        await Promise.all([
          Country.findAll({
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          }),
          //GET SERVICE REGIOANAL MANAGER, NETWORK HEAD, CUSTOMER EXPERIENCE HEAD, COMMAND CENTRE HEAD, SERVICE HEAD, BO HEAD LIST
          axios.post(
            `${userServiceUrl}/userMaster/${userServiceEndpoint.userMaster.getUsersByRoles}`,
            {
              roleIds: [6, 22, 23, 24, 26, 27],
            }
          ),
          Config.findAll({
            where: {
              typeId: { [Op.in]: [53, 54, 55] },
            },
            attributes: ["id", "typeId", "name"],
            order: [["id", "asc"]],
          }),
          ServiceOrganisation.findAll({
            attributes: ["id", "name"],
            order: [["id", "asc"]],
          }),
        ]);

      let networkHeads = [];
      let serviceRegionalManagers = [];
      let customerExperienceHeads = [];
      let commandCentreHeads = [];
      let serviceHeads = [];
      let boHeads = [];
      if (getUsersResponse.data.success) {
        serviceRegionalManagers = getUsersResponse.data.data
          .filter((user: any) => user.roleId === 6)
          .map((roleUser: any) => ({ id: roleUser.id, name: roleUser.name }));

        networkHeads = getUsersResponse.data.data
          .filter((user: any) => user.roleId === 22)
          .map((roleUser: any) => ({ id: roleUser.id, name: roleUser.name }));

        customerExperienceHeads = getUsersResponse.data.data
          .filter((user: any) => user.roleId === 23)
          .map((roleUser: any) => ({ id: roleUser.id, name: roleUser.name }));

        commandCentreHeads = getUsersResponse.data.data
          .filter((user: any) => user.roleId === 24)
          .map((roleUser: any) => ({ id: roleUser.id, name: roleUser.name }));

        serviceHeads = getUsersResponse.data.data
          .filter((user: any) => user.roleId === 26)
          .map((roleUser: any) => ({ id: roleUser.id, name: roleUser.name }));

        boHeads = getUsersResponse.data.data
          .filter((user: any) => user.roleId === 27)
          .map((roleUser: any) => ({ id: roleUser.id, name: roleUser.name }));
      }

      const locationTypes = configs
        .filter((config: any) => config.typeId === 53)
        .map((typeConfig: any) => ({
          id: typeConfig.id,
          name: typeConfig.name,
        }));

      const municipleLimits = configs
        .filter((config: any) => config.typeId === 54)
        .map((typeConfig: any) => ({
          id: typeConfig.id,
          name: typeConfig.name,
        }));

      const locationCategories = configs
        .filter((config: any) => config.typeId === 55)
        .map((typeConfig: any) => ({
          id: typeConfig.id,
          name: typeConfig.name,
        }));

      const extras = {
        countries: countries,
        locationTypes: locationTypes,
        municipleLimits: municipleLimits,
        serviceOrganisations: serviceOrganisations,
        locationCategories: locationCategories,
        serviceRegionalManagers: serviceRegionalManagers,
        networkHeads: networkHeads,
        customerExperienceHeads: customerExperienceHeads,
        commandCentreHeads: commandCentreHeads,
        serviceHeads: serviceHeads,
        boHeads: boHeads,
      };
      const data = {
        city: cityData,
        extras: extras,
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

  saveAndUpdate = async (req: any, res: any) => {
    return await save(req, res);
  };

  delete = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validatorRules = {
        cityIds: "required|array",
        "cityIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { cityIds } = payload;
      if (cityIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one city",
        });
      }

      for (const cityId of cityIds) {
        const cityExists = await City.findOne({
          where: {
            id: cityId,
          },
          paranoid: false,
        });
        if (!cityExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `City (${cityId}) not found`,
          });
        }

        await City.destroy({
          where: {
            id: cityId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "City deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  updateStatus = async (req: Request, res: Response) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validatorRules = {
        status: "required|numeric",
        cityIds: "required|array",
        "cityIds.*": "required",
      };
      const errors = await Utils.validateParams(payload, validatorRules);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { cityIds, status, updatedById, deletedById } = payload;
      if (cityIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one city",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const cityId of cityIds) {
        const cityExists = await City.findOne({
          where: {
            id: cityId,
          },
          paranoid: false,
        });
        if (!cityExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `City (${cityId}) not found`,
          });
        }

        await City.update(
          {
            updatedById,
            deletedById,
            deletedAt,
          },
          {
            where: {
              id: cityId,
            },
            paranoid: false,
            transaction: transaction,
          }
        );
      }
      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "City status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  getStateBaseCountry = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const v = {
        countryId: "required|numeric",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { countryId } = payload;
      const states = await State.findAll({
        where: {
          countryId: countryId,
        },
        attributes: ["id", "name"],
        order: [["id", "asc"]],
      });

      const data = {
        states: states.length > 0 ? states : null,
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

  //City Export
  public async cityDataExport(req: Request, res: Response) {
    try {
      const { format, startDate, endDate }: any = req.query;
      if (!Utils.isValidExportFormat(format)) {
        return res.status(200).json({
          success: false,
          error: "Invalid or missing export format",
        });
      }

      const where: any = {};
      if (startDate && endDate) {
        const dateFilter = Utils.getDateFilter(startDate, endDate);
        where.createdAt = dateFilter;
      }

      const cityData = await City.findAll({
        where,
        attributes: {
          exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
        },
        paranoid: false,
      });

      if (!cityData || cityData.length === 0) {
        return res.status(200).json({
          success: false,
          error:
            startDate && endDate
              ? "No record found for the selected date range"
              : "No record found",
        });
      }

      //Get Final Data of City
      const cityFinalData: any = await getCityFinalData(cityData);

      // Column Filter
      const renamedCityColumnNames = Object.keys(cityFinalData[0]);

      let buffer;
      // Excel or CSV file Creation;
      if (Utils.isExcelFormat(format)) {
        buffer = generateXLSXAndXLSExport(
          cityFinalData,
          renamedCityColumnNames,
          format,
          "Cities"
        );
        // Excel file Header set;
        Utils.setExcelHeaders(res, format);
      } else if (format === "csv") {
        buffer = generateCSVExport(cityFinalData, renamedCityColumnNames);
      } else {
        return res.status(200).json({
          success: false,
          error: "Unsupported export format",
        });
      }
      return res.status(200).json({
        success: true,
        message: `city data export successfully`,
        data: buffer,
        format: format,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  //City Import;
  public async cityDataImport(req: Request, res: Response) {
    try {
      const inData = req.body.jsonDataArray;
      const errorData = [];
      const errorOutData = [];
      let newRecordsCreated = 0;
      let existingRecordsUpdated = 0;
      // const importColumns = [
      //   "Name",
      //   "Taluk Name",
      //   "District Name",
      //   "Pin Code",
      //   "Latitude",
      //   "Longitude",
      //   "Location Type Name",
      //   "Municipal Limit Name",
      //   "Nearest City Name",
      //   "Location Category Name",
      //   "RM User Name",
      //   "Network Head User Name",
      //   "Customer Experience Head User Name",
      //   "Command Centre Head User Name",
      //   "Service Head User Name",
      //   "BO Head User Name",
      //   "Country",
      //   "State",
      //   "Status",
      // ];

      const importColumnsResponse = await Utils.getExcelImportColumns(1111);
      if (!importColumnsResponse.success) {
        return res.status(200).json({
          success: false,
          error: importColumnsResponse.error,
        });
      }
      let importColumns: any = importColumnsResponse.data;

      const importValidationResponse = await Utils.validateExcelImport({
        sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
        importTypeId: 1111,
      });
      if (!importValidationResponse.success) {
        return res.status(200).json({
          success: false,
          error: importValidationResponse.error,
        });
      }

      //GET RM,Network Head,Customer Experience Head,Command Centre Head,Service Head,BO Head DETAILS
      const getUserDetails: any = await axios.post(
        `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
        {
          roleIds: [6, 22, 23, 24, 26, 27],
        }
      );
      let managerDetails = [];
      if (getUserDetails.data && getUserDetails.data.success) {
        managerDetails = getUserDetails.data.data.roleUserDetails;
      }

      for (const data1 of inData) {
        let data2 = data1["data"];

        for (const data3 of data2) {
          importColumns.forEach((importColumn: any) => {
            if (!data3.hasOwnProperty(importColumn)) {
              data3[importColumn] = "";
            }
          });

          let reArrangedCities: any = {
            Name: data3["Name"],
            "Taluk Name": data3["Taluk Name"]
              ? String(data3["Taluk Name"])
              : null,
            "District Name": data3["District Name"]
              ? String(data3["District Name"])
              : null,
            "Pin Code": data3["Pin Code"] ? String(data3["Pin Code"]) : null,
            Latitude: data3["Latitude"] ? String(data3["Latitude"]) : null,
            Longitude: data3["Longitude"] ? String(data3["Longitude"]) : null,
            "Location Type Name": data3["Location Type Name"]
              ? String(data3["Location Type Name"])
              : null,
            "Municipal Limit Name": data3["Municipal Limit Name"]
              ? String(data3["Municipal Limit Name"])
              : null,
            "Nearest City Name": data3["Nearest City Name"]
              ? String(data3["Nearest City Name"])
              : null,
            "Service Organisation Name": data3["Service Organisation Name"]
              ? String(data3["Service Organisation Name"])
              : null,
            "Region Name": data3["Region Name"]
              ? String(data3["Region Name"])
              : null,
            "Location Category Name": data3["Location Category Name"]
              ? String(data3["Location Category Name"])
              : null,
            "RM User Name": data3["RM User Name"]
              ? String(data3["RM User Name"])
              : null,
            "Network Head User Name": data3["Network Head User Name"]
              ? String(data3["Network Head User Name"])
              : null,
            "Customer Experience Head User Name": data3[
              "Customer Experience Head User Name"
            ]
              ? String(data3["Customer Experience Head User Name"])
              : null,
            "Command Centre Head User Name": data3[
              "Command Centre Head User Name"
            ]
              ? String(data3["Command Centre Head User Name"])
              : null,
            "Service Head User Name": data3["Service Head User Name"]
              ? String(data3["Service Head User Name"])
              : null,
            "BO Head User Name": data3["BO Head User Name"]
              ? String(data3["BO Head User Name"])
              : null,
            Country: String(data3["Country"]),
            State: String(data3["State"]),
            Status: data3["Status"] ? String(data3["Status"]) : null,
          };

          const record: any = {};
          const keyMapping: any = {
            pinCode: "pincode",
            talukName: "talukId",
            districtName: "districtId",
            locationTypeName: "locationTypeId",
            municipalLimitName: "municipalLimitId",
            nearestCityName: "nearestCityId",
            locationCategoryName: "locationCategoryId",
            rMUserName: "rmUserName",
            bOHeadUserName: "boHeadUserName",
            state: "stateId",
          };

          for (const key in reArrangedCities) {
            let transformedKey = key
              .replace(/\s+/g, "")
              .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                index === 0 ? word.toLowerCase() : word.toUpperCase()
              );

            transformedKey = keyMapping[transformedKey] || transformedKey;
            record[transformedKey] = reArrangedCities[key];
          }

          const validationErrors = [];
          if (record.pincode && !/^\d{6}$/.test(record.pincode)) {
            validationErrors.push("Invalid pincode.");
          }

          if (record.latitude && !/^-?\d+(\.\d+)?$/.test(record.latitude)) {
            validationErrors.push("Invalid latitude.");
          }

          if (record.longitude && !/^-?\d+(\.\d+)?$/.test(record.longitude)) {
            validationErrors.push("Invalid longitude.");
          }

          if (
            record.status &&
            !["Active", "Inactive"].includes(record.status)
          ) {
            validationErrors.push("Status value should be Active or Inactive.");
          }

          if (validationErrors.length > 0) {
            errorOutData.push({
              ...reArrangedCities,
              Error: validationErrors.join(","),
            });
            continue;
          }

          //TALUK
          let talukId = 0;
          if (record.talukId) {
            const trimmedTalukName = record.talukId.trim();
            const talukExists = await Taluk.findOne({
              where: {
                name: trimmedTalukName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (talukExists) {
              talukId = talukExists.dataValues.id;
            }
          }

          //DISTRICT
          let districtId = 0;
          if (record.districtId) {
            const trimmedDistrictName = record.districtId.trim();
            const districtExists = await District.findOne({
              where: {
                name: trimmedDistrictName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (districtExists) {
              districtId = districtExists.dataValues.id;
            }
          }

          //LOCATION TYPE
          let locationTypeId = 0;
          if (record.locationTypeId) {
            const trimmedLocationTypeName = record.locationTypeId.trim();
            const locationTypeExists = await Config.findOne({
              where: {
                name: trimmedLocationTypeName,
                typeId: 53, //City Location Types
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (locationTypeExists) {
              locationTypeId = locationTypeExists.dataValues.id;
            }
          }

          //MUNICIPAL LIMIT
          let municipalLimitId = 0;
          if (record.municipalLimitId) {
            const trimmedMunicipalLimitName = record.municipalLimitId.trim();
            const municipalLimitExists = await Config.findOne({
              where: {
                name: trimmedMunicipalLimitName,
                typeId: 54, //City Municipal Limits
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (municipalLimitExists) {
              municipalLimitId = municipalLimitExists.dataValues.id;
            }
          }

          //NEAREST CITY
          let nearestCityId = 0;
          if (record.nearestCityId) {
            const trimmedNearestCityName = record.nearestCityId.trim();
            const nearestCityExists = await NearestCity.findOne({
              where: {
                name: trimmedNearestCityName,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (nearestCityExists) {
              nearestCityId = nearestCityExists.dataValues.id;
            }
          }

          //LOCATION CATEGORY
          let locationCategoryId = 0;
          if (record.locationCategoryId) {
            const trimmedLocationCategoryName =
              record.locationCategoryId.trim();
            const locationCategoryExists = await Config.findOne({
              where: {
                name: trimmedLocationCategoryName,
                typeId: 55, //City Location Categories
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (locationCategoryExists) {
              locationCategoryId = locationCategoryExists.dataValues.id;
            }
          }

          //RM
          let rmId = 0;
          if (record.rmUserName) {
            const trimmedRmUserName = record.rmUserName.trim();
            const rmDetail = managerDetails.find(
              (managerDetail: any) =>
                managerDetail.userName == trimmedRmUserName &&
                managerDetail.roleId == 6
            );
            if (rmDetail) {
              rmId = rmDetail.id;
            }
          }

          //NETWORK HEAD
          let networkHeadId = null;
          if (record.networkHeadUserName) {
            const trimmedNetworkHeadUserName =
              record.networkHeadUserName.trim();
            const networkHeadDetail = managerDetails.find(
              (managerDetail: any) =>
                managerDetail.userName == trimmedNetworkHeadUserName &&
                managerDetail.roleId == 22
            );
            if (networkHeadDetail) {
              networkHeadId = networkHeadDetail.id;
            }
          }

          //CUSTOMER EXPERIENCE HEAD
          let customerExperienceHeadId = null;
          if (record.customerExperienceHeadUserName) {
            const trimmedCustomerExperienceHeadUserName =
              record.customerExperienceHeadUserName.trim();
            const customerExperienceHeadDetail = managerDetails.find(
              (managerDetail: any) =>
                managerDetail.userName ==
                  trimmedCustomerExperienceHeadUserName &&
                managerDetail.roleId == 23
            );

            if (customerExperienceHeadDetail) {
              customerExperienceHeadId = customerExperienceHeadDetail.id;
            }
          }

          //COMMAND CENTRE HEAD
          let commandCentreHeadId = null;
          if (record.commandCentreHeadUserName) {
            const trimmedCommandCentreHeadUserName =
              record.commandCentreHeadUserName.trim();
            const commandCentreHeadDetail = managerDetails.find(
              (managerDetail: any) =>
                managerDetail.userName == trimmedCommandCentreHeadUserName &&
                managerDetail.roleId == 24
            );
            if (commandCentreHeadDetail) {
              commandCentreHeadId = commandCentreHeadDetail.id;
            }
          }

          //SERVICE HEAD
          let serviceHeadId = null;
          if (record.serviceHeadUserName) {
            const trimmedServiceHeadUserName =
              record.serviceHeadUserName.trim();
            const serviceHeadDetail = managerDetails.find(
              (managerDetail: any) =>
                managerDetail.userName == trimmedServiceHeadUserName &&
                managerDetail.roleId == 26
            );
            if (serviceHeadDetail) {
              serviceHeadId = serviceHeadDetail.id;
            }
          }

          //BO HEAD
          let boHeadId = null;
          if (record.boHeadUserName) {
            const trimmedBoHeadUserName = record.boHeadUserName.trim();
            const boHeadDetail = managerDetails.find(
              (managerDetail: any) =>
                managerDetail.userName == trimmedBoHeadUserName &&
                managerDetail.roleId == 27
            );
            if (boHeadDetail) {
              boHeadId = boHeadDetail.id;
            }
          }

          //COUNTRY
          let countryId = 0;
          if (record.country) {
            const trimedCountryName = record.country.trim();
            const countryExists = await Country.findOne({
              where: {
                name: trimedCountryName,
              },
              attributes: ["id"],
              paranoid: false,
            });
            if (countryExists) {
              countryId = countryExists.dataValues.id;
            }
          }

          //STATE
          let stateId = 0;
          if (record.stateId && countryId) {
            const trimmedStateName = record.stateId.trim();
            const stateExists = await State.findOne({
              where: {
                name: trimmedStateName,
                countryId: countryId,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (stateExists) {
              stateId = stateExists.dataValues.id;
            }
          }

          //SERVICE ORGANISATION
          let serviceOrganisationId = null;
          if (record.serviceOrganisationName) {
            const trimmedServiceOrganisationName =
              record.serviceOrganisationName.trim();
            const serviceOrganisationExists = await ServiceOrganisation.findOne(
              {
                where: {
                  name: trimmedServiceOrganisationName,
                },
                attributes: ["id"],
                paranoid: false,
              }
            );

            if (serviceOrganisationExists) {
              serviceOrganisationId = serviceOrganisationExists.dataValues.id;
            }
          }

          //REGION
          let regionId = null;
          if (record.regionName && stateId) {
            const trimmedRegionName = record.regionName.trim();
            const regionExists = await Region.findOne({
              where: {
                name: trimmedRegionName,
                stateId: stateId,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (regionExists) {
              regionId = regionExists.dataValues.id;
            }
          }

          let cityId = null;
          if (record.name && stateId && talukId) {
            const trimmedCityName = record.name.trim();
            const cityExists = await City.findOne({
              where: {
                name: trimmedCityName,
                stateId: stateId,
                talukId: talukId,
              },
              attributes: ["id"],
              paranoid: false,
            });

            if (cityExists) {
              cityId = cityExists.dataValues.id;
            }
          }

          //REQUESTS FOR STATE SAVE
          record.cityId = cityId;
          record.talukId = talukId;
          record.districtId = districtId;
          record.locationTypeId = locationTypeId;
          record.municipalLimitId = municipalLimitId;
          record.nearestCityId = nearestCityId;
          record.locationCategoryId = locationCategoryId;
          record.rmId = rmId;
          record.networkHeadId = networkHeadId;
          record.customerExperienceHeadId = customerExperienceHeadId;
          record.commandCentreHeadId = commandCentreHeadId;
          record.serviceHeadId = serviceHeadId;
          record.boHeadId = boHeadId;
          record.countryId = countryId;
          record.stateId = stateId;
          record.serviceOrganisationId = serviceOrganisationId;
          record.regionId = regionId;
          record.authUserId = req.body.authUserId;
          record.createdById = req.body.authUserId;
          record.updatedById = req.body.authUserId;
          record.status =
            record.status && record.status.toLowerCase() === "active" ? 1 : 0;
          const output = await save({}, {}, record);

          if (output.success === false) {
            let errorContent = null;
            if (output.errors && output.errors.length > 0) {
              errorContent = output.errors.join(",");
            } else {
              errorContent = output.error;
            }
            errorData.push({
              ...record,
              error: errorContent,
            });
            errorOutData.push({
              ...reArrangedCities,
              Error: errorContent,
            });
          } else {
            if (output.message === "City created successfully") {
              newRecordsCreated += 1;
            } else {
              existingRecordsUpdated += 1;
            }
          }
        }
      }
      const successMessage =
        newRecordsCreated > 0 && existingRecordsUpdated > 0
          ? `New city created (${newRecordsCreated} records) and existing city updated (${existingRecordsUpdated} records)`
          : newRecordsCreated > 0
          ? `New city created (${newRecordsCreated} records)`
          : existingRecordsUpdated > 0
          ? `Existing city updated (${existingRecordsUpdated} records)`
          : "No city updated or created";

      //If No Record Have Error Send Respond
      // if (errorData.length <= 0) {
      if (errorOutData.length <= 0) {
        return res.status(200).json({
          success: true,
          message: successMessage,
        });
      }

      //Get Final Data of User
      const userFinalData: any = errorOutData;

      // Column Filter
      const renamedUserColumnNames = Object.keys(userFinalData[0]);

      //Buffer Making
      const buffer = generateXLSXAndXLSExport(
        userFinalData,
        renamedUserColumnNames,
        "xlsx",
        "City"
      );

      //Set Header;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.status(200).json({
        success: true,
        message: successMessage,
        errorReportBuffer: buffer,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }

  getById = async (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const v = {
        id: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }
console.log(payload,"payloaddddddd");

      const cityExists = await City.findOne({
        attributes: [
          "id",
          "name",
          "locationTypeId",
          "municipalLimitId",
          "nearestCityId",
        ],
        where: {
          id: payload.id,
        },
        paranoid: false,
      });
      if (!cityExists) {
        return res.status(200).json({
          success: false,
          error: `City not found`,
        });
      }

      return res.status(200).json({
        success: true,
        data: cityExists,
      });
    } catch (error: any) {
      console.log("errorrrrrrrrr",error.message);
      
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  public async getCityData(req: any, res: any) {
    try {
      console.log(req.body, "req.body");

      const city = await City.findOne({ where: { id: req.body.cityId } });
      if (!city) {
        console.log("iffffffff");
        return res.status(200).json({
          success: false,
          message: "No city found",
        });
      }
      return res.status(200).json({
        success: true,
        data: city,
      });
    } catch (error: any) {
      console.log("error.message", error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  getByGoogleDetail = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const v = {
        pinCode: "nullable|string",
        district: "nullable|string",
        state: "nullable|string",
      };

      const errors = await Utils.validateParams(payload, v);
      if (errors) {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      if (!payload.pinCode && !payload.district && !payload.state) {
        return res.status(200).json({
          success: false,
          error: "Pincode or District or State is required",
        });
      }

      let stateId = null;
      if (payload.state) {
        const state = await State.findOne({
          attributes: ["id"],
          where: {
            googleMapCode: payload.state,
          },
        });
        stateId = state?.dataValues?.id || null;
      }

      const cities = await City.findAll({
        attributes: ["id", "name", "pincode"],
        where: {
          ...(payload.pinCode && { pincode: payload.pinCode }),
          ...(stateId && {
            stateId: stateId,
          }),
        },
        ...(payload.district && {
          include: {
            model: District,
            attributes: [],
            where: {
              name: {
                [Op.like]: `%${payload.district}%`,
              },
            },
          },
        }),
      });

      if (cities.length === 0) {
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
}

//Data Column and Data key, value rearrange (Final Data)
async function getCityFinalData(cityData: any) {
  //GET MANAGER USER DETAILS
  const userIds = new Set();
  cityData.forEach((city: any) => {
    if (city.dataValues.rmId) {
      userIds.add(city.dataValues.rmId);
    }
    if (city.dataValues.networkHeadId) {
      userIds.add(city.dataValues.networkHeadId);
    }
    if (city.dataValues.customerExperienceHeadId) {
      userIds.add(city.dataValues.customerExperienceHeadId);
    }
    if (city.dataValues.commandCentreHeadId) {
      userIds.add(city.dataValues.commandCentreHeadId);
    }
    if (city.dataValues.serviceHeadId) {
      userIds.add(city.dataValues.serviceHeadId);
    }
    if (city.dataValues.boHeadId) {
      userIds.add(city.dataValues.boHeadId);
    }
  });

  const uniqueUserIdsArray = [...userIds];
  let userDetails: any = [];
  if (uniqueUserIdsArray && uniqueUserIdsArray.length > 0) {
    const getUserDetails: any = await axios.post(
      `${userServiceUrl}/user/${userServiceEndpoint.importGetUserDetails}`,
      {
        userIds: uniqueUserIdsArray,
      }
    );

    if (getUserDetails.data && getUserDetails.data.success) {
      userDetails = getUserDetails.data.data.userDetails;
    }
  }

  const transformedData = await Promise.all(
    cityData.map(async (cityData: any) => {
      const stateById: any = await State.findOne({
        attributes: ["id", "countryId", "name"],
        where: { id: cityData.dataValues.stateId },
        paranoid: false,
      });

      let country = null;
      if (stateById) {
        country = await Country.findOne({
          attributes: ["id", "name"],
          where: { id: stateById.dataValues.countryId },
          paranoid: false,
        });
      }

      const [
        taluk,
        district,
        locationType,
        municipalLimit,
        nearestCity,
        locationCategory,
        serviceOrganisation,
        region,
      ]: any = await Promise.all([
        Taluk.findOne({
          attributes: ["id", "name"],
          where: {
            id: cityData.dataValues.talukId,
          },
          paranoid: false,
        }),
        District.findOne({
          attributes: ["id", "name"],
          where: {
            id: cityData.dataValues.districtId,
          },
          paranoid: false,
        }),
        Config.findOne({
          attributes: ["id", "name"],
          where: {
            id: cityData.dataValues.locationTypeId,
          },
          paranoid: false,
        }),
        Config.findOne({
          attributes: ["id", "name"],
          where: {
            id: cityData.dataValues.municipalLimitId,
          },
          paranoid: false,
        }),
        NearestCity.findOne({
          attributes: ["id", "name"],
          where: {
            id: cityData.dataValues.nearestCityId,
          },
          paranoid: false,
        }),
        Config.findOne({
          attributes: ["id", "name"],
          where: {
            id: cityData.dataValues.locationCategoryId,
          },
          paranoid: false,
        }),
        ServiceOrganisation.findOne({
          attributes: ["id", "name"],
          where: {
            id: cityData.dataValues.serviceOrganisationId,
          },
          paranoid: false,
        }),
        Region.findOne({
          attributes: ["id", "name"],
          where: {
            id: cityData.dataValues.regionId,
          },
          paranoid: false,
        }),
      ]);

      let rmDetail = null;
      if (cityData.dataValues.rmId) {
        rmDetail = userDetails.find(
          (userDetail: any) => userDetail.id == cityData.dataValues.rmId
        );
      }

      let networkHeadDetail = null;
      if (cityData.dataValues.networkHeadId) {
        networkHeadDetail = userDetails.find(
          (userDetail: any) =>
            userDetail.id == cityData.dataValues.networkHeadId
        );
      }

      let customerExperienceHeadDetail = null;
      if (cityData.dataValues.customerExperienceHeadId) {
        customerExperienceHeadDetail = userDetails.find(
          (userDetail: any) =>
            userDetail.id == cityData.dataValues.customerExperienceHeadId
        );
      }

      let commandCentreHeadDetail = null;
      if (cityData.dataValues.commandCentreHeadId) {
        commandCentreHeadDetail = userDetails.find(
          (userDetail: any) =>
            userDetail.id == cityData.dataValues.commandCentreHeadId
        );
      }

      let serviceHeadDetail = null;
      if (cityData.dataValues.serviceHeadId) {
        serviceHeadDetail = userDetails.find(
          (userDetail: any) =>
            userDetail.id == cityData.dataValues.serviceHeadId
        );
      }

      let boHeadDetail = null;
      if (cityData.dataValues.boHeadId) {
        boHeadDetail = userDetails.find(
          (userDetail: any) => userDetail.id == cityData.dataValues.boHeadId
        );
      }

      return {
        Name: cityData.dataValues.name,
        "Taluk Name": taluk ? taluk.dataValues.name : null,
        "District Name": district ? district.dataValues.name : null,
        "Pin Code": cityData.dataValues.pincode,
        Latitude: cityData.dataValues.latitude,
        Longitude: cityData.dataValues.longitude,
        "Location Type Name": locationType
          ? locationType.dataValues.name
          : null,
        "Municipal Limit Name": municipalLimit
          ? municipalLimit.dataValues.name
          : null,
        "Nearest City Name": nearestCity ? nearestCity.dataValues.name : null,
        "Service Organisation": serviceOrganisation
          ? serviceOrganisation.dataValues.name
          : null,
        Region: region ? region.dataValues.name : null,
        "Location Category Name": locationCategory
          ? locationCategory.dataValues.name
          : null,
        "RM Name": rmDetail ? rmDetail.name : null,
        "Network Head Name": networkHeadDetail ? networkHeadDetail.name : null,
        "Customer Experience Head Name": customerExperienceHeadDetail
          ? customerExperienceHeadDetail.name
          : null,
        "Command Centre Head Name": commandCentreHeadDetail
          ? commandCentreHeadDetail.name
          : null,
        "Service Head Name": serviceHeadDetail ? serviceHeadDetail.name : null,
        "BO Head Name": boHeadDetail ? boHeadDetail.name : null,
        Country: country ? country.dataValues.name : null,
        State: stateById ? stateById.dataValues.name : null,
        "Created At": moment
          .tz(cityData.dataValues.createdAt, "Asia/Kolkata")
          .format("DD/MM/YYYY hh:mm A"),
        Status: cityData.dataValues.deletedAt ? "Inactive" : "Active",
      };
    })
  );
  return transformedData;
}

async function save(req: any, res: any, importData?: any) {
  const transaction = await sequelize.transaction();
  try {
    let payload = req.body;
    if (importData !== undefined) {
      payload = importData;
      if (!payload.rmId) {
        await transaction.rollback();
        return {
          success: false,
          error: "RM not found",
          data: payload,
        };
      }
    } else {
      payload = req.body;
    }

    //VALIDATIONS
    const validatorRules = {
      cityId: "numeric",
      name: "required|string|minLength:3|maxLength:255",
      talukId: "required|numeric",
      districtId: "required|numeric",
      countryId: "required|numeric",
      stateId: "required|numeric",
      pincode: "required|string|minLength:6|maxLength:6",
      latitude: "required|string|maxLength:100",
      longitude: "required|string|maxLength:100",
      locationTypeId: "required|numeric",
      municipalLimitId: "required|numeric",
      nearestCityId: "required|numeric",
      locationCategoryId: "required|numeric",
      rmId: "required|numeric",
      networkHeadId: "numeric",
      customerExperienceHeadId: "numeric",
      commandCentreHeadId: "numeric",
      serviceHeadId: "numeric",
      boHeadId: "numeric",
      status: "required|numeric",
    };
    const errors = await Utils.validateParams(payload, validatorRules);
    if (errors) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          errors: errors,
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }
    }

    const { cityId, name, ...inputData } = payload;
    const cityName = name.trim();
    const [
      country,
      state,
      taluk,
      district,
      locationType,
      municipalLimit,
      nearestCity,
      locationCategory,
    ]: any = await Promise.all([
      Country.findByPk(inputData.countryId),
      State.findByPk(inputData.stateId),
      Taluk.findOne({
        attributes: ["id"],
        where: {
          id: inputData.talukId,
        },
      }),
      District.findOne({
        attributes: ["id"],
        where: {
          id: inputData.districtId,
        },
      }),
      Config.findOne({
        attributes: ["id"],
        where: {
          id: inputData.locationTypeId,
        },
      }),
      Config.findOne({
        attributes: ["id"],
        where: {
          id: inputData.municipalLimitId,
        },
      }),
      NearestCity.findOne({
        attributes: ["id"],
        where: {
          id: inputData.nearestCityId,
        },
      }),
      Config.findOne({
        attributes: ["id"],
        where: {
          id: inputData.locationCategoryId,
        },
      }),
    ]);

    if (!country) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Country not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Country not found",
        });
      }
    }

    if (!state) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "State not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "State not found",
        });
      }
    }

    if (!taluk) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Taluk not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Taluk not found",
        });
      }
    }

    if (!district) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "District not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "District not found",
        });
      }
    }

    if (!locationType) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Location type not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Location type not found",
        });
      }
    }

    if (!municipalLimit) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Municipal limit not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Municipal limit not found",
        });
      }
    }

    if (!nearestCity) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Nearest city not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Nearest city not found",
        });
      }
    }

    if (!locationCategory) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "Location category not found",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "Location category not found",
        });
      }
    }

    //MANAGER DETAIL VALIDATION
    if (importData) {
      if (payload.rmUserName && !payload.rmId) {
        await transaction.rollback();
        return {
          success: false,
          error: "Regional manager not found",
          data: payload,
        };
      }

      if (payload.networkHeadUserName && !payload.networkHeadId) {
        await transaction.rollback();
        return {
          success: false,
          error: "Network head data not found",
          data: payload,
        };
      }

      if (
        payload.customerExperienceHeadUserName &&
        !payload.customerExperienceHeadId
      ) {
        await transaction.rollback();
        return {
          success: false,
          error: "Customer experience head not found",
          data: payload,
        };
      }

      if (payload.commandCentreHeadUserName && !payload.commandCentreHeadId) {
        await transaction.rollback();
        return {
          success: false,
          error: "Command centre head not found",
          data: payload,
        };
      }

      if (payload.serviceHeadUserName && !payload.serviceHeadId) {
        await transaction.rollback();
        return {
          success: false,
          error: "Service head not found",
          data: payload,
        };
      }

      if (payload.boHeadUserName && !payload.boHeadId) {
        await transaction.rollback();
        return {
          success: false,
          error: "BO head not found",
          data: payload,
        };
      }

      if (payload.serviceOrganisationName && !payload.serviceOrganisationId) {
        await transaction.rollback();
        return {
          success: false,
          error: "Service organisation not found",
          data: payload,
        };
      }

      if (payload.regionName && !payload.regionId) {
        await transaction.rollback();
        return {
          success: false,
          error: "Region not found",
          data: payload,
        };
      }
    }

    let where: any = {
      name: cityName,
      stateId: inputData.stateId,
      talukId: inputData.talukId,
    };
    if (cityId) {
      const city = await City.findOne({
        where: {
          id: cityId,
        },
        paranoid: false,
      });
      if (!city) {
        await transaction.rollback();
        if (importData !== undefined) {
          return {
            success: false,
            error: "City not found",
            data: payload,
          };
        } else {
          return res.status(200).json({
            success: false,
            error: "City not found",
          });
        }
      }
      where.id = {
        [Op.ne]: cityId,
      };
    }

    const cityAlreadyExists = await City.findOne({
      where,
      attributes: ["id"],
      paranoid: false,
    });
    if (cityAlreadyExists) {
      await transaction.rollback();
      if (importData !== undefined) {
        return {
          success: false,
          error: "City is already taken",
          data: payload,
        };
      } else {
        return res.status(200).json({
          success: false,
          error: "City is already taken",
        });
      }
    }

    //DATA PROCESS
    let deletedAt = null;
    let deletedById = null;
    //INACTIVE
    if (inputData.status == 0) {
      deletedAt = new Date();
      deletedById = inputData.authUserId;
    }

    const data: any = {
      ...inputData,
      name: cityName,
      deletedById: deletedById,
      deletedAt: deletedAt,
    };

    let message = null;
    if (cityId) {
      await City.update(data, {
        where: {
          id: cityId,
        },
        paranoid: false,
        transaction: transaction,
      });
      message = "City updated successfully";
    } else {
      await City.create(data, {
        transaction: transaction,
      });
      message = "City created successfully";
    }

    await transaction.commit();
    if (importData !== undefined) {
      return {
        success: true,
        message: message,
      };
    } else {
      return res.status(200).json({
        success: true,
        message: message,
      });
    }
  } catch (error: any) {
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export const getCity = async (id: any) => {
  try {
    let city: any = await City.findOne({
      where: { id: id },
    });
    return city ? city : false;
  } catch (error: any) {
    throw error;
  }
};

export default new CityController();
