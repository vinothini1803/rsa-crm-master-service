import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `slaViolateReasons` DROP COLUMN `activityStatusId`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `slaViolateReasons` ADD `activityStatusId` TINYINT(4) NOT NULL AFTER `name`;"
    );
  },
};
