import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("dealers", "dealers_parent_fk");
    await queryInterface.sequelize.query("ALTER TABLE dealers DROP parentId;");
    await queryInterface.sequelize.query(
      "ALTER TABLE `dealers` ADD `groupCode` VARCHAR(60) NULL AFTER `id`"
    );
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE dealers ADD parentId INT UNSIGNED NULL DEFAULT NULL AFTER id"
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
    await queryInterface.sequelize.query("ALTER TABLE dealers DROP groupCode;");
  },
};
