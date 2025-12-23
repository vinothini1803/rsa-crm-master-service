import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("answerTypes", {
      fields: ["name"],
      type: "unique",
      name: "answerTypes_name_unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("answerTypes", "answerTypes_name_unique");
  },
};

