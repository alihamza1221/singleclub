import { NextFunction } from "express";
import { config } from "dotenv";
config();
const validTokens = process.env.VALID_TOKENS?.split(",") || [];

export const authenticate = (req: any, res: any, next: NextFunction) => {
  const token = Array.isArray(req.headers["sdk-token"])
    ? req.headers["sdk-token"][0]
    : req.headers["sdk-token"];

  if (!token) {
    return res.status(401).send({ message: "No token provided" });
  }

  if (!validTokens.includes(token)) {
    return res.status(401).send({ message: "Application Unauthorized" });
  }

  next();
};
