import { Router } from "express";
import { sendChatMessages } from "../team_mode_lib/send_chat_messages.js";
import { teamModeMergeRooms } from "../team_mode_lib/team_mode_merge.js";
import { RemoveTeamMember } from "../team_mode_lib/remove_member.js";
import { TeamRoomInvite } from "../team_mode_lib/invite_to_team.js";
import { TeamModeEnd } from "../team_mode_lib/end_team_mode.js";
const router = Router();

router.post("/on_pk_invite_accept", teamModeMergeRooms);
router.post("/invite_to_team", TeamRoomInvite);
router.post("/remove_member", RemoveTeamMember);
router.post("send_data", sendChatMessages);
router.post("/end_team_mode", TeamModeEnd);
export default router;
