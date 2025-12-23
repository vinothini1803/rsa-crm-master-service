import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSubjects` DROP INDEX `name`;"
    );
    await queryInterface.addConstraint("caseSubjects", {
      fields: ["name", "clientId"],
      type: "unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `caseSubjects` DROP INDEX `caseSubjects_name_clientId_uk`;"
    );
    await queryInterface.addConstraint("caseSubjects", {
      fields: ["name"],
      type: "unique",
      name: "name",
    });
  },
};
