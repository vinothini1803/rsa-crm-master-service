import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `feedbackQuestions` ADD `reportColumn` VARCHAR(500) NULL DEFAULT NULL AFTER `question`;"
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `feedbackQuestions` DROP COLUMN `reportColumn`;"
    );
  },
};

