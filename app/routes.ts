import express, { Router } from "express";
import { createStream } from "../util_apis/create_stream.js";
import { inviteToStage } from "../util_apis/invite_to_stage.js";
import { stopStream } from "../util_apis/stop_stream.js";
import { joinStream } from "../util_apis/join_stream.js";
import { removeFromStage } from "../util_apis/remove_from_stage.js";
import { config } from "dotenv";
import { roomsList } from "../util_apis/rooms_list.js";
import cors from "cors";
import { toggleRequestedToCall } from "../util_apis/toggle_requested_to_call.js";
import { removeParticipant } from "../util_apis/remove_participant.js";
import { sendData } from "../util_apis/send_data.js";
import { userReqToPresent } from "../util_apis/user_req_to_Present.js";
import { makeAdmin } from "../util_apis/make_admin.js";
import { blockParticipant } from "../util_apis/block_participant.js";
import { removeAdmin } from "../util_apis/remove_admin.js";
import { rejectUserToPresent } from "../util_apis/reject_user_to_present.js";
import { muteTracks } from "../util_apis/mute_track.js";
import AudioRouter from "./audiolib_routes.js";
import MultiVideoRouter from "./multi_videolib.js";
import PkRoomRouter from "./pk_lib.js";
import { SetChatMessages } from "../util_apis/set_chat_messages.js";
config();

const app = express();
const router = Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/audio", AudioRouter);
app.use("/multi_video", MultiVideoRouter);
app.use("/pk", PkRoomRouter);

router.post("/create_stream", createStream);
router.post("/invite_to_stage", inviteToStage);
router.post("/stop_stream", stopStream);
router.post("/join_stream", joinStream);
router.post("/remove_from_stage", removeFromStage);
router.post("/get_rooms_list", roomsList);
router.post("/toggle_requested_toCall", toggleRequestedToCall);
router.post("/remove_participant", removeParticipant);
router.post("/send_data", sendData);
router.post("/user_req_to_present", userReqToPresent);
router.post("/reject_user_to_present", rejectUserToPresent);
router.post("/make_admin", makeAdmin);
router.post("/remove_admin", removeAdmin);
router.post("/block_participant", blockParticipant);
router.post("/mute_tracks", muteTracks);
router.post("/set_chat_messages", SetChatMessages);
app.use(router);

app.listen(process.env.PORT || 3000, () => {
  console.log("SDK started on port 3000");
});

export default router;
