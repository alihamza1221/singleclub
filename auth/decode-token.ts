import jwt from "jsonwebtoken";
import { config } from "dotenv";
config();
const SECRET_KEY = process.env.SECRET_KEY as string;

export const decodeToken = (token: string) => {
  try {
    if (!SECRET_KEY) {
      throw new Error("Secret key not provided");
    }
    const decoded = jwt.verify(token, SECRET_KEY);
    return decoded;
  } catch (e: any) {
    throw new Error("Invalid token");
  }
};
