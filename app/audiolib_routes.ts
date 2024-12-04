import { Router } from "express";
import { createAudioRoom } from "../audio_lib/create_audio_room.js";
import { inviteToStageAudio } from "../audio_lib/invite_to_stage.js";
import { joinAudioStream } from "../audio_lib/join_audio_stream.js";
import { userReqToPresentAudio } from "../audio_lib/user_req_to_present.js";
import { toggleRequestedToCallAudio } from "../audio_lib/toggle_req_to_call.js";
import { getAudioRoomWithParticipants } from "../audio_lib/get_room_participants.js";
const router = Router();

router.post("/create_stream", createAudioRoom);
router.post("/invite_to_stage", inviteToStageAudio);
router.post("/join_stream", joinAudioStream);
router.post("/user_req_to_present", userReqToPresentAudio);
router.post("/user_requested_to_call", toggleRequestedToCallAudio);
router.post("/get_room_with_participants", getAudioRoomWithParticipants);

export default router;
