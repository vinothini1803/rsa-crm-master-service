import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `emailId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `email` VARCHAR(255) NULL AFTER `code`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `roleId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `ownPatrolId`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `emailId` VARCHAR(255) NULL AFTER `code`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `email`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `roleId` INT UNSIGNED NULL DEFAULT NULL AFTER `businessHourId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `ownPatrolId` INT UNSIGNED NULL DEFAULT NULL AFTER `priorityId`;"
    );
  },
};
