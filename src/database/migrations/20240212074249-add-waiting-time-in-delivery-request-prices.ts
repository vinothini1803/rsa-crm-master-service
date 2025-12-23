import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `deliveryRequestPrices` ADD `waitingChargePerHour` DECIMAL(12,2) UNSIGNED NULL DEFAULT NULL AFTER `aboveRangePrice`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `deliveryRequestPrices` DROP `waitingChargePerHour`;"
    );
  },
};
