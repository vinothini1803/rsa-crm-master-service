import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `nearestCities` ADD `locationCategoryId` INT UNSIGNED NULL DEFAULT NULL AFTER `name`;"
    );
    await queryInterface.addConstraint("nearestCities", {
      fields: ["locationCategoryId"],
      type: "foreign key",
      name: "nearestCities_locationCategoryId_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "nearestCities",
      "nearestCities_locationCategoryId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `nearestCities` DROP COLUMN `locationCategoryId`;"
    );
  },
};
