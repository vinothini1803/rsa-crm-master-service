import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `dealers` ADD `autoCancelForDelivery` BOOLEAN NOT NULL DEFAULT FALSE AFTER `walletBalance`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `dealers` DROP COLUMN `autoCancelForDelivery`;"
    );
  },
};
