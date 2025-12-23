import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ownPatrolVehicleNewTechnicians", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      aspId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "asps",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false,
      },
      aspMechanicId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "aspMechanics",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: false,
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

    await queryInterface.addConstraint("ownPatrolVehicleNewTechnicians", {
      fields: ["aspId", "aspMechanicId"],
      type: "unique",
      name: "ownPatrolVehicleNewTechnicians_uk",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("ownPatrolVehicleNewTechnicians");
  },
};
