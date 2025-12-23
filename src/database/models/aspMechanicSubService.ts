import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { AspMechanic, SubService } from "./index";

const aspMechanicSubService = sequelize.define(
  "aspMechanicSubService",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    aspMechanicId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    subServiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
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
  }
);

//Relationships ---------------------------------

aspMechanicSubService.belongsTo(SubService, {
  foreignKey: "subServiceId",
  as: "subService",
});

AspMechanic.hasMany(aspMechanicSubService, {
  foreignKey: "aspMechanicId",
  as: "aspMechanicSubServices",
});
export default aspMechanicSubService;
