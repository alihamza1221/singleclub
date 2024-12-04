import { Controller, getSessionFromReq } from "../lib/controller.js";

export const sendData = async (req: any, res: any) => {
  const controller = new Controller();
  console.log("req", req.body);
  try {
    const reqBody = req.body;
    const session = getSessionFromReq(req);
    const response = await controller.sendData(session, reqBody);

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send({ error: err.message });
    }
    return res.status(200).send(null);
  }
};
