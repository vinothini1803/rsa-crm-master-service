import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `clientServices` DROP `membershipTypeName`;"
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `clientServices` ADD `membershipTypeName` VARCHAR(255) NULL AFTER `membershipTypeId`;"
    );
  },
};