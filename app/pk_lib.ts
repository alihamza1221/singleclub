import { Router } from "express";
import { PkRoomInvite } from "../util_apis/invite_to_pk_room.js";
import { pkRoomMerge } from "../util_apis/pk_room_merge.js";
import { EndPKRoom } from "../pk_lib/end_pk_room.js";
const router = Router();

router.post("/invite_to_pk_room", PkRoomInvite);
router.post("/on_pk_invite_accept", pkRoomMerge);
router.post("/end_pk_room", EndPKRoom);

export default router;
