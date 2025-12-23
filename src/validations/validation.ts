import Joi from "joi";

export const validateSaveAspMechanic = Joi.object().keys({
  aspMechanicId: Joi.number().allow(null, ""),
  aspTypeId: Joi.number().required(),
  aspId: Joi.number().when("aspTypeId", {
    is: 772, //3rd Party
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  locationCapturedViaId: Joi.number().when("aspTypeId", {
    is: 771, //COCO
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  dynamicTypeId: Joi.number().when("locationCapturedViaId", {
    is: 782, //Dynamic
    then: Joi.number().required(),
    otherwise: Joi.number().allow(null, ""),
  }),
  latitude: Joi.string().when("aspTypeId", {
    is: 771, //COCO
    then: Joi.string().max(60).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  longitude: Joi.string().when("aspTypeId", {
    is: 771, //COCO
    then: Joi.string().max(60).required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  // latitude: Joi.string().allow(null, ""),
  // longitude: Joi.string().allow(null, ""),
  name: Joi.string().min(3).max(255).required(),
  code: Joi.string().min(3).max(60).required(),
  email: Joi.string().email().allow(null, ""),
  contactNumber: Joi.string().min(10).max(10).required(),
  alternateContactNumber: Joi.string().min(10).max(10).allow(null, ""),
  performanceId: Joi.number().required(),
  priorityId: Joi.number().required(),
  address: Joi.string().required(),
  cityId: Joi.number().required(),
  subServiceIds: Joi.array().items(Joi.number()).required(),
  userId: Joi.number().allow(null, ""),
  userName: Joi.string().min(3).max(255).required(),
  password: Joi.string().allow(null, ""),
  changePassword: Joi.number().allow(null, ""),
  status: Joi.number().required(),
  authUserId: Joi.number().required(),
  createdById: Joi.number().allow(null, ""),
  updatedById: Joi.number().allow(null, ""),
});

export const validateCreateNewCocoTechnician = Joi.object().keys({
  name: Joi.string().min(3).max(255).required(),
  code: Joi.string().min(3).max(60).required(),
  contactNumber: Joi.string().min(10).max(10).required(),
  latitude: Joi.string().required(),
  longitude: Joi.string().required(),
  address: Joi.string().required(),
  cityId: Joi.number().required(),
  subServiceIds: Joi.array().items(Joi.number()).required(),
  aspId: Joi.number().required(),
  authUserId: Joi.number().required(),
  createdById: Joi.number().required(),
});

export const validateViewAspMechanic = Joi.object().keys({
  aspMechanicId: Joi.number().required(),
});

export const validateUpdateStatusAspMechanic = Joi.object().keys({
  aspMechanicIds: Joi.array().required(),
  status: Joi.number().required(),
  updatedById: Joi.number().allow(null, ""),
  deletedById: Joi.number().allow(null, ""),
});

export const validateDeleteAspMechanic = Joi.object().keys({
  aspMechanicIds: Joi.array().required(),
});

export const validateAspMechanicGetById = Joi.object().keys({
  aspMechanicId: Joi.number().required(),
});

export const validateUpdateWorkStatusAspMechanic = Joi.object().keys({
  aspMechanicId: Joi.number().required(),
  workStatusId: Joi.number().required(),
  updatedById: Joi.number().required(),
});

export const validateAttendanceShift = Joi.object().keys({
  userId: Joi.number().required(),
  roleId: Joi.number().required(),
  shiftId: Joi.number().required(),
  shiftInSeconds: Joi.string().when("shiftId", {
    is: 1, //Weekly Off
    then: Joi.string().allow(null, ""),
    otherwise: Joi.string().required(),
  }),
  shiftStartTime: Joi.number().when("shiftId", {
    is: 1, //Weekly Off
    then: Joi.number().allow(null, ""),
    otherwise: Joi.number().required(),
  }),
  aspId: Joi.number().when("shiftId", {
    is: 1, //Weekly Off
    then: Joi.number().allow(null, ""),
    otherwise: Joi.number().required(),
  }),
  entityId: Joi.number().required(),
  vehicleId: Joi.number().when("shiftId", {
    is: 1, //Weekly Off
    then: Joi.number().allow(null, ""),
    otherwise: Joi.number().required(),
  }),
  file: Joi.string().allow(null, ""),
  disableFileMimeCheck: Joi.number().allow(null, ""),
  routeOrigin: Joi.string().allow(null, ""),
});

export const validateManagerUpdateCocoAssetStatus = Joi.object().keys({
  cocoVehicleId: Joi.number().required(),
  authUserId: Joi.number().required(),
  status: Joi.number().required(),
  reason: Joi.string().when("status", {
    is: 0, //INACTIVE
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
  dateRange: Joi.string().when("status", {
    is: 0, //INACTIVE
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null, ""),
  }),
});
