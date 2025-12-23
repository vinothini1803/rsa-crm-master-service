import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "aspMechanics",
      "aspmechanics_ibfk_1"
    );

    await queryInterface.addConstraint("aspMechanics", {
      fields: ["aspId"],
      type: "foreign key",
      name: "aspmechanics_ibfk_1",
      references: {
        table: "asps",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "aspMechanics",
      "aspmechanics_ibfk_1"
    );
    await queryInterface.addConstraint("aspMechanics", {
      fields: ["aspId"],
      type: "foreign key",
      name: "aspmechanics_ibfk_1",
      references: {
        table: "asps",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
};
