import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `isActiveReminderSent` BOOLEAN DEFAULT 0 AFTER `inActiveToDate`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `isActiveReminderSent`;"
    );
  },
};
