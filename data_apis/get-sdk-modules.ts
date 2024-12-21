import { Request, Response } from "express";

export const getSDKModules = (req: Request, res: Response) => {
  res.json({
    message: "SDK Modules",
    methods: [
      "/sdk/get_audio_live_stream",
      "/sdk/get_multi_live_stream",
      "/sdk/get_pk_room",
      "/sdk/get_single_live_stream",
    ],
  });
};
