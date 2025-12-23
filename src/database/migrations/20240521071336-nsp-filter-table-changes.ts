import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `nspFilters` ADD `kmLimit` DECIMAL(10,2) UNSIGNED NULL DEFAULT NULL AFTER `havingQuery`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `nspFilters` ADD `displayOrder` INT UNSIGNED NULL DEFAULT NULL AFTER `kmLimit`"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `nspFilters` DROP `kmLimit`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `nspFilters` DROP `displayOrder`;"
    );
  },
};
