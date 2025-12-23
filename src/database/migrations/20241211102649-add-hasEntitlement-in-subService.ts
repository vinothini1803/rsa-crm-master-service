import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `subServices` ADD `hasEntitlement` BOOLEAN NOT NULL DEFAULT 0 COMMENT '1-yes, 0-no'  AFTER `hasLimit`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `subServices` DROP `hasEntitlement`"
    );
  },
};
