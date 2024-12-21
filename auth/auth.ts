import { NextFunction } from "express";
import { config } from "dotenv";
import { generateToken } from "./create-access-token.js";
config();
const validTokens = process.env.VALID_TOKENS?.split(",") || [];

export const authenticate = (req: any, res: any, next: NextFunction) => {
  const token = Array.isArray(req.headers["sdk-token"])
    ? req.headers["sdk-token"][0]
    : req.headers["sdk-token"];

  if (!token) {
    const appId = req.body?.appId || genRandomId();
    const newGenId = generateToken(appId);
    return res
      .status(401)
      .send({
        newToken: newGenId,
        message: "Request for Authorization from Admin",
      });
  }

  if (!validTokens.includes(token)) {
    return res.status(401).send({ message: "Application Unauthorized" });
  }

  next();
};

const genRandomId = () => {
  return Math.random().toString(36).substring(7);
};
