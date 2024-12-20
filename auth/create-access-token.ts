import jwt from "jsonwebtoken";
import { config } from "dotenv";
config();
const SECRET_KEY = process.env.SECRET_KEY as string;

/*Route to get Access Token */
export const issueToken = async (req: any, res: any) => {
  try {
    const { appId } = req.body;

    if (!appId) {
      return res.status(400).send({ message: "App ID is required" });
    }

    const token = generateToken(appId);
    return res.status(200).send({ token });
  } catch (e: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/*util functions */

const generateToken = (appId: string): string => {
  try {
    if (!SECRET_KEY) {
      return "";
    }
    const payload = { appId };

    return jwt.sign(payload, SECRET_KEY);
  } catch (e: any) {
    return "";
  }
};
