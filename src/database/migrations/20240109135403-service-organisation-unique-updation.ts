import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("serviceOrganisations", {
      fields: ["name"],
      type: "unique",
      name: "serviceOrganisations_name_unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("serviceOrganisations", "serviceOrganisations_name_unique");
  },
};
