import { Controller, getSessionFromReq } from "../lib/controller.js";

// TODO: validate request with Zod

export const userReqToPresent = async (req: any, res: any) => {
  const controller = new Controller();

  try {
    const session = getSessionFromReq(req);
    const response = await controller.userReqToPresent(session);

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send(err.message);
    }

    return res.status(500).send(null);
  }
};
