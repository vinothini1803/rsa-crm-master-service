import { Op, Sequelize } from "sequelize";
import { RosSuccessReason } from "../database/models/index";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import config from "../config/config.json";
import axios from "axios";
import moment from "moment-timezone";

import {
    generateXLSXAndXLSExport,
    generateCSVExport,
} from "../middleware/excelMiddleware";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class RosSuccessReasonController {
    private static defaultLimit: number = 10;
    private static defaultOffset: number = 0;
    constructor() { }

    getList = async (req: any, res: any) => {
        try {
            const { limit, offset, id, apiType, search, status } = req.query;
            const where: any = {};
            if (id) {
                where.id = id;
            }

            let rosSuccessReasons: any = null;
            if (apiType === "dropdown") {
                if (search) {
                    where.name = { [Op.like]: `%${search}%` };
                }

                rosSuccessReasons = await RosSuccessReason.findAll({
                    where,
                    attributes: ["id", "name"],
                    order: [["id", "asc"]],
                });
                if (rosSuccessReasons.length === 0) {
                    return res.status(200).json({
                        success: false,
                        error: "No data found",
                    });
                }
            } else {
                if (search) {
                    where[Op.or] = [
                        { name: { [Op.like]: `%${search}%` } },
                        Sequelize.literal(
                            `( IF (deletedAt IS NULL, 'Active', 'Inactive') LIKE "%${search}%" )`
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

                let limitValue: number = RosSuccessReasonController.defaultLimit;
                if (limit) {
                    const parsedLimit = parseInt(limit);
                    if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
                        limitValue = parsedLimit;
                    }
                }

                let offsetValue: number = RosSuccessReasonController.defaultOffset;
                if (offset) {
                    const parsedOffset = parseInt(offset);
                    if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
                        offsetValue = parsedOffset;
                    }
                }

                const rosSuccessReasonDetails = await RosSuccessReason.findAndCountAll({
                    where,
                    attributes: [
                        "id",
                        "name",
                        [
                            Sequelize.literal(
                                "( SELECT DATE_FORMAT(createdAt,'%d/%m/%Y %h:%i %p') )"
                            ),
                            "createdAt",
                        ],
                        [
                            Sequelize.literal(
                                "( SELECT IF (deletedAt IS NULL, 'Active', 'Inactive') )"
                            ),
                            "status",
                        ],
                    ],

                    order: [["id", "desc"]],
                    limit: limitValue,
                    offset: offsetValue,
                    paranoid: false,
                });
                if (rosSuccessReasonDetails.count === 0) {
                    return res.status(200).json({
                        success: false,
                        error: "No data found",
                    });
                }

                rosSuccessReasons = {
                    count: rosSuccessReasonDetails.count,
                    rows: rosSuccessReasonDetails.rows,
                };
            }

            return res.status(200).json({
                success: true,
                message: "Data Fetched Successfully",
                data: rosSuccessReasons,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: error?.message,
            });
        }
    };

    updateStatus = async (req: any, res: any) => {
        const transaction = await sequelize.transaction();
        try {
            const payload = req.body;
            const validateData = {
                status: "required|numeric",
                rosSuccessReasonIds: "required|array",
                "rosSuccessReasonIds.*": "required",
            };
            const errors = await Utils.validateParams(payload, validateData);
            if (errors) {
                await transaction.rollback();
                return res.status(200).json({
                    success: false,
                    errors: errors,
                });
            }

            const { rosSuccessReasonIds, status, updatedById, deletedById } = payload;
            if (rosSuccessReasonIds.length == 0) {
                await transaction.rollback();
                return res.status(200).json({
                    success: false,
                    error: "Please select at least one ROS success reason",
                });
            }

            //Inactive
            let deletedAt = null;
            if (status == 0) {
                deletedAt = new Date();
            }

            for (const rosSuccessReasonId of rosSuccessReasonIds) {
                const rosSuccessReasonExists = await RosSuccessReason.findOne({
                    attributes: ["id"],
                    where: {
                        id: rosSuccessReasonId,
                    },
                    paranoid: false,
                });
                if (!rosSuccessReasonExists) {
                    await transaction.rollback();
                    return res.status(200).json({
                        success: false,
                        error: `ROS success reason (${rosSuccessReasonId}) not found`,
                    });
                }

                await RosSuccessReason.update(
                    {
                        updatedById,
                        deletedById,
                        deletedAt,
                    },
                    {
                        where: {
                            id: rosSuccessReasonId,
                        },
                        paranoid: false,
                        transaction: transaction,
                    }
                );
            }

            await transaction.commit();
            return res.status(200).json({
                success: true,
                message: "ROS success reason status updated successfully",
            });
        } catch (error: any) {
            await transaction.rollback();
            return res.status(500).json({
                success: false,
                error: error?.message,
            });
        }
    };

    delete = async (req: any, res: any) => {
        const transaction = await sequelize.transaction();
        try {
            const payload = req.body;
            const validateData = {
                rosSuccessReasonIds: "required|array",
                "rosSuccessReasonIds.*": "required",
            };
            const errors = await Utils.validateParams(payload, validateData);
            if (errors) {
                await transaction.rollback();
                return res.status(200).json({
                    success: false,
                    errors: errors,
                });
            }

            const { rosSuccessReasonIds } = payload;
            if (rosSuccessReasonIds.length == 0) {
                await transaction.rollback();
                return res.status(200).json({
                    success: false,
                    error: "Please select at least one ROS success reason",
                });
            }

            for (const rosSuccessReasonId of rosSuccessReasonIds) {
                const rosSuccessReasonExists = await RosSuccessReason.findOne({
                    attributes: ["id"],
                    where: {
                        id: rosSuccessReasonId,
                    },
                    paranoid: false,
                });
                if (!rosSuccessReasonExists) {
                    await transaction.rollback();
                    return res.status(200).json({
                        success: false,
                        error: `ROS success reason (${rosSuccessReasonId}) not found`,
                    });
                }

                await RosSuccessReason.destroy({
                    where: {
                        id: rosSuccessReasonId,
                    },
                    force: true,
                    transaction: transaction,
                });
            }

            await transaction.commit();
            return res.status(200).json({
                success: true,
                message: "ROS success reason deleted successfully",
            });
        } catch (error: any) {
            await transaction.rollback();
            return res.status(500).json({
                success: false,
                error: error?.message,
            });
        }
    };

    getFormData = async (req: any, res: any) => {
        try {
            const { rosSuccessReasonId } = req.query;
            let rosSuccessReasonData = null;
            if (rosSuccessReasonId) {
                const rosSuccessReasonExists: any = await RosSuccessReason.findOne({
                    attributes: ["id", "name", "deletedAt"],
                    where: {
                        id: rosSuccessReasonId,
                    },
                    paranoid: false,
                });

                if (!rosSuccessReasonExists) {
                    return res.status(200).json({
                        success: false,
                        error: "ROS success reason not found",
                    });
                }

                rosSuccessReasonData = {
                    id: rosSuccessReasonExists.dataValues.id,
                    name: rosSuccessReasonExists.dataValues.name,
                    status: rosSuccessReasonExists.dataValues.deletedAt ? 0 : 1,
                };
            }

            const data = {
                rosSuccessReason: rosSuccessReasonData,
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

    getById = async (req: any, res: any) => {
        try {
            const { rosSuccessReasonId } = req.query;
            const rosSuccessReason: any = await RosSuccessReason.findOne({
                attributes: ["id", "name"],
                where: {
                    id: rosSuccessReasonId,
                },
                paranoid: false,
            });

            if (!rosSuccessReason) {
                return res.status(200).json({
                    success: false,
                    error: "ROS success reason not found",
                });
            }

            return res.status(200).json({
                success: true,
                data: {
                    rosSuccessReason: rosSuccessReason,
                },
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    };

    saveAndUpdate = async (req: any, res: any) => {
        return save(req, res);
    };

    public async import(req: any, res: any) {
        try {
            const inData = req.body.jsonDataArray;
            const errorData = [];
            const errorOutData = [];
            let newRecordsCreated = 0;
            let existingRecordsUpdated = 0;

            const importColumnsResponse = await Utils.getExcelImportColumns(1129);
            if (!importColumnsResponse.success) {
                return res.status(200).json({
                    success: false,
                    error: importColumnsResponse.error,
                });
            }
            let importColumns: any = importColumnsResponse.data;

            const importValidationResponse = await Utils.validateExcelImport({
                sheetDetails: Object.values(inData) ? Object.values(inData)[0] : [],
                importTypeId: 1129,
            });
            if (!importValidationResponse.success) {
                return res.status(200).json({
                    success: false,
                    error: importValidationResponse.error,
                });
            }

            for (const data1 of inData) {
                let data2 = data1["data"];
                for (const data3 of data2) {
                    importColumns.forEach((importColumn: any) => {
                        if (!data3.hasOwnProperty(importColumn)) {
                            data3[importColumn] = "";
                        }
                    });

                    let reArrangedRosSuccessReasons: any = {
                        Name: data3["Name"] ? String(data3["Name"]) : null,
                        Status: data3["Status"] ? String(data3["Status"]) : null,
                    };

                    const record: any = {};
                    for (const key in reArrangedRosSuccessReasons) {
                        let transformedKey = key
                            .replace(/\s+/g, "")
                            .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
                                index === 0 ? word.toLowerCase() : word.toUpperCase()
                            );

                        record[transformedKey] = reArrangedRosSuccessReasons[key];
                    }

                    const validationErrors = [];
                    if (
                        record.status &&
                        !["Active", "Inactive"].includes(record.status)
                    ) {
                        validationErrors.push("Status value should be Active or Inactive.");
                    }

                    if (validationErrors.length > 0) {
                        errorOutData.push({
                            ...reArrangedRosSuccessReasons,
                            Error: validationErrors.join(","),
                        });
                        continue;
                    }

                    //ROS SUCCESS REASON
                    let rosSuccessReasonId = null;
                    if (record.name) {
                        const trimmedName = record.name.trim();
                        const rosSuccessReasonExists = await RosSuccessReason.findOne({
                            attributes: ["id"],
                            where: {
                                name: trimmedName,
                            },
                            paranoid: false,
                        });

                        if (rosSuccessReasonExists) {
                            rosSuccessReasonId = rosSuccessReasonExists.dataValues.id;
                        }
                    }

                    //REQUESTS
                    record.rosSuccessReasonId = rosSuccessReasonId;
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
                            ...reArrangedRosSuccessReasons,
                            Error: errorContent,
                        });
                    } else {
                        if (output.message === "ROS success reason created successfully") {
                            newRecordsCreated += 1;
                        } else {
                            existingRecordsUpdated += 1;
                        }
                    }
                }
            }

            const successMessage =
                newRecordsCreated > 0 && existingRecordsUpdated > 0
                    ? `New ROS success reason created (${newRecordsCreated} records) and existing ROS success reason updated (${existingRecordsUpdated} records)`
                    : newRecordsCreated > 0
                        ? `New ROS success reason created (${newRecordsCreated} records)`
                        : existingRecordsUpdated > 0
                            ? `Existing ROS success reason updated (${existingRecordsUpdated} records)`
                            : "No ROS success reason updated or created";

            //If No Record Have Error Send Respond
            if (errorOutData.length <= 0) {
                return res.status(200).json({
                    success: true,
                    message: successMessage,
                });
            }

            //Get Final Data
            const rosSuccessReasonData: any = errorOutData;

            // Column Filter
            const renamedRosSuccessReasonColumnNames = Object.keys(
                rosSuccessReasonData[0]
            );

            //Buffer Making
            const buffer = generateXLSXAndXLSExport(
                rosSuccessReasonData,
                renamedRosSuccessReasonColumnNames,
                "xlsx",
                "ROS Success Reason"
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

    public async export(req: any, res: any) {
        try {
            const { format, startDate, endDate } = req.query;
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

            const rosSuccessReasons: any = await RosSuccessReason.findAll({
                where,
                attributes: {
                    exclude: ["createdById", "updatedById", "deletedById", "updatedAt"],
                },
                paranoid: false,
            });
            if (!rosSuccessReasons || rosSuccessReasons.length === 0) {
                return res.status(200).json({
                    success: false,
                    error: startDate && endDate ? "No record found for the selected date range" : "No record found",
                });
            }

            let rosSuccessReasonDetailsArray: any[] = [];
            for (const rosSuccessReason of rosSuccessReasons) {
                rosSuccessReasonDetailsArray.push({
                    Name: rosSuccessReason.dataValues.name,
                    "Created At": moment
                        .tz(rosSuccessReason.dataValues.createdAt, "Asia/Kolkata")
                        .format("DD/MM/YYYY hh:mm A"),
                    Status: rosSuccessReason.dataValues.deletedAt ? "Inactive" : "Active",
                });
            }

            // Column Filter;
            const rosSuccessReasonColumnNames = rosSuccessReasonDetailsArray
                ? Object.keys(rosSuccessReasonDetailsArray[0])
                : [];

            // Buffer File Store Area;
            let buffer;
            // Excel or CSV file Creation;
            if (Utils.isExcelFormat(format)) {
                buffer = generateXLSXAndXLSExport(
                    rosSuccessReasonDetailsArray,
                    rosSuccessReasonColumnNames,
                    format,
                    "ROS Success Reason"
                );
                // Excel file Header set;
                Utils.setExcelHeaders(res, format);
            } else if (format === "csv") {
                buffer = generateCSVExport(
                    rosSuccessReasonDetailsArray,
                    rosSuccessReasonColumnNames
                );
            } else {
                return res.status(200).json({
                    success: false,
                    error: "Unsupported export format",
                });
            }

            return res.status(200).json({
                success: true,
                message: `ROS success reason data export successfully`,
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
}

async function save(req: any, res: any, importData?: any) {
    const transaction = await sequelize.transaction();
    try {
        let payload;
        if (importData) {
            payload = importData;
        } else {
            payload = req.body;
        }

        //VALIDATIONS
        const v = {
            rosSuccessReasonId: "numeric",
            name: "required|string|minLength:3|maxLength:255",
            status: "required|numeric",
        };
        const errors = await Utils.validateParams(payload, v);
        if (errors) {
            await transaction.rollback();

            if (importData) {
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

        const { rosSuccessReasonId, name, ...inputData } = payload;
        const rosSuccessReasonName = name.trim();

        if (rosSuccessReasonId) {
            const rosSuccessReason = await RosSuccessReason.findOne({
                attributes: ["id"],
                where: {
                    id: rosSuccessReasonId,
                },
                paranoid: false,
            });
            if (!rosSuccessReason) {
                await transaction.rollback();

                if (importData) {
                    return {
                        success: false,
                        error: "ROS success reason not found",
                        data: payload,
                    };
                } else {
                    return res.status(200).json({
                        success: false,
                        error: "ROS success reason not found",
                    });
                }
            }

            const rosSuccessReasonAlreadyExists = await RosSuccessReason.findOne({
                where: {
                    name: rosSuccessReasonName,
                    id: {
                        [Op.ne]: rosSuccessReasonId,
                    },
                },
                attributes: ["id"],
                paranoid: false,
            });
            if (rosSuccessReasonAlreadyExists) {
                await transaction.rollback();

                if (importData) {
                    return {
                        success: false,
                        error: "ROS success reason name is already taken",
                        data: payload,
                    };
                } else {
                    return res.status(200).json({
                        success: false,
                        error: "ROS success reason name is already taken",
                    });
                }
            }
        } else {
            const rosSuccessReasonAlreadyExists = await RosSuccessReason.findOne({
                where: {
                    name: rosSuccessReasonName,
                },
                attributes: ["id"],
                paranoid: false,
            });
            if (rosSuccessReasonAlreadyExists) {
                await transaction.rollback();

                if (importData) {
                    return {
                        success: false,
                        error: "ROS success reason name is already taken",
                        data: payload,
                    };
                } else {
                    return res.status(200).json({
                        success: false,
                        error: "ROS success reason name is already taken",
                    });
                }
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
            name: rosSuccessReasonName,
            deletedById: deletedById,
            deletedAt: deletedAt,
        };

        let message = null;
        if (rosSuccessReasonId) {
            await RosSuccessReason.update(data, {
                where: {
                    id: rosSuccessReasonId,
                },
                paranoid: false,
                transaction: transaction,
            });
            message = "ROS success reason updated successfully";
        } else {
            await RosSuccessReason.create(data, {
                transaction: transaction,
            });
            message = "ROS success reason created successfully";
        }

        await transaction.commit();

        if (importData) {
            return {
                success: true,
                message: message,
                data: payload,
            };
        } else {
            return res.status(200).json({
                success: true,
                message: message,
            });
        }
    } catch (error: any) {
        await transaction.rollback();
        if (importData) {
            return {
                success: false,
                error: error.message,
                data: importData,
            };
        } else {
            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
}
export default new RosSuccessReasonController();

