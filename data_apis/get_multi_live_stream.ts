import { Request, Response } from "express";

export const getMultiLiveStream = (req: Request, res: Response) => {
  res.json({
    message: "Multi Live Stream API",
    methods: [
      "/multi_video/create_stream",
      "/multi_video/lock_seat",
      "/multi_video/invite_to_stage",
      "/multi_video/toggle_requested_toCall",
      "/multi_video/user_req_to_present",
      "/stop_stream",
      "/join_stream",
      "/remove_from_stage",
      "/get_rooms_list",
      "/remove_participant",
      "/send_data",
      "/reject_user_to_present",
      "/make_admin",
      "/remove_admin",
      "/block_participant",
      "/mute_tracks",
    ],
  });
};
