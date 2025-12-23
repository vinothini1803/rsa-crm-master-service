import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("dealers", {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      code: {
        type: DataTypes.STRING(60),
        unique: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      mobileNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      dealerForId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      mechanicalType: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0,
      },
      bodyPartType: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0,
      },
      rsaPersonName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      rsaPersonNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      rsaPersonAlternateNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      smName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      smNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      addressLineOne: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      addressLineTwo: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      stateId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      cityId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      area: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      pincode: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      lat: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      long: {
        type: DataTypes.STRING(60),
        allowNull: true,
      },
      walletBalance: {
        type: DataTypes.DECIMAL(12, 2).UNSIGNED,
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
    await queryInterface.dropTable("dealers");
  },
};
