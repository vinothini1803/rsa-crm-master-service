import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` ADD `spocEmailIds` TEXT DEFAULT NULL AFTER `whatsappNumber`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` DROP COLUMN `spocEmailIds`;"
    );
  },
};

