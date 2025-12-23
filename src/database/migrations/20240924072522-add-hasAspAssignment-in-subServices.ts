import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `subServices` ADD `hasAspAssignment` BOOLEAN NOT NULL DEFAULT 1 COMMENT '1-yes, 0-no'  AFTER `serviceId`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `subServices` DROP `hasAspAssignment`"
    );
  },
};
