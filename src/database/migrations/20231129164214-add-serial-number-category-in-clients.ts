import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.sequelize.query(
      "ALTER TABLE clients ADD deliveryRequestSerialNumberCategoryId INT UNSIGNED NULL DEFAULT NULL AFTER parentAccountID"
    );
    await queryInterface.addConstraint("clients", {
      fields: ["deliveryRequestSerialNumberCategoryId"],
      type: "foreign key",
      name: "clients_delivery_request_serial_number_cat_fk",
      references: {
        table: "serialNumberCategories",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
    await queryInterface.removeConstraint(
      "clients",
      "clients_delivery_request_serial_number_cat_fk"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE clients DROP deliveryRequestSerialNumberCategoryId;"
    );
  },
};
