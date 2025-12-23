import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.addConstraint("slaSettings", {
      fields: ["caseTypeId", "typeId", "locationTypeId"],
      type: "unique",
      name: "slaSettings_unique",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint("slaSettings", "slaSettings_ibfk_1");
    await queryInterface.removeConstraint("slaSettings", "slaSettings_ibfk_2");
    await queryInterface.removeConstraint("slaSettings", "slaSettings_unique");

    await queryInterface.addConstraint("slaSettings", {
      fields: ["caseTypeId"],
      type: "foreign key",
      name: "slaSettings_ibfk_1",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addConstraint("slaSettings", {
      fields: ["typeId"],
      type: "foreign key",
      name: "slaSettings_ibfk_2",
      references: {
        table: "configs",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },
};
