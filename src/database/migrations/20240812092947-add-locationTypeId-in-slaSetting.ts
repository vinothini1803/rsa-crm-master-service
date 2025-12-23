import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `slaSettings` ADD `locationTypeId` INT UNSIGNED NULL DEFAULT NULL AFTER `roleId`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `slaSettings` DROP COLUMN `locationTypeId`;"
    );
  }, 
};