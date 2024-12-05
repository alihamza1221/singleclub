import { Controller, CreateStreamParams } from "../lib/controller.js";

// TODO: validate request with Zod

export const createMultiVideoRoom = async (req: any, res: any) => {
  const controller = new Controller();

  try {
    const { body: reqBody } = req;
    const response = await controller.createMultiStream(
      reqBody as CreateStreamParams
    );

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send({ error: err.message });
    }

    return res.status(500).send(null);
  }
};
