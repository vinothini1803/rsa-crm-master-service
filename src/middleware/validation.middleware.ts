import { Request, Response, NextFunction } from "express";
import Joi from "joi";
const validBodySymbol = Symbol("validBody");

const validate = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(200).json({ success: false, error: error.message });
    }
    (req as any)[validBodySymbol] = value;
    next();
  };
};

export const getValidBody = (req: Request) => {
  return (req as any)[validBodySymbol];
};

export default validate;
