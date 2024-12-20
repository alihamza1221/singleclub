import { Request, Response } from "express";

export const getPkRoom = (req: Request, res: Response) => {
  res.json({
    message: "PK Room APIs (Pk mode | Team v/s 4 | Team v/s 6)",
    pk_mode_methods: [
      "/pk/create_stream",
      "/pk/invite_to_stage",
      "/pk/stop_stream",
      "/pk/remove_from_stage",
      "/pk/join_stream",
      "/pk/invite_to_pk_room",
      "/pk/on_pk_invite_accept",
      "/pk/end_pk_room",
    ],
    team_room_methods: [
      "/team/on_pk_invite_accept",
      "/team/invite_to_team",
      "/team/remove_member",
      "/team/send_data",
      "/team/end_team_mode",
    ],
    pre_utils: [
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
