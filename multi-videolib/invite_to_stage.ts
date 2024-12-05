import {
  Controller,
  InviteToStageParams,
  getSessionFromReq,
} from "../lib/controller.js";

// TODO: validate request with Zod

export const inviteToStageMulti = async (req: any, res: any) => {
  const controller = new Controller();

  try {
    const session = getSessionFromReq(req);
    if (req.body) req.body.multi_video_room = true;
    const response = await controller.inviteToStageAudio(
      session,
      req.body as InviteToStageParams
    );

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send(err.message);
    }

    return res.status(500).send(null);
  }
};
