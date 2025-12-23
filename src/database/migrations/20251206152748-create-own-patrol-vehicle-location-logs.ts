import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ownPatrolVehicleLocationLogs", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      vehicleId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      attendanceLogId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      longitude: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      capturedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addConstraint("ownPatrolVehicleLocationLogs", {
      fields: ["vehicleId"],
      type: "foreign key",
      name: "ownPatrolVehicleLocationLogs_vehicleId_fk",
      references: {
        table: "ownPatrolVehicles",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint(
      "ownPatrolVehicleLocationLogs",
      "ownPatrolVehicleLocationLogs_vehicleId_fk"
    );
    await queryInterface.dropTable("ownPatrolVehicleLocationLogs");
  },
};

