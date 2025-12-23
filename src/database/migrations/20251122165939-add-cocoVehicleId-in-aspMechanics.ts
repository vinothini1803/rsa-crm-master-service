import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `cocoVehicleId` INT UNSIGNED NULL DEFAULT NULL AFTER `workStatusId`;"
    );
    await queryInterface.addConstraint("aspMechanics", {
      fields: ["cocoVehicleId"],
      type: "foreign key",
      name: "aspMechanics_cocoVehicleId_fk",
      references: {
        table: "ownPatrolVehicles",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "aspMechanics",
      "aspMechanics_cocoVehicleId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `cocoVehicleId`;"
    );
  },
};

