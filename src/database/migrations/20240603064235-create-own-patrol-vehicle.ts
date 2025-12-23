import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ownPatrolVehicles", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      vehicleRegistrationNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true,
      },
      vehicleTypeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      aspId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "asps",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true,
      },
      gpsDeviceId: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      serviceOrganisationId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      lastLatitude: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      lastLongitude: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      lastGpsCaptured: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      createdById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      updatedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      deletedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
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
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("ownPatrolVehicles");
  },
};
