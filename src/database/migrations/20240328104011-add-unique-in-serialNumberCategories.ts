import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("serialNumberCategories", {
      fields: ["name", "shortName"],
      type: "unique",
      name: "serialNumberCategories_uk",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "serialNumberCategories",
      "serialNumberCategories_uk"
    );
  },
};
