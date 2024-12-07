import { Controller, getSessionFromReq } from "../lib/controller.js";

// TODO: validate request with Zod

export const PkRoomInvite = async (req: any, res: any) => {
  const controller = new Controller();

  try {
    const session = getSessionFromReq(req);
    const reqBody = req.body;
    const response = await controller.PkRoomInvite(session, reqBody);

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send(err.message);
    }

    return res.status(500).send(null);
  }
};
