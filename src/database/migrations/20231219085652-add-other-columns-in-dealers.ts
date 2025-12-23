import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD COLUMN legalName VARCHAR(255) NULL AFTER `name`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD COLUMN tradeName VARCHAR(255) NULL AFTER `legalName`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD COLUMN gstin VARCHAR(64) NULL AFTER `email`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD COLUMN pan VARCHAR(64) NULL AFTER `gstin`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD COLUMN cin VARCHAR(64) NULL AFTER `pan`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD typeId INT UNSIGNED NULL DEFAULT NULL AFTER `cin`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `dealers` ADD `isExclusive` BOOLEAN NULL DEFAULT FALSE AFTER `typeId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD COLUMN smAlternateNumber VARCHAR(20) NULL AFTER `smNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD COLUMN oemAsmName VARCHAR(255) NULL AFTER `smAlternateNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD COLUMN oemAsmNumber VARCHAR(20) NULL AFTER `oemAsmName`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD COLUMN oemAsmAlternateNumber VARCHAR(20) NULL AFTER `oemAsmNumber`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD serviceRmId INT UNSIGNED NULL DEFAULT NULL AFTER `long`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD salesRmId INT UNSIGNED NULL DEFAULT NULL AFTER `serviceRmId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD zoneId INT UNSIGNED NULL DEFAULT NULL AFTER `salesRmId`;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP COLUMN legalName;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP COLUMN tradeName;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP COLUMN gstin;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP COLUMN pan;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP COLUMN cin;"
    );
    await queryInterface.sequelize.query("ALTER TABLE dealers DROP typeId;");
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP isExclusive;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP smAlternateNumber;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP oemAsmName;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP oemAsmNumber;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP oemAsmAlternateNumber;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers DROP serviceRmId;"
    );
    await queryInterface.sequelize.query("ALTER TABLE dealers DROP salesRmId;");
    await queryInterface.sequelize.query("ALTER TABLE dealers DROP zoneId;");
  },
};
