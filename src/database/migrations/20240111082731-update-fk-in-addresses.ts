import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("addresses", "addresses_ibfk_1");

    await queryInterface.addConstraint("addresses", {
      fields: ["addressTypeId"],
      type: "foreign key",
      name: "addresses_address_type_id_fk",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "addresses",
      "addresses_address_type_id_fk"
    );

    await queryInterface.addConstraint("addresses", {
      fields: ["addressTypeId"],
      type: "foreign key",
      name: "addresses_ibfk_1",
      references: {
        table: "configTypes",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },
};
