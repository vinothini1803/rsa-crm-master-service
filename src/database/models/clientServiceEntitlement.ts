import { DataTypes } from "sequelize";
import sequelize from "../connection";
import { ClientService, Entitlement, SubService } from "../models/index";

const clientServiceEntitlement = sequelize.define(
  "clientServiceEntitlement",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    clientServiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    subServiceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    entitlementId: {
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
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    collate: "utf8mb4_general_ci",
    timestamps: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        name: "clientServiceEntitlements_unique",
        fields: ["clientServiceId", "subServiceId"],
      },
    ],
  }
);

//Relationships ---------------------------------
clientServiceEntitlement.belongsTo(SubService, {
  as: "subService",
  foreignKey: "subServiceId",
});

clientServiceEntitlement.belongsTo(Entitlement, {
  as: "entitlement",
  foreignKey: "entitlementId",
});

ClientService.hasMany(clientServiceEntitlement, {
  as: "clientServiceEntitlements",
  foreignKey: "clientServiceId",
});

clientServiceEntitlement.belongsTo(ClientService, {
  as: "clientService",
  foreignKey: "clientServiceId",
});

export default clientServiceEntitlement;
