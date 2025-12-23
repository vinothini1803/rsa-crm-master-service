import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `dealers` ADD `financeAdminUserId` INT UNSIGNED NULL DEFAULT NULL AFTER `autoCancelForDelivery`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `dealers` DROP COLUMN `financeAdminUserId`;"
    );
  },
};
