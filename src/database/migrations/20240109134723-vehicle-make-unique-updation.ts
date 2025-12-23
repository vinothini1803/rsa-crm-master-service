import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("vehicleMakes", {
      fields: ["name"],
      type: "unique",
      name: "vehicleMakes_name_unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("vehicleMakes", "vehicleMakes_name_unique");
  },
};
