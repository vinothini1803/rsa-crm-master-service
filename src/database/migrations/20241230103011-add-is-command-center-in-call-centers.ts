import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` ADD `isCommandCenter` BOOLEAN DEFAULT 0 AFTER `callCentreHeadId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `callCenters` DROP COLUMN `isCommandCenter`;"
    );
  },
};
