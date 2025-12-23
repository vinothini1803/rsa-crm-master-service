import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE asps ADD COLUMN workshopName VARCHAR(255) NULL AFTER name;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE asps DROP COLUMN workshopName;"
    );
  },
};
