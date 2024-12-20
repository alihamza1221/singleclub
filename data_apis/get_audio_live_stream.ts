import { Request, Response } from "express";

export const getAudioLiveStream = (req: Request, res: Response) => {
  res.json({
    message: "Audio Live Stream API",
    methods: [
      "/audio/create_stream",
      "/audio/invite_to_stage",
      "/audio/join_stream",
      "/audio/user_req_to_present",
      "/audio/get_room_with_participants",
      "/audio/toggle_requested_toCall",
      "/audio/lock_seat",
      "/audio/remove_from_stage",
      "/stop_stream",
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
