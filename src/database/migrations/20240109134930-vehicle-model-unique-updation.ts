import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("vehicleModels", {
      fields: ["name","vehicleMakeId"],
      type: "unique",
      name: "vehicleModels_name_vehicleMakeId_unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("vehicleModels", "vehicleModels_name_vehicleMakeId_unique");
  },
};
