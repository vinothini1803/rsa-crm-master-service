import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` CHANGE `lastLocationUpdatedAt` `lastLocationUpdatedAt` DATETIME NULL DEFAULT NULL;"
    );
  },

  down: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
    await queryInterface.sequelize.query(
      "ALTER TABLE `ownPatrolVehicles` CHANGE `lastLocationUpdatedAt` `lastLocationUpdatedAt` DATE NULL DEFAULT NULL;"
    );
  },
};

