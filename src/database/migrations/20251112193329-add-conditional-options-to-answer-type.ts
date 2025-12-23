import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Add conditionalOptions column after options column using raw SQL
    await queryInterface.sequelize.query(`
      ALTER TABLE answerTypes 
      ADD COLUMN conditionalOptions TEXT NULL 
      COMMENT 'JSON array of option values that trigger the text field for option_conditional type'
      AFTER options
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("answerTypes", "conditionalOptions");
  },
};

