import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `createdById` INT UNSIGNED NULL DEFAULT NULL AFTER `dynamicTypeId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `updatedById` INT UNSIGNED NULL DEFAULT NULL AFTER `createdById`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `deletedById` INT UNSIGNED NULL DEFAULT NULL AFTER `updatedById`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `createdById`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `updatedById`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `deletedById`;"
    );
  },
};
