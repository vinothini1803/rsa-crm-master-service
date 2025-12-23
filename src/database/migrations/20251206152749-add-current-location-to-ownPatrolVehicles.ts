import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `currentLatitude` VARCHAR(60) NULL DEFAULT NULL AFTER `lastGpsCaptured`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `currentLongitude` VARCHAR(60) NULL DEFAULT NULL AFTER `currentLatitude`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `currentLocationUpdatedAt` DATE NULL DEFAULT NULL AFTER `currentLongitude`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `currentLocationAttendanceLogId` INT UNSIGNED NULL DEFAULT NULL AFTER `currentLocationUpdatedAt`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `currentLocationAttendanceLogId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `currentLocationUpdatedAt`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `currentLongitude`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `currentLatitude`;"
    );
  },
};

