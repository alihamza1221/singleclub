import {
  Controller,
  InviteToStageParams,
  getSessionFromReq,
} from "../lib/controller.js";

// TODO: validate request with Zod

export const inviteToStage = async (req: any, res: any) => {
  const controller = new Controller();

  try {
    const session = getSessionFromReq(req);
    const reqBody = req.body;
    const response = await controller.inviteToStage(
      session,
      reqBody as InviteToStageParams
    );

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      console.error("err", err);
      return res.status(500).send(err.message);
    }
    console.error("err");
    return res.status(500).send(null);
  }
};
