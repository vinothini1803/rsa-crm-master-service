import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `email` VARCHAR(255) NULL AFTER `workshopName`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `email`;"
    );
  },
};
