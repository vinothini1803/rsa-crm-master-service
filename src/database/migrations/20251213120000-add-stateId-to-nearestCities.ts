import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `nearestCities` ADD `stateId` INT UNSIGNED NULL DEFAULT NULL AFTER `locationCategoryId`;"
    );
    await queryInterface.addConstraint("nearestCities", {
      fields: ["stateId"],
      type: "foreign key",
      name: "nearestCities_stateId_fk",
      references: {
        table: "states",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "nearestCities",
      "nearestCities_stateId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `nearestCities` DROP COLUMN `stateId`;"
    );
  },
};
