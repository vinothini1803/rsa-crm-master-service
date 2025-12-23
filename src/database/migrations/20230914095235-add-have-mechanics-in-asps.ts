import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE asps ADD COLUMN hasMechanic BOOLEAN NULL DEFAULT 0 AFTER workStatusId;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE asps DROP COLUMN hasMechanic;"
    );
  },
};
