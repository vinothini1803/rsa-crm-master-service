import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("aspMechanics", {
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
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      code: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      emailId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      contactNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      alternateContactNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      businessHourId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "configs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true,
      },
      roleId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      axaptaCode: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      latitude: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      performanceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      priorityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      ownPatrolId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
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
    await queryInterface.dropTable("aspMechanics");
  },
};
