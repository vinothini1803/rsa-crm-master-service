import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `inActiveFromDate` DATE NULL AFTER `inActiveReason`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `inActiveToDate` DATE NULL AFTER `inActiveFromDate`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `inActiveFromDate`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `inActiveToDate`;"
    );
  },
};
