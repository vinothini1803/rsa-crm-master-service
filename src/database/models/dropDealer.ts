import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Dealer } from ".";

const dropDealer = sequelize.define(
  "dropDealer",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    dealerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    dropDealerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "dropDealers",
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
  }
);

//Relationships ---------------------------------

dropDealer.belongsTo(Dealer, {
  as: "dealer",
  foreignKey: "dealerId",
});

dropDealer.belongsTo(Dealer, {
  as: "dropDealer",
  foreignKey: "dropDealerId",
});

Dealer.hasMany(dropDealer, {
  as: "dropDealers",
  foreignKey: "dealerId",
});

export default dropDealer;
