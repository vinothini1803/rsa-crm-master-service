import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Asp } from "./index";

const aspLocationLog = sequelize.define(
    "aspLocationLog",
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
        },
        aspId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        attendanceLogId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        aspMechanicId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },
        latitude: {
            type: DataTypes.STRING(60),
            allowNull: false,
        },
        longitude: {
            type: DataTypes.STRING(60),
            allowNull: false,
        },
        capturedAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
    {
        tableName: "aspLocationLogs",
        collate: "utf8mb4_general_ci",
        timestamps: true,
    }
);

//Relationships ---------------------------------

aspLocationLog.belongsTo(Asp, {
    foreignKey: "aspId",
    as: "asp",
});

Asp.hasMany(aspLocationLog, {
    foreignKey: "aspId",
    as: "locationLogs",
});

export default aspLocationLog;

