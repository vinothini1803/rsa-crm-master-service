import { Tax } from "../database/models/index";

class TaxController {
  constructor() {}

  public async getData(req: any, res: any) {
    try {
      //GET TAX DATA
      const tax: any = await Tax.findOne({
        where: { name: "IGST" },
        attributes: ["id", "name", "percentage"],
      });
      if (!tax) {
        return res.status(200).json({
          success: false,
          error: "Tax not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data Fetched Successfully",
        data: tax,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

export default new TaxController();
