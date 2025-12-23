import { Op } from "sequelize";
import { Milestone, Config } from "../database/models/index";
import sequelize from "../database/connection";
import Utils from "../lib/utils";
import milestone from "../database/models/milestone";
import activityStatus from "../database/models/activityStatus";
import caseStatus from "../database/models/caseStatus";
class MilestoneController {
  private static defaultLimit: number = 10;
  private static defaultOffset: number = 0;
  constructor() {}
  public async getList(req: any, res: any) {
    try {
      const { limit, offset } = req.query;

      // Set default values if parameters are not provided or are invalid
      const where: any = {};

      // Limitation value setup
      let limitValue: number = MilestoneController.defaultLimit;

      if (limit !== undefined) {
        const parsedLimit = parseInt(limit);
        if (!isNaN(parsedLimit) && Number.isInteger(parsedLimit)) {
          limitValue = parsedLimit;
        }
      }

      // Offset value
      let offsetValue: number = MilestoneController.defaultOffset;

      if (offset !== undefined) {
        const parsedOffset = parseInt(offset);
        if (!isNaN(parsedOffset) && Number.isInteger(parsedOffset)) {
          offsetValue = parsedOffset;
        }
      }

      const milestones = await milestone.findAll({
        where,
        attributes: ["id", "milestoneName"],
        include: [
          {
            model: activityStatus,
            attributes: ["id", "name"],
          },
          {
            model: caseStatus,
            attributes: ["id", "name"],
          },
        ],
        limit: limitValue,
        offset: offsetValue,
      });

      if (milestones.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: milestones,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
  public updateStatus = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = {
        milestoneIds: "required|array",
        status: "required|numeric",
      };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }
      const { milestoneIds, status, updatedById, deletedById } = payload;

      if (milestoneIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one milestone to update status",
        });
      }

      //Inactive
      let deletedAt = null;
      if (status == 0) {
        deletedAt = new Date();
      }

      for (const milestoneId of milestoneIds) {
        const milestoneExists = await Milestone.findOne({
          where: {
            id: milestoneId,
          },
          paranoid: false,
        });
        if (!milestoneExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Milestone Id - (${milestoneId}) not found`,
          });
        }
        await Milestone.update(
          { updatedById, deletedById, deletedAt },
          {
            where: { id: milestoneId },
            paranoid: false,
            transaction: transaction,
          }
        );
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Milestone status updated successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({ success: false, error: error.message });
    }
  };
  public save = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      let payload = req.body;
      const v = {
        milestoneName: "required|string",
        // remainder:
        toolTipValue: "string",
        prevMilestoneId: "numeric",
        caseStatusId: "numeric",
        activityStatusId: "numeric"
      };

      const errors = await Utils.validateParams(payload, v);

      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      let data: any = {
        milestoneName: payload.milestoneName,
        remainder: payload.remainder,
        toolTipValue: payload.toolTipValue,
        prevMilestoneId: payload.prevMilestoneId,
        caseStatusId: payload.caseStatusId,
        activityStatusId: payload.activityStatusId,
        createdById: payload.createdById,
      };

      if (payload.milestoneId) {
        const milestoneExists: any = await Milestone.findOne({
          where: { id: payload.milestoneId },
          paranoid: false,
        });
        if (!milestoneExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Milestone Id - (${payload.milestoneId}) not found`,
          });
        }

        // validate check
        const validateMilestone: any = await Milestone.findOne({
          where: {
            id: {
              [Op.ne]: payload.milestoneId, 
            },
            milestoneName: payload.milestoneName,
          },
          paranoid: false,
        });
        if (validateMilestone) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `The name ${payload.milestoneName} already exists`,
          });
        }

        await Milestone.update(data, {
          where: { id: payload.milestoneId },
          transaction: transaction,
        });
      } else {
        const milestoneExists: any = await Milestone.findOne({
          where: { milestoneName: payload.milestoneName},
          paranoid: false,
        });
        if (milestoneExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Milestone already exists in this name.`,
          });
        }
        await Milestone.create(data, { transaction: transaction });
      }
      await transaction.commit();
      const message = payload.milestoneId
      ? "Milestone updated successfully"
      : "Milestone created successfully";
  
      return res
        .status(200)
        .json({ success: true, message: message});
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({ success: false, error: error.message });
    }
  };
  public delete = async (req: any, res: any) => {
    const transaction = await sequelize.transaction();
    try {
      const payload = req.body;
      const validateData = { milestoneIds: "required|array" };
      const errors = await Utils.validateParams(payload, validateData);
      if (errors) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          errors: errors,
        });
      }

      const { milestoneIds } = payload;

      if (milestoneIds.length == 0) {
        await transaction.rollback();
        return res.status(200).json({
          success: false,
          error: "Please select atleast one milestone to delete",
        });
      }

      for (const milestoneId of milestoneIds) {
        const milestoneExists = await Milestone.findOne({
          where: {
            id: milestoneId,
          },
          paranoid: false,
        });
        if (!milestoneExists) {
          await transaction.rollback();
          return res.status(200).json({
            success: false,
            error: `Milestone Id - (${milestoneId}) not found`,
          });
        }

        await Milestone.destroy({
          where: {
            id: milestoneId,
          },
          force: true,
          transaction: transaction,
        });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: "Milestone deleted successfully",
      });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
  public async getMilestoneAgainstCaseActivity(req: any, res: any) {
    try {
      
      const { activityStatusId, caseStatusId } = req.body;
  
      // Set up the where clause
      const where: any = {};
  
      if (activityStatusId) {
        where.activityStatusId = activityStatusId;
      }
  
      if (caseStatusId) {
        where.caseStatusId = caseStatusId;
      }
  
      const milestones = await milestone.findAll({
        where,
        include: [
          {
            model: activityStatus,
            attributes: ["id", "name"],
          },
          {
            model: caseStatus,
            attributes: ["id", "name"],
          },
          {
            model: milestone,
            attributes: ["id", "milestoneName"],
          },
        ],
      });

      if (milestones.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }
  
      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: milestones,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new MilestoneController();
