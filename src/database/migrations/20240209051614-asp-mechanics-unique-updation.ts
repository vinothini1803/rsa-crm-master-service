import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("aspMechanics", {
      fields: ["aspid", "code"],
      type: "unique",
      name: "aspMechanics_aspId_code_unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "aspMechanics",
      "aspMechanics_aspId_code_unique"
    );
  },
};
