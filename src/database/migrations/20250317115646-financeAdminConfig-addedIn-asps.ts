import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `isFinanceAdmin` BOOLEAN DEFAULT 0 AFTER `hasMechanic`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `financeAdminId` INT UNSIGNED NULL DEFAULT NULL AFTER `isFinanceAdmin`;"
    );
    await queryInterface.addConstraint("asps", {
      fields: ["financeAdminId"],
      type: "foreign key",
      name: "asps_financeAdminId_fk",
      references: {
        table: "asps",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `isFinanceAdmin`;"
    );

    await queryInterface.removeConstraint("asps", "asps_financeAdminId_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `financeAdminId`;"
    );
  },
};
