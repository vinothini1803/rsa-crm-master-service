import { getConfig } from "./config";
import { Config } from "../database/models/index";

export const getUserLoginStatus = async (req: any, res: any) => {
  try {
    let result: any = await getConfig(79);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(200).json({ success: false, error: error.message });
  }
};

export const getUserStatus = async (req: any, res: any) => {
  try {
    let result: any = await Config.findOne({
      where: { typeId: 79, id: req.body.id },
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(200).json({ success: false, error: error.message });
  }
};
