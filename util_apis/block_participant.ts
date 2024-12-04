import {
  Controller,
  RemoveFromStageParams,
  getSessionFromReq,
} from "../lib/controller.js";

// TODO: validate request with Zod

export const blockParticipant = async (req: any, res: any) => {
  const controller = new Controller();

  try {
    const session = getSessionFromReq(req);
    const reqBody = req.body;
    const data = await controller.blockParticipant(
      session,
      reqBody as RemoveFromStageParams
    );

    return res.status(200).send({ data });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send({ error: err.message });
    }

    return res.status(500).send(null);
  }
};
