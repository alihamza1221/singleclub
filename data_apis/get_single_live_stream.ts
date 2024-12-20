import { Request, Response } from "express";

export const getSingleLiveStream = (req: Request, res: Response) => {
  res.json({
    message: "Single Live Stream API",
    methods: [
      "/create_stream",
      "/invite_to_stage",
      "/stop_stream",
      "/join_stream",
      "/remove_from_stage",
      "/get_rooms_list",
      "/toggle_requested_toCall",
      "/remove_participant",
      "/send_data",
      "/user_req_to_present",
      "/reject_user_to_present",
      "/make_admin",
      "/remove_admin",
      "/block_participant",
      "/mute_tracks",
    ],
  });
};
