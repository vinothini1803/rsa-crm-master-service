import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `ownPatrolId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `isOwnPatrol` BOOLEAN NULL AFTER `priorityId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `rmId` INT UNSIGNED NULL DEFAULT NULL AFTER `isOwnPatrol`;"
    );
    await queryInterface.addConstraint("asps", {
      fields: ["code"],
      type: "unique",
      name: "code",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` ADD `ownPatrolId` INT UNSIGNED NULL DEFAULT NULL AFTER `priorityId`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `isOwnPatrol`;"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `asps` DROP COLUMN `rmId`;"
    );
    await queryInterface.removeConstraint("asps", "code");
  },
};
