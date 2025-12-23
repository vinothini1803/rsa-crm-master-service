import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSubjects` ADD `clientId` INT UNSIGNED NULL DEFAULT NULL AFTER `name`"
    );
    await queryInterface.addConstraint("caseSubjects", {
      fields: ["clientId"],
      type: "foreign key",
      name: "case_subjects_client_fk",
      references: {
        table: "clients",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "caseSubjects",
      "case_subjects_client_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE caseSubjects DROP clientId;"
    );
  },
};
