import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `networkHeadId` INT UNSIGNED NULL DEFAULT NULL AFTER `rmId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `customerExperienceHeadId` INT UNSIGNED NULL DEFAULT NULL AFTER `networkHeadId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `commandCentreHeadId` INT UNSIGNED NULL DEFAULT NULL AFTER `customerExperienceHeadId`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `networkHeadId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `customerExperienceHeadId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `commandCentreHeadId`;"
    );
  },
};
