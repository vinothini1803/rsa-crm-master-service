import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `dynamicType` VARCHAR(20) NULL AFTER `cityId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `locationCapturedVia` VARCHAR(20) NULL AFTER `dynamicType`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `dynamicType`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `locationCapturedVia`;"
    );
  },
};
