import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { SubService } from ".";

const subServiceEntitlement = sequelize.define(
  "subServiceEntitlement",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    subServiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    entitlementId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
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
    tableName: "subServiceEntitlements",
  }
);

SubService.hasMany(subServiceEntitlement, {
  foreignKey: "subServiceId",
  as: "subServiceEntitlements",
});

export default subServiceEntitlement;
