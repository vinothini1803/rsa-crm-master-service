import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` ADD `email` VARCHAR(150) DEFAULT NULL AFTER `isCommandCenter`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` ADD `phoneNumber` VARCHAR(15) DEFAULT NULL AFTER `email`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` ADD `tollFreeNumber` VARCHAR(20) DEFAULT NULL AFTER `phoneNumber`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` ADD `whatsappNumber` VARCHAR(15) DEFAULT NULL AFTER `tollFreeNumber`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` DROP COLUMN `email`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` DROP COLUMN `phoneNumber`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` DROP COLUMN `tollFreeNumber`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` DROP COLUMN `whatsappNumber`;"
    );
  },
};
