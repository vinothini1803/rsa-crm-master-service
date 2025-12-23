import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        // First, add aspId column to the table
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicleLocationLogs` ADD `aspId` INT UNSIGNED NULL DEFAULT NULL AFTER `id`;"
        );

        // Migrate data: get aspId from vehicleId
        await queryInterface.sequelize.query(`
            UPDATE ownPatrolVehicleLocationLogs l
            INNER JOIN ownPatrolVehicles v ON l.vehicleId = v.id
            SET l.aspId = v.aspId
            WHERE v.aspId IS NOT NULL;
        `);

        // Remove the foreign key constraint
        await queryInterface.removeConstraint(
            "ownPatrolVehicleLocationLogs",
            "ownPatrolVehicleLocationLogs_vehicleId_fk"
        );

        // Drop vehicleId column
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicleLocationLogs` DROP COLUMN `vehicleId`;"
        );

        // Make aspId NOT NULL after data migration
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicleLocationLogs` MODIFY `aspId` INT UNSIGNED NOT NULL;"
        );

        // Rename the table
        await queryInterface.renameTable(
            "ownPatrolVehicleLocationLogs",
            "aspLocationLogs"
        );

        // Add foreign key constraint to asps table
        await queryInterface.addConstraint("aspLocationLogs", {
            fields: ["aspId"],
            type: "foreign key",
            name: "aspLocationLogs_aspId_fk",
            references: {
                table: "asps",
                field: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        });
    },

    down: async (queryInterface: QueryInterface, Sequelize: typeof DataTypes) => {
        // Remove foreign key constraint
        await queryInterface.removeConstraint(
            "aspLocationLogs",
            "aspLocationLogs_aspId_fk"
        );

        // Rename table back
        await queryInterface.renameTable(
            "aspLocationLogs",
            "ownPatrolVehicleLocationLogs"
        );

        // Add vehicleId column back
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicleLocationLogs` ADD `vehicleId` INT UNSIGNED NULL DEFAULT NULL AFTER `id`;"
        );

        // Migrate data back: get vehicleId from aspId (this might not be perfect if multiple vehicles per ASP)
        await queryInterface.sequelize.query(`
            UPDATE ownPatrolVehicleLocationLogs l
            INNER JOIN ownPatrolVehicles v ON l.aspId = v.aspId AND v.deletedAt IS NULL
            SET l.vehicleId = v.id
            WHERE l.vehicleId IS NULL
            LIMIT 1;
        `);

        // Make vehicleId NOT NULL
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicleLocationLogs` MODIFY `vehicleId` INT UNSIGNED NOT NULL;"
        );

        // Add foreign key constraint back
        await queryInterface.addConstraint("ownPatrolVehicleLocationLogs", {
            fields: ["vehicleId"],
            type: "foreign key",
            name: "ownPatrolVehicleLocationLogs_vehicleId_fk",
            references: {
                table: "ownPatrolVehicles",
                field: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        });

        // Drop aspId column
        await queryInterface.sequelize.query(
            "ALTER TABLE `ownPatrolVehicleLocationLogs` DROP COLUMN `aspId`;"
        );
    },
};

