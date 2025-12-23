import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` ADD `callCentreHeadId` INT UNSIGNED NULL DEFAULT NULL AFTER `address`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` DROP COLUMN `callCentreHeadId`;"
    );
  },
};
