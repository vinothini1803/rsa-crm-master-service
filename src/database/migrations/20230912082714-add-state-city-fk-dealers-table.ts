import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addConstraint("dealers", {
      fields: ["stateId"],
      type: "foreign key",
      name: "dealers_state_fk",
      references: {
        table: "states",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    await queryInterface.addConstraint("dealers", {
      fields: ["cityId"],
      type: "foreign key",
      name: "dealers_city_fk",
      references: {
        table: "cities",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint("dealers", "dealers_state_fk");
    await queryInterface.removeConstraint("dealers", "dealers_city_fk");
  },
};
