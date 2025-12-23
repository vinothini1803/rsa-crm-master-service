import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("subServices", {
      fields: ["name","serviceId"],
      type: "unique",
      name: "subServices_name_serviceId_unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("subServices", "subServices_name_serviceId_unique");
  },
};
