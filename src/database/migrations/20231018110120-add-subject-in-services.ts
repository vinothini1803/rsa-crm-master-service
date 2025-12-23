import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `services` ADD `subjectId` INT UNSIGNED NULL DEFAULT NULL AFTER `name`"
    );
    await queryInterface.addConstraint("services", {
      fields: ["subjectId"],
      type: "foreign key",
      name: "services_subject_fk",
      references: {
        table: "caseSubjects",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.sequelize.query(
      "ALTER TABLE `services` DROP INDEX `name`, ADD UNIQUE `services_uk` (`name`, `subjectId`);"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `services` DROP INDEX `services_uk`, ADD UNIQUE `name` (`name`);"
    );
    await queryInterface.removeConstraint("services", "services_subject_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE services DROP subjectId;"
    );
  },
};
