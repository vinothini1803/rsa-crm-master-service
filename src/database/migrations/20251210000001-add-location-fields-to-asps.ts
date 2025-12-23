import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `asps` ADD `lastLatitude` VARCHAR(60) NULL DEFAULT NULL AFTER `financeAdminId`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `asps` ADD `lastLongitude` VARCHAR(60) NULL DEFAULT NULL AFTER `lastLatitude`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `asps` ADD `lastLocationUpdatedAt` DATETIME NULL DEFAULT NULL AFTER `lastLongitude`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `asps` ADD `lastLocationAttendanceLogId` INT UNSIGNED NULL DEFAULT NULL AFTER `lastLocationUpdatedAt`;"
        );
    },

    down: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `asps` DROP COLUMN `lastLocationAttendanceLogId`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `asps` DROP COLUMN `lastLocationUpdatedAt`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `asps` DROP COLUMN `lastLongitude`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `asps` DROP COLUMN `lastLatitude`;"
        );
    },
};

