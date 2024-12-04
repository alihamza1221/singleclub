import { Controller, JoinStreamParams } from "../lib/controller.js";

// TODO: validate request with Zod

export const joinAudioStream = async (req: any, res: any) => {
  const controller = new Controller();
  console.log("joining ...........");
  try {
    const reqBody = req.body;
    const response = await controller.joinAudioStream(
      reqBody as JoinStreamParams
    );

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send({ error: err.message });
    }
    return res.status(200).send(null);
  }
};
