import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
        await queryInterface.sequelize.query(
            "ALTER TABLE `caseSubjects` ADD `caseTypeId` INT UNSIGNED NULL DEFAULT NULL AFTER `clientId`;"
        );
        await queryInterface.addConstraint("caseSubjects", {
            fields: ["caseTypeId"],
            type: "foreign key",
            name: "caseSubjects_caseTypeId_fk",
            references: {
                table: "configs",
                field: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        });
    },

    async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
        await queryInterface.removeConstraint(
            "caseSubjects",
            "caseSubjects_caseTypeId_fk"
        );
        await queryInterface.sequelize.query(
            "ALTER TABLE `caseSubjects` DROP COLUMN `caseTypeId`;"
        );
    },
};

