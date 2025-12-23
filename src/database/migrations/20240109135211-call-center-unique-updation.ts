import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("callCenters", {
      fields: ["name"],
      type: "unique",
      name: "callCenters_name_unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("callCenters", "callCenters_name_unique");
  },
};
