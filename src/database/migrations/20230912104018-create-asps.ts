import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("asps", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      tier: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      axaptaCode: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      salutationId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "configs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true,
      },
      workingHourId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "configs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true,
      },
      code: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      whatsAppNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      contactNumber: {
        type: DataTypes.STRING(20),
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
      rmName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      rmContactNumber: {
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
      latitude: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      addressLineOne: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      addressLineTwo: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      stateId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "states",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true,
      },
      cityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "cities",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      pincode: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      workStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "configs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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
        allowNull: true,
        type: DataTypes.DATE,
      },
      updatedAt: {
        allowNull: true,
        type: DataTypes.DATE,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("asps");
  },
};
