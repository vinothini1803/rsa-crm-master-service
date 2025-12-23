import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `tier`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `tierId` INT UNSIGNED NULL DEFAULT NULL AFTER `id`;"
    );
    await queryInterface.addConstraint("asps", {
      fields: ["tierId"],
      type: "foreign key",
      name: "asps_tier_id_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("asps", "asps_tier_id_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `tierId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `tier` VARCHAR(20) NULL AFTER `id`;"
    );
  },
};
