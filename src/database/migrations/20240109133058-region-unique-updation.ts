import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("regions", {
      fields: ["name", "stateId"],
      type: "unique",
      name: "regions_name_stateId_unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("regions", "regions_name_stateId_unique");
  },
};
