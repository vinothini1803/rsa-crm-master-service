import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `inActiveReason` TEXT NULL AFTER `lastGpsCaptured`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `inActiveReason`;"
    );
  },
};
