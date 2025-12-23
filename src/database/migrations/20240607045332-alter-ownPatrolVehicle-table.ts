import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("ownPatrolVehicles", {
      fields: ["vehicleTypeId"],
      type: "foreign key",
      name: "ownPatrolVehicles_vehicleTypeId_fk",
      references: {
        table: "vehicleTypes",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` CHANGE `gpsDeviceId` `gpsDeviceId` VARCHAR(191) NULL DEFAULT NULL;"
    );

    await queryInterface.addConstraint("ownPatrolVehicles", {
      fields: ["serviceOrganisationId"],
      type: "foreign key",
      name: "ownPatrolVehicles_serviceOrganisationId_fk",
      references: {
        table: "serviceOrganisations",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` CHANGE `lastGpsCaptured` `lastGpsCaptured` VARCHAR(191) NULL DEFAULT NULL;"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "ownPatrolVehicles",
      "ownPatrolVehicles_vehicleTypeId_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` CHANGE `gpsDeviceId` `gpsDeviceId` VARCHAR(60) NULL DEFAULT NULL;"
    );

    await queryInterface.removeConstraint(
      "ownPatrolVehicles",
      "ownPatrolVehicles_serviceOrganisationId_fk"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` CHANGE `lastGpsCaptured` `lastGpsCaptured` VARCHAR(60) NULL DEFAULT NULL;"
    );
  },
};
