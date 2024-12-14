import { Router } from "express";
import { sendChatMessages } from "../team_mode_lib/send_chat_messages.js";
import { teamModeMergeRooms } from "../team_mode_lib/team_mode_merge.js";

const router = Router();

router.post("/on_pk_invite_accept", teamModeMergeRooms);
router.post("/send_chat_messages", sendChatMessages);

export default router;
