import { Router } from "express";
import { createMultiVideoRoom } from "../multi-videolib/create_multi_video_room.js";
import { lockSeat } from "../audio_lib/lock_seat.js";
import { inviteToStageMulti } from "../multi-videolib/invite_to_stage.js";
import { toggleRequestedToCallAudio } from "../audio_lib/toggle_req_to_call.js";
import { userReqToPresentAudio } from "../audio_lib/user_req_to_present.js";

const router = Router();
router.post("/create_stream", createMultiVideoRoom);
router.post("/lock_seat", lockSeat);
router.post("/invite_to_stage", inviteToStageMulti);
router.post("/toggle_requested_toCall", toggleRequestedToCallAudio);
router.post("/user_req_to_present", userReqToPresentAudio);
export default router;
