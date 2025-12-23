import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `serviceHeadId` INT UNSIGNED NULL DEFAULT NULL AFTER `commandCentreHeadId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `boHeadId` INT UNSIGNED NULL DEFAULT NULL AFTER `serviceHeadId`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `serviceHeadId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `boHeadId`;"
    );
  },
};
