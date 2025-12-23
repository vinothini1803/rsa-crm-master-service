import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `vehicleMakeId` INT UNSIGNED NULL DEFAULT NULL AFTER `vehicleTypeId`;"
    );
    await queryInterface.addConstraint("ownPatrolVehicles", {
      fields: ["vehicleMakeId"],
      type: "foreign key",
      name: "ownPatrolVehicles_vehicleMakeId_fk",
      references: {
        table: "vehicleMakes",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` ADD `vehicleModelId` INT UNSIGNED NULL DEFAULT NULL AFTER `vehicleMakeId`;"
    );
    await queryInterface.addConstraint("ownPatrolVehicles", {
      fields: ["vehicleModelId"],
      type: "foreign key",
      name: "ownPatrolVehicles_vehicleModelId_fk",
      references: {
        table: "vehicleModels",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "ownPatrolVehicles",
      "ownPatrolVehicles_vehicleMakeId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `vehicleMakeId`;"
    );

    await queryInterface.removeConstraint(
      "ownPatrolVehicles",
      "ownPatrolVehicles_vehicleModelId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` DROP COLUMN `vehicleModelId`;"
    );
  },
};
