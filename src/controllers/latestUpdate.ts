import sequelize from "../database/connection";
import { LatestUpdate, LatestUpdateRole } from "../database/models/index";
import config from "../config/config.json";
import axios from "axios";
import { Op } from "sequelize";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}`;
const userServiceEndpoint = config.userService.endpoint;

class LatestUpdateController {
  constructor() {}

  syncFromAspPortal = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const commonGetMasterDetail = await axios.post(
        `${userServiceUrl}/${userServiceEndpoint.commonGetMasterDetails}`,
        {
          fetchAllRoles: true,
        }
      );

      let roleDetails = [];
      if (commonGetMasterDetail.data && commonGetMasterDetail.data.success) {
        roleDetails = commonGetMasterDetail.data.data.allRoles;
      }

      const checkExists: any = await LatestUpdate.findOne({
        attributes: ["id"],
        where: {
          aspPortalId: payload.id,
        },
        paranoid: false,
      });

      const data = {
        aspPortalId: payload.id,
        title: payload.title,
        description: payload.description ? payload.description : null,
        isFixed: payload.isFixed,
        fromDate: payload.fromDate ? payload.fromDate : null,
        toDate: payload.toDate ? payload.toDate : null,
        displayOrder: payload.displayOrder ? payload.displayOrder : null,
        deletedAt: payload.deletedAt ? new Date() : null,
      };

      let latestUpdateId = null;
      if (checkExists) {
        await LatestUpdate.update(data, {
          where: {
            id: checkExists.id,
          },
          transaction: transaction,
          paranoid: false,
        });
        latestUpdateId = checkExists.id;
      } else {
        const newRecord = await LatestUpdate.create(data, {
          transaction: transaction,
        });
        latestUpdateId = newRecord.dataValues.id;
      }

      await LatestUpdateRole.destroy({
        where: {
          latestUpdateId: latestUpdateId,
        },
        force: true,
        transaction: transaction,
      });
      if (payload.roleNames && payload.roleNames.length > 0) {
        let latestUpdateRoleData = [];
        for (const roleName of payload.roleNames) {
          const roleDetail = roleDetails.find(
            (role: any) => role.aspRoleName === roleName
          );

          latestUpdateRoleData.push({
            latestUpdateId: latestUpdateId,
            roleId: roleDetail ? roleDetail.id : null,
          });
        }

        await LatestUpdateRole.bulkCreate(latestUpdateRoleData, {
          transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The Latest update has been saved successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  deleteFromAspPortal = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;

      const checkExists: any = await LatestUpdate.findOne({
        attributes: ["id"],
        where: {
          aspPortalId: payload.id,
        },
        paranoid: false,
      });

      if (!checkExists) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Latest update record not found",
        });
      }

      await LatestUpdate.destroy({
        where: {
          id: checkExists.id,
        },
        force: true,
        transaction: transaction,
      });

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "The latest update has been deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };

  getLatestUpdate = async (req: any, res: any) => {
    try {
      const payload = req.body;
      const latestUpdates: any = await LatestUpdate.findAll({
        attributes: ["id", "title", "description"],
        where: {
          [Op.or]: [
            {
              isFixed: 1,
            },
            {
              [Op.and]: [
                {
                  fromDate: {
                    [Op.lte]: new Date(),
                  },
                },
                {
                  toDate: {
                    [Op.gte]: new Date(),
                  },
                },
              ],
            },
          ],
        },
        include: [
          {
            model: LatestUpdateRole,
            attributes: [],
            where: {
              roleId: payload.authUserRoleId,
            },
            required: true,
          },
        ],
        order: [["id", "asc"]],
      });

      if (latestUpdates.length == 0) {
        return res.status(200).json({
          success: false,
          error: "Latest update not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: latestUpdates,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  };
}

export default new LatestUpdateController();
