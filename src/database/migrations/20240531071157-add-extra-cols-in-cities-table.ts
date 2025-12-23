import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `talukId` INT UNSIGNED NULL DEFAULT NULL AFTER `name`;"
    );
    await queryInterface.addConstraint("cities", {
      fields: ["talukId"],
      type: "foreign key",
      name: "cities_talukId_fk",
      references: {
        table: "taluks",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `districtId` INT UNSIGNED NULL DEFAULT NULL AFTER `talukId`;"
    );
    await queryInterface.addConstraint("cities", {
      fields: ["districtId"],
      type: "foreign key",
      name: "cities_districtId_fk",
      references: {
        table: "districts",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `pincode` VARCHAR(10) NULL AFTER `districtId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `latitude` VARCHAR(100) NULL AFTER `pincode`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `longitude` VARCHAR(100) NULL AFTER `latitude`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `locationTypeId` INT UNSIGNED NULL DEFAULT NULL AFTER `longitude`;"
    );
    await queryInterface.addConstraint("cities", {
      fields: ["locationTypeId"],
      type: "foreign key",
      name: "cities_locationTypeId_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `municipalLimitId` INT UNSIGNED NULL DEFAULT NULL AFTER `locationTypeId`;"
    );
    await queryInterface.addConstraint("cities", {
      fields: ["municipalLimitId"],
      type: "foreign key",
      name: "cities_municipalLimitId_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `nearestCityId` INT UNSIGNED NULL DEFAULT NULL AFTER `municipalLimitId`;"
    );
    await queryInterface.addConstraint("cities", {
      fields: ["nearestCityId"],
      type: "foreign key",
      name: "cities_nearestCityId_fk",
      references: {
        table: "nearestCities",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `locationCategoryId` INT UNSIGNED NULL DEFAULT NULL AFTER `nearestCityId`;"
    );
    await queryInterface.addConstraint("cities", {
      fields: ["locationCategoryId"],
      type: "foreign key",
      name: "cities_locationCategoryId_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("cities", "cities_talukId_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `talukId`;"
    );

    await queryInterface.removeConstraint("cities", "cities_districtId_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `districtId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `pincode`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `latitude`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `longitude`;"
    );

    await queryInterface.removeConstraint("cities", "cities_locationTypeId_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `locationTypeId`;"
    );

    await queryInterface.removeConstraint(
      "cities",
      "cities_municipalLimitId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `municipalLimitId`;"
    );

    await queryInterface.removeConstraint("cities", "cities_nearestCityId_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `nearestCityId`;"
    );

    await queryInterface.removeConstraint(
      "cities",
      "cities_locationCategoryId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP COLUMN `locationCategoryId`;"
    );
  },
};
