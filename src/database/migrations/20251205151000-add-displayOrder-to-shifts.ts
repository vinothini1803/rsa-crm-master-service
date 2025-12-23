import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
        await queryInterface.sequelize.query(
            "ALTER TABLE `shifts` ADD `displayOrder` INT NULL DEFAULT NULL AFTER `typeId`;"
        );
    },

    async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
        await queryInterface.sequelize.query(
            "ALTER TABLE `shifts` DROP COLUMN `displayOrder`;"
        );
    },
};

