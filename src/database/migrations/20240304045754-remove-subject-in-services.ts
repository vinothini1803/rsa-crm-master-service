import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
      await queryInterface.removeConstraint("services", "services_uk");
      await queryInterface.removeConstraint("services", "services_subject_fk");
      await queryInterface.sequelize.query(
        "ALTER TABLE services DROP COLUMN subjectId;"
      );

      await queryInterface.addConstraint("services", {
        fields: ["name"],
        type: "unique",
        name: "services_name_uk",
      });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
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

      await queryInterface.addConstraint("services", {
        fields: ["name","subjectId"],
        type: "unique",
        name: "services_uk",
      });

      await queryInterface.removeConstraint("services", "services_name_uk");
  },
};
