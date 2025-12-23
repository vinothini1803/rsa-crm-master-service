import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD parentId INT UNSIGNED NULL DEFAULT NULL AFTER id"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD clientId INT UNSIGNED NULL DEFAULT NULL AFTER email"
    );
    await queryInterface.addConstraint("dealers", {
      fields: ["parentId"],
      type: "foreign key",
      name: "dealers_parent_fk",
      references: {
        table: "dealers",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addConstraint("dealers", {
      fields: ["clientId"],
      type: "foreign key",
      name: "dealers_client_fk",
      references: {
        table: "clients",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint("dealers", "dealers_parent_fk");
    await queryInterface.removeConstraint("dealers", "dealers_client_fk");
    await queryInterface.sequelize.query("ALTER TABLE dealers DROP parentId;");
    await queryInterface.sequelize.query("ALTER TABLE dealers DROP clientId;");
  },
};
