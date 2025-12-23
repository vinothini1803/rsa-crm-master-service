import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `states` ADD `googleMapCode` VARCHAR(20) NULL AFTER `code`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `states` DROP `googleMapCode`"
    );
  },
};
