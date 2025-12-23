import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `dynamicType`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `locationCapturedVia`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `aspTypeId` INT UNSIGNED NULL DEFAULT NULL AFTER `id`;"
    );
    await queryInterface.addConstraint("aspMechanics", {
      fields: ["aspTypeId"],
      type: "foreign key",
      name: "aspMechanics_aspTypeId_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `locationCapturedViaId` INT UNSIGNED NULL DEFAULT NULL AFTER `cityId`;"
    );
    await queryInterface.addConstraint("aspMechanics", {
      fields: ["locationCapturedViaId"],
      type: "foreign key",
      name: "aspMechanics_locationCapturedViaId_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `dynamicTypeId` INT UNSIGNED NULL DEFAULT NULL AFTER `locationCapturedViaId`;"
    );
    await queryInterface.addConstraint("aspMechanics", {
      fields: ["dynamicTypeId"],
      type: "foreign key",
      name: "aspMechanics_dynamicTypeId_fk",
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
      "ALTER TABLE `aspMechanics` ADD `dynamicType` VARCHAR(20) NULL AFTER `cityId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` ADD `locationCapturedVia` VARCHAR(20) NULL AFTER `dynamicType`;"
    );

    await queryInterface.removeConstraint(
      "aspMechanics",
      "aspMechanics_aspTypeId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `aspTypeId`;"
    );

    await queryInterface.removeConstraint(
      "aspMechanics",
      "aspMechanics_locationCapturedViaId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `locationCapturedViaId`;"
    );

    await queryInterface.removeConstraint(
      "aspMechanics",
      "aspMechanics_dynamicTypeId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `aspMechanics` DROP COLUMN `dynamicTypeId`;"
    );
  },
};
