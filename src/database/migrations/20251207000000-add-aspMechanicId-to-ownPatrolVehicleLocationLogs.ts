import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicleLocationLogs` ADD `aspMechanicId` INT UNSIGNED NULL DEFAULT NULL AFTER `attendanceLogId`;"
    );
    await queryInterface.addConstraint("ownPatrolVehicleLocationLogs", {
      fields: ["aspMechanicId"],
      type: "foreign key",
      name: "ownPatrolVehicleLocationLogs_aspMechanicId_fk",
      references: {
        table: "aspMechanics",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint("ownPatrolVehicleLocationLogs", "ownPatrolVehicleLocationLogs_aspMechanicId_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicleLocationLogs` DROP COLUMN `aspMechanicId`;"
    );
  },
};

