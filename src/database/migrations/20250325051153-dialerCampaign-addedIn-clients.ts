import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `dialerCampaignName` VARCHAR(199) DEFAULT NULL AFTER `spocUserId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `dialerCampaignName`;"
    );
  },
};
