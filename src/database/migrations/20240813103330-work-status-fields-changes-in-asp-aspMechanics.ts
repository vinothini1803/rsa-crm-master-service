import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("asps", "asps_ibfk_6");
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `workStatusId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `workStatusId` INT UNSIGNED NULL DEFAULT NULL AFTER `dynamicTypeId`;"
    );
    await queryInterface.addConstraint("aspMechanics", {
      fields: ["workStatusId"],
      type: "foreign key",
      name: "aspMechanics_workStatusId_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `workStatusId` INT UNSIGNED NULL DEFAULT NULL AFTER `pincode`;"
    );
    await queryInterface.addConstraint("asps", {
      fields: ["workStatusId"],
      type: "foreign key",
      name: "asps_ibfk_6",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.removeConstraint(
      "aspMechanics",
      "aspMechanics_workStatusId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `workStatusId`;"
    );
  },
};
