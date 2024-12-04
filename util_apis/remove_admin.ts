import { Controller, getSessionFromReq } from "../lib/controller.js";

// TODO: validate request with Zod

export const removeAdmin = async (req: any, res: any) => {
  const controller = new Controller();

  try {
    const session = getSessionFromReq(req);

    await controller.removeAdmin(session, req.body);

    return res.status(200).send({});
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send(err.message);
    }

    return res.status(500).send(null);
  }
};
