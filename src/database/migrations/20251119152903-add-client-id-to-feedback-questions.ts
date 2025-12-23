import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `feedbackQuestions` ADD `clientId` INT UNSIGNED NULL DEFAULT NULL AFTER `id`;"
    );
    await queryInterface.addConstraint("feedbackQuestions", {
      fields: ["clientId"],
      type: "foreign key",
      name: "feedbackQuestions_clientId_fk",
      references: {
        table: "clients",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint("feedbackQuestions", "feedbackQuestions_clientId_fk");
    await queryInterface.sequelize.query(
      "ALTER TABLE `feedbackQuestions` DROP COLUMN `clientId`;"
    );
  },
};

