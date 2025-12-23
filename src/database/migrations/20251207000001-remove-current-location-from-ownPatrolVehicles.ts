import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `currentLongitude`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `currentLatitude`;"
        );
    },

    down: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` ADD `currentLatitude` VARCHAR(60) NULL DEFAULT NULL AFTER `lastGpsCaptured`;"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicles` ADD `currentLongitude` VARCHAR(60) NULL DEFAULT NULL AFTER `currentLatitude`;"
        );
    },
};

