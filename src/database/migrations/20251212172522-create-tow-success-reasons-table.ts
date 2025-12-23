import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    async up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
        await queryInterface.createTable("towSuccessReasons", {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING,
                unique: true,
                allowNull: false,
            },
            createdById: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
            },
            updatedById: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
            },
            deletedById: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            deletedAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        });

        await queryInterface.addIndex("towSuccessReasons", ["name"], {
            unique: true,
            name: "towSuccessReasons_name_unique",
        });
    },

    async down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
        await queryInterface.dropTable("towSuccessReasons");
    },
};

