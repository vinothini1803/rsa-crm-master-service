import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `spocUserId` INT UNSIGNED NULL DEFAULT NULL AFTER `deliveryRequestSerialNumberCategoryId`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `spocUserId`;"
    );
  }, 
};