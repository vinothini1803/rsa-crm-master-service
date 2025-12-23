import { Op } from "sequelize";
import { DistanceMatrixApiDetail } from "../database/models/index";
import moment from "moment-timezone";

class DistanceMatrixApiDetailController {
  constructor() {}

  public async delete(req: any, res: any) {
    try {
      const cutoffDate = moment()
        .tz("Asia/Kolkata")
        .subtract(process.env.DISTANCE_MATRIX_API_DETAIL_DELETE_MONTH, "months")
        .format("YYYY-MM-DD HH:mm:ss");

      const distanceMatrixApiDetails = await DistanceMatrixApiDetail.findAll({
        where: {
          createdAt: {
            [Op.lt]: cutoffDate,
          },
        },
        attributes: ["id"],
      });

      if (distanceMatrixApiDetails.length === 0) {
        return res.status(200).json({
          success: false,
          error: "No data found",
        });
      }

      const idsToDelete = distanceMatrixApiDetails.map(
        (detail: any) => detail.id
      );

      await DistanceMatrixApiDetail.destroy({
        where: {
          id: idsToDelete,
        },
        force: true,
      });

      return res.status(200).json({
        success: true,
        message: "Processed successfully",
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message,
      });
    }
  }
}

export default new DistanceMatrixApiDetailController();
