import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `subServices` ADD `hasLimit` BOOLEAN NOT NULL DEFAULT FALSE AFTER `serviceId`"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `subServices` DROP `hasLimit`;"
    );
  },
};
