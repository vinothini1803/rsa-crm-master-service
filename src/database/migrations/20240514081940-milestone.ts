import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("milestones", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      }, 
      milestoneName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      remainder: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      toolTipValue: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      prevMilestoneId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "milestones",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: true,
      },
      caseStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "caseStatuses",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        allowNull: true,
      },
      activityStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "activityStatuses",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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
    await queryInterface.dropTable("milestones");
  },
};
