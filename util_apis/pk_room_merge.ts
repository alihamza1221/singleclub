import { Controller, getSessionFromReq } from "../lib/controller.js";

// TODO: validate request with Zod

export const pkRoomMerge = async (req: any, res: any) => {
  const controller = new Controller();

  try {
    const reqBody = req.body;
    const session = getSessionFromReq(req);
    const response = await controller.pkRoomMerge(session, reqBody);

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send({ error: err.message });
    }
    return res.status(200).send(null);
  }
};
