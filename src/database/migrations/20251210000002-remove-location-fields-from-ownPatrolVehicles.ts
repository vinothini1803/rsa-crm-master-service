import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        // First, migrate data from ownPatrolVehicles to asps
        await queryInterface.sequelize.query(`
            UPDATE asps a
            INNER JOIN ownPatrolVehicles v ON a.id = v.aspId AND v.deletedAt IS NULL
            SET 
                a.lastLatitude = v.lastLatitude,
                a.lastLongitude = v.lastLongitude,
                a.lastLocationUpdatedAt = v.lastLocationUpdatedAt,
                a.lastLocationAttendanceLogId = v.lastLocationAttendanceLogId
            WHERE v.lastLatitude IS NOT NULL OR v.lastLongitude IS NOT NULL;
        `);

        // Then remove the columns
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `lastLocationAttendanceLogId`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `lastLocationUpdatedAt`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `lastLongitude`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `lastLatitude`;"
        );
    },

    down: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` ADD `lastLatitude` VARCHAR(60) NULL DEFAULT NULL AFTER `serviceOrganisationId`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` ADD `lastLongitude` VARCHAR(60) NULL DEFAULT NULL AFTER `lastLatitude`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` ADD `lastLocationUpdatedAt` DATETIME NULL DEFAULT NULL AFTER `lastLongitude`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` ADD `lastLocationAttendanceLogId` INT UNSIGNED NULL DEFAULT NULL AFTER `lastLocationUpdatedAt`;"
        );
    },
};

