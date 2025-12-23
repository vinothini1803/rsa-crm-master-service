import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint(
      "clients",
      "clients_call_center_id_fk"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` DROP COLUMN `callCenterId`;"
    );

    await queryInterface.createTable("clientCallCenters", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "clients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      callCenterId: {
        type: DataTypes.INTEGER.UNSIGNED,
        references: {
          model: "callCenters",
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

    await queryInterface.addConstraint("clientCallCenters", {
      fields: ["clientId", "callCenterId"],
      type: "unique",
      name: "clientCallCenters_uk",
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("clientCallCenters");

    await queryInterface.sequelize.query(
      "ALTER TABLE `clients` ADD `callCenterId` INT UNSIGNED NULL AFTER `tollFreeNumber`;"
    );

    await queryInterface.addConstraint("clients", {
      fields: ["callCenterId"],
      type: "foreign key",
      name: "clients_call_center_id_fk",
      references: {
        table: "callCenters",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },
};
