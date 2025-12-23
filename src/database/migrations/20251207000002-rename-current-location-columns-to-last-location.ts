import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` CHANGE `currentLocationUpdatedAt` `lastLocationUpdatedAt` DATE NULL DEFAULT NULL;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` CHANGE `currentLocationAttendanceLogId` `lastLocationAttendanceLogId` INT UNSIGNED NULL DEFAULT NULL;"
        );
    },

    down: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` CHANGE `lastLocationUpdatedAt` `currentLocationUpdatedAt` DATE NULL DEFAULT NULL;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` CHANGE `lastLocationAttendanceLogId` `currentLocationAttendanceLogId` INT UNSIGNED NULL DEFAULT NULL;"
        );
    },
};

