import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("aspMechanicSubServices", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
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
        allowNull: true,
      },
      subServiceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "subServices",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addConstraint("aspMechanicSubServices", {
      fields: ["aspMechanicId", "subServiceId"],
      type: "unique",
      name: "aspMechanicSubServices_unique",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("aspMechanicSubServices");
  },
};
