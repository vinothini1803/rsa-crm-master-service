import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("asps", "asps_lastAspMechanicId_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `lastAspMechanicId`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `lastAspMechanicId` INT UNSIGNED NULL DEFAULT NULL AFTER `hasMechanic`;"
    );
    await queryInterface.addConstraint("asps", {
      fields: ["lastAspMechanicId"],
      type: "foreign key",
      name: "asps_lastAspMechanicId_fk",
      references: {
        table: "aspMechanics",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },
};
