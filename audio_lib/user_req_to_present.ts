import { Controller, getSessionFromReq } from "../lib/controller.js";

// TODO: validate request with Zod

export const userReqToPresentAudio = async (req: any, res: any) => {
  console.log("user req to preset");
  const controller = new Controller();

  try {
    const session = getSessionFromReq(req);
    const response = await controller.userReqToPresentAudio(session, req);

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send(err.message);
    }

    return res.status(500).send(null);
  }
};
