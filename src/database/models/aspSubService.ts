import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { Asp, SubService } from ".";

const aspSubService = sequelize.define(
  "aspSubService",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    aspId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    subServiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
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
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
    tableName: "aspSubServices",
  }
);

Asp.hasMany(aspSubService, {
  as: "subServices",
  foreignKey: "aspId",
});

aspSubService.belongsTo(SubService, {
  as: "subService",
  foreignKey: "subServiceId",
});
aspSubService.belongsTo(Asp, { as: "asp", foreignKey: "aspId" });

export default aspSubService;
