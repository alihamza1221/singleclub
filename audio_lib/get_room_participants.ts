import { Controller } from "../lib/controller.js";

// TODO: validate request with Zod

export const getAudioRoomWithParticipants = async (req: any, res: any) => {
  const controller = new Controller();

  try {
    // TODO: Add permissions to ROOMS List
    const response = await controller.getAudioRoomWithParticipants();

    return res.status(200).send(response);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(500).send({ error: err.message });
    }

    return res.status(200).send(null);
  }
};
