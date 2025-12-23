import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ownPatrolVehicleTechnicianLogs", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      ownPatrolVehicleId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "ownPatrolVehicles",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      aspMechanicId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "aspMechanics",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addConstraint("ownPatrolVehicleTechnicianLogs", {
      fields: ["ownPatrolVehicleId", "aspMechanicId"],
      type: "unique",
      name: "ownPatrolVehicleTechnicianLogs_uk",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("ownPatrolVehicleTechnicianLogs");
  },
};
