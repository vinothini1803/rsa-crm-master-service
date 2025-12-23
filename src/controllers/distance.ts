import { Utils } from "../lib/utils";

export const getGoogleDistanceData = async (req: any, res: any) => {
  try {
    const { origin, destination } = req.body;
    let data: any = await Utils.getGoogleDistanceDuration(
      origin,
      destination,
      2
    );
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message,
    });
  }
};
