import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("clients", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      contactNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      socialTypeID: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      accountCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      accountTypeID: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      customerTollFreeNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      asmTollFreeNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      nmTollFreeNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      fhTollFreeNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      displayName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      displayOptionID: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      aspTollFreeNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      rmTollFreeNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      didNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      serviceContractID: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      parentAccountID: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
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
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("clients");
  },
};
