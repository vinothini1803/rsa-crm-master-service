import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("nspFilters", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      typeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "configs",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(191),
        allowNull: false,
      },
      limitQuery: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      havingQuery: {
        type: DataTypes.TEXT,
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

    // Add unique constraint
    await queryInterface.addConstraint("nspFilters", {
      type: "unique",
      fields: ["typeId", "name"],
      name: "nspFilters_uk",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("nspFilters");
  },
};
