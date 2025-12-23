import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `cityId` INT UNSIGNED NULL DEFAULT NULL AFTER `address`;"
    );
    await queryInterface.addConstraint("aspMechanics", {
      fields: ["cityId"],
      type: "foreign key",
      name: "aspMechanics_cityId_fk",
      references: {
        table: "cities",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "aspMechanics",
      "aspMechanics_cityId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `cityId`;"
    );
  },
};
