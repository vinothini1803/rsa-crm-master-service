import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `serviceOrganisationId` INT(10) UNSIGNED NULL AFTER `stateId`;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` ADD `regionId` INT(10) UNSIGNED NULL AFTER `serviceOrganisationId`;"
    );

    await queryInterface.addConstraint("cities", {
      fields: ["serviceOrganisationId"],
      type: "foreign key",
      name: "cities_serviceOrganisationId_fk",
      references: {
          table: "serviceOrganisations",
          field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
    
    await queryInterface.addConstraint("cities", {
      fields: ["regionId"],
      type: "foreign key",
      name: "cities_regionId_fk",
      references: {
          table: "regions",
          field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeConstraint(
        "cities",
        "cities_serviceOrganisationId_fk"
    );
    await queryInterface.removeConstraint(
      "cities",
      "cities_regionId_fk"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP serviceOrganisationId;"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `cities` DROP regionId;"
    );
  },
};
