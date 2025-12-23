import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `invoiceName` VARCHAR(191) NULL AFTER `name`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `businessCategoryId` INT UNSIGNED NULL AFTER `invoiceName`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `legalName` VARCHAR(191) NULL AFTER `businessCategoryId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `tradeName` VARCHAR(191) NULL AFTER `legalName`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `axaptaCode` VARCHAR(60) NULL AFTER `tradeName`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `financialDimension` VARCHAR(191) NULL AFTER `axaptaCode`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `gstin` VARCHAR(60) NULL AFTER `financialDimension`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `tollFreeNumber` VARCHAR(20) NULL AFTER `gstin`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `callCenterId` INT UNSIGNED NULL AFTER `tollFreeNumber`;"
    );

    await queryInterface.addConstraint("clients", {
      fields: ["businessCategoryId"],
      type: "foreign key",
      name: "clients_business_category_id_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addConstraint("clients", {
      fields: ["callCenterId"],
      type: "foreign key",
      name: "clients_call_center_id_fk",
      references: {
        table: "callCenters",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
    await queryInterface.removeConstraint(
      "clients",
      "clients_business_category_id_fk"
    );
    await queryInterface.removeConstraint(
      "clients",
      "clients_call_center_id_fk"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `invoiceName`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `businessCategoryId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `legalName`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `tradeName`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `axaptaCode`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `financialDimension`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `gstin`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `tollFreeNumber`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `callCenterId`;"
    );
  },
};
