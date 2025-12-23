import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `entitlements` ADD `hasLimit` BOOLEAN NOT NULL DEFAULT FALSE AFTER `unitId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `entitlements` DROP `hasLimit`;"
    );
  },
};
