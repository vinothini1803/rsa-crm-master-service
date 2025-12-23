import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("dispositions", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
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
    await queryInterface.addConstraint("dispositions", {
      fields: ["name", "typeId"],
      type: "unique",
      name: "unique_name_typeId",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("dispositions");
  },
};
