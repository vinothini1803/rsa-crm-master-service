import axios from "axios";
import config from "../config/config.json";

//API with endpoint (User Service);
const userServiceUrl = `${config.userService.host}:${config.userService.port}/${config.userService.version}/${config.userService.serviceAccess.user}`;
const userServiceEndpoint = config.userService.endpoint;

export interface VehicleActiveShiftResponse {
  success: boolean;
  hasActiveShift: boolean;
  attendanceLogId: number | null;
}

export async function checkOwnPatrolVehicleHasActiveShift(
  vehicleId: number
): Promise<VehicleActiveShiftResponse> {
  try {
    const response = await axios.post(
      `${userServiceUrl}/${userServiceEndpoint.checkOwnPatrolVehicleActiveShift}`,
      {
        vehicleId: vehicleId,
      }
    );

    if (response.data && response.data.success) {
      return {
        success: true,
        hasActiveShift: response.data.hasActiveShift || false,
        attendanceLogId: response.data.attendanceLogId || null,
      };
    }

    return {
      success: false,
      hasActiveShift: false,
      attendanceLogId: null,
    };
  } catch (error: any) {
    console.error("Error checking vehicle active shift:", error);
    return {
      success: false,
      hasActiveShift: false,
      attendanceLogId: null,
    };
  }
}

