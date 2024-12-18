// forked from livestream-mobile-backend

import jwt from "jsonwebtoken";
import {
  AccessToken,
  ParticipantInfo,
  ParticipantPermission,
  RoomServiceClient,
  AccessTokenOptions,
  CreateOptions,
  SendDataOptions,
  DataPacket_Kind,
  TrackType,
  VideoGrant,
  TrackSource,
} from "livekit-server-sdk";

type PublishDataType = {
  data: string;
  mention?: {
    id: string;
  };

  kind?: DataPacket_Kind;
  sendDataOptions?: SendDataOptions;
};

export type TeamMode = {
  ttl: number | string;
  createdAt: string | Date;
  team_admin: string;
  invites: number;
  team_room: string;
  defendingTeam: boolean;
  members: string[];
};
export type RoomMetadata = {
  creator_identity: string;
  enable_chat?: boolean;
  type?:
    | "audio-only"
    | "audio-video"
    | "multi-video"
    | "live-audio-video"
    | "Team v/s 4"
    | "Team v/s 6"
    | "team_temp_room";
  seats?: {
    id: number;
    occupied: boolean;
    locked: boolean;
    assignedParticipant: string | null | undefined;
  }[];
  allow_participation?: boolean;
  password?: string;
  description?: string;
  title?: string;
  tags?: string[];
  team_mode?: TeamMode;
  [key: string]: any;
};

export type ParticipantAttributes = Record<string, string>;

export type ParticipantMetadata = {
  isAdmin?: boolean;
  invited_to_stage?: boolean;
  seatId?: number;
  reqSeatId?: number;
  roomList?: boolean;
  canUpdateOwnMetadata?: boolean;
  team_access_tokens_list?: Array<string>;
  [key: string]: any;
};

export type Config = {
  ws_url: string;
  api_key: string;
  api_secret: string;
};

export type Session = {
  identity: string;
  room_name: string;
};

export type ToggleRequestedToCallParams = {
  setFalse?: boolean;
  identity: string;
};

export type ConnectionDetails = {
  token: string;
  ws_url: string;
};

export type CreateStreamParams = {
  creator_identity?: string;
  room_name?: string;
  metadata: RoomMetadata;
  AccessTokenOptions?: AccessTokenOptions;
  createOptions?: CreateOptions | {};
};

export type CreateStreamResponse = {
  auth_token: string;
  connection_details: ConnectionDetails;
  roomName: string;
};

export type JoinStreamParams = {
  room_name: string;
  identity: string;
  attributes?: ParticipantAttributes;
  metadata?: ParticipantMetadata;
};

export type JoinStreamResponse = {
  auth_token: string;
  connection_details: ConnectionDetails;
};

export type DeleteRoomParams = {
  roomName: string | null | undefined;
};
export type InviteToStageParams = {
  seatId?: number;
  identity: string;
  multi_video_room?: boolean;
};

export type RemoveFromStageParams = {
  identity?: string;
};

export type ErrorResponse = {
  error: string;
};

export function getSessionFromReq(req: Request): Session {
  let authHeader = null;
  try {
    //@ts-ignore
    authHeader = req.headers["authorization"];
  } catch (err) {
    try {
      authHeader = req.headers.get("authorization");
    } catch (e) {}
  }
  const token = authHeader?.split(" ")[1];
  if (!token) {
    throw new Error("No authorization header found");
  }
  const verified = jwt.verify(token, process.env.LIVEKIT_API_SECRET!);
  if (!verified) {
    throw new Error("Invalid token");
  }
  const decoded = jwt.decode(token) as Session;

  return decoded;
}

export class Controller {
  private roomService: RoomServiceClient;
  private endMergeRoom: boolean;
  constructor() {
    const httpUrl = process.env
      .LIVEKIT_WS_URL!.replace("wss://", "https://")
      .replace("ws://", "http://");
    this.roomService = new RoomServiceClient(
      httpUrl,
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!
    );
    this.endMergeRoom = false;
  }

  async createStream({
    metadata = {
      type: "audio-video",
      creator_identity: "null",
    },
    room_name: roomName,
    AccessTokenOptions = {},
    createOptions = {},
  }: CreateStreamParams): Promise<CreateStreamResponse> {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity: metadata.creator_identity,
        ...AccessTokenOptions,
      }
    );

    if (!roomName) {
      roomName = generateRoomId();
    }
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      roomAdmin: true,
      canPublishData: true,
    });

    // TODO turn off auto creation in the dashboard
    await this.roomService.createRoom({
      name: roomName,
      metadata: JSON.stringify(metadata),
      ...createOptions,
    });

    const connection_details = {
      ws_url: process.env.LIVEKIT_WS_URL!,
      token: await at.toJwt(),
    };

    const authToken = this.createAuthToken(roomName, metadata.creator_identity);

    return {
      auth_token: authToken,
      connection_details,
      roomName,
    };
  }

  async createAudioStream({
    metadata,
    room_name: roomName,
    AccessTokenOptions = {},
    createOptions = {},
  }: CreateStreamParams): Promise<CreateStreamResponse> {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity: metadata.creator_identity,
        ...AccessTokenOptions,
      }
    );

    if (!roomName) {
      roomName = generateRoomId();
    }

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE],
      canSubscribe: true,
      roomAdmin: true,
      canPublishData: true,
    });

    // TODO turn off auto creation in the dashboard
    metadata = {
      ...metadata,
      ...{
        type: "audio-only",
        seats: Array.from({ length: 9 }, (_, index) => ({
          id: index + 1,
          occupied: false,
          locked: false,
          assignedParticipant: null,
        })),
      },
    };

    await this.roomService.createRoom({
      name: roomName,
      metadata: JSON.stringify(metadata),
      ...createOptions,
    });

    const connection_details = {
      ws_url: process.env.LIVEKIT_WS_URL!,
      token: await at.toJwt(),
    };

    const authToken = this.createAuthToken(roomName, metadata.creator_identity);

    return {
      auth_token: authToken,
      connection_details,
      roomName,
    };
  }

  async createMultiStream({
    metadata,
    room_name: roomName,
    AccessTokenOptions = {},
    createOptions = {},
  }: CreateStreamParams): Promise<CreateStreamResponse> {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity: metadata.creator_identity,
        ...AccessTokenOptions,
      }
    );

    if (!roomName) {
      roomName = generateRoomId();
    }

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE, TrackSource.CAMERA],
      canSubscribe: true,
      roomAdmin: true,
      canPublishData: true,
    });

    // TODO turn off auto creation in the dashboard
    metadata = {
      ...metadata,
      ...{
        type: "multi-video",
        seats: Array.from({ length: 5 }, (_, index) => ({
          id: index + 1,
          occupied: false,
          locked: false,
          assignedParticipant: null,
        })),
      },
    };

    await this.roomService.createRoom({
      name: roomName,
      metadata: JSON.stringify(metadata),
      ...createOptions,
    });

    const connection_details = {
      ws_url: process.env.LIVEKIT_WS_URL!,
      token: await at.toJwt(),
    };

    const authToken = this.createAuthToken(roomName, metadata.creator_identity);

    return {
      auth_token: authToken,
      connection_details,
      roomName,
    };
  }

  async stopStream(session: Session, { roomName }: DeleteRoomParams) {
    if (!roomName) {
      roomName = session.room_name;
    }
    const rooms = await this.roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }

    const room = rooms[0];
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    if (creator_identity !== session.identity) {
      throw new Error("Only the creator can invite to stage");
    }

    await this.roomService.deleteRoom(session.room_name);
  }

  async joinStream({
    identity,
    room_name,
  }: JoinStreamParams): Promise<JoinStreamResponse> {
    // Check for existing participant with same identity
    let exists = false;
    try {
      await this.roomService.getParticipant(room_name, identity);
      exists = true;
    } catch {}

    if (exists) {
      throw new Error("Participant already exists");
    }

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity,
      }
    );

    at.addGrant({
      room: room_name,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
    });

    const authToken = this.createAuthToken(room_name, identity);

    return {
      auth_token: authToken,
      connection_details: {
        ws_url: process.env.LIVEKIT_WS_URL!,
        token: await at.toJwt(),
      },
    };
  }

  async joinAudioStream({
    identity,
    room_name,
    attributes,
    metadata = {
      isAdmin: false,
    },
  }: JoinStreamParams): Promise<JoinStreamResponse> {
    // Check for existing participant with same identity
    let exists = false;
    try {
      await this.roomService.getParticipant(room_name, identity);
      exists = true;
    } catch {}

    if (exists) {
      throw new Error("Participant already exists");
    }

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity,
      }
    );

    at.addGrant({
      room: room_name,
      roomJoin: true,
      canPublish: false,
      canPublishSources: [TrackSource.MICROPHONE],
      canSubscribe: true,
      canPublishData: true,
    });

    if (attributes) at.attributes = attributes;
    if (metadata) at.metadata = JSON.stringify(metadata);
    const authToken = this.createAuthToken(room_name, identity);

    return {
      auth_token: authToken,
      connection_details: {
        ws_url: process.env.LIVEKIT_WS_URL!,
        token: await at.toJwt(),
      },
    };
  }

  async makeAdmin(session: Session, { identity }: { identity: string }) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    const room = rooms[0];
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    const participant = await this.roomService.getParticipant(
      session.room_name,
      identity
    );

    const requesterInfo = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const metadata = this.getOrCreateParticipantMetadata(participant);
    const requesterMetaData =
      this.getOrCreateParticipantMetadata(requesterInfo);
    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }
    if (creator_identity != session.identity && !requesterMetaData.isAdmin) {
      throw new Error("Only creator or Admin can make Admin");
    }

    const permission = participant.permission || ({} as ParticipantPermission);

    //admin permission and identifier

    metadata.isAdmin = true;
    await this.roomService.updateParticipant(
      session.room_name,
      identity,
      JSON.stringify(metadata),
      permission
    );
    return {
      message: `Success Created Admin ${identity}`,
    };
  }

  async removeAdmin(session: Session, { identity }: { identity: string }) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    if (!identity) {
      identity = session.identity;
    }
    const room = rooms[0];
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    const participant = await this.roomService.getParticipant(
      session.room_name,
      identity
    );

    const requesterInfo = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const metadata = this.getOrCreateParticipantMetadata(participant);
    const requesterMetaData =
      this.getOrCreateParticipantMetadata(requesterInfo);
    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }
    if (creator_identity != session.identity && !requesterMetaData.isAdmin) {
      throw new Error("Only creator or Admin can make Admin");
    }

    const permission = participant.permission || ({} as ParticipantPermission);

    //admin permission and identifier

    metadata.isAdmin = false;

    await this.roomService.updateParticipant(
      session.room_name,
      identity,
      JSON.stringify(metadata),
      permission
    );
  }

  async sendData(
    session: Session,
    {
      data: dataRec,
      kind = DataPacket_Kind.RELIABLE,
      mention,
      sendDataOptions = {},
    }: PublishDataType
  ): Promise<any> {
    try {
      console.log("dataRec", dataRec, "session.room", session.room_name);
      const rooms = await this.roomService.listRooms([session.room_name]);

      if (rooms.length === 0) {
        throw new Error("Room does not exist");
      }
      const room = rooms[0];

      const roomMetaData =
        room.metadata && (JSON.parse(room.metadata) as RoomMetadata);

      if (roomMetaData && !roomMetaData.enable_chat) {
        return {
          messages: "Chat is disabled",
        };
      }

      const messageId = generateRoomId();
      const strData = JSON.stringify({
        identity: session.identity,
        data: dataRec,
        mention,
        messageId,
      });
      const encoder = new TextEncoder();
      const data = encoder.encode(strData);

      await this.roomService.sendData(
        session.room_name,
        data,
        kind,
        sendDataOptions
      );

      //in PK Mode send Messages to both rooms
      if (!roomMetaData) {
        return {
          message: "sent successful",
        };
      } else if (roomMetaData.team_mode) {
        const team_room = roomMetaData.team_mode.team_room;
        const rooms_list = await this.roomService.listRooms();

        for (const room of rooms_list) {
          const room_metadata = JSON.parse(room.metadata) as RoomMetadata;

          if (
            room_metadata.team_mode?.team_room == team_room &&
            room.name != session.room_name
          ) {
            await this.roomService.sendData(
              room.name,
              data,
              kind,
              sendDataOptions
            );
          }
        }
        return {
          message: "Data sent successfully",
        };
      } else if (!roomMetaData.pkSrcTtl && !roomMetaData.pkTarTtl)
        return {
          message: "Data sent successfully",
        };
      const creator = roomMetaData.creator_identity;
      const creatorInfo = await this.roomService.getParticipant(
        session.room_name,
        creator
      );

      const creatorMetaData = this.getOrCreateParticipantMetadata(creatorInfo);

      if (creatorMetaData.pkRoomToken != "") {
        const participantToken = jwt.decode(creatorMetaData.pkRoomToken);

        if (participantToken) {
          //@ts-ignore
          const pkRoom = participantToken.video?.room;
          await this.roomService.sendData(pkRoom, data, kind, sendDataOptions);
        }
      }
      return {
        message: "Data sent successfully",
      };
    } catch (err) {
      console.log(err);
    }
  }

  async checkRoomAvailbilty(session: Session): Promise<any> {
    try {
      const rooms = await this.roomService.listRooms([session.room_name]);

      if (rooms.length === 0) {
        throw new Error("Room does not exist");
      }
      //TODO:check only 2 users can turn video on

      const participants = await this.roomService.listParticipants(
        session.room_name
      );

      let invitedToStageCount = 0;

      participants.forEach((participant) => {
        if (participant.metadata) {
          const metadata = JSON.parse(
            participant.metadata
          ) as ParticipantMetadata;
          if (metadata.invited_to_stage) {
            const isPublishingVideo = participant.tracks.some((track) => false);
            if (isPublishingVideo) {
              invitedToStageCount++;
            }
          }
        }
      });
    } catch (err) {
      console.log(err);
    }
  }

  async inviteToStage(session: Session, { identity }: InviteToStageParams) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    const room = rooms[0];

    if (rooms.length === 0 || !session.identity) {
      throw new Error("Room does not exist");
    }

    const participant = await this.roomService.getParticipant(
      session.room_name,
      identity
    );

    const permission = participant.permission || ({} as ParticipantPermission);

    const metadata = this.getOrCreateParticipantMetadata(participant);

    const requesterInfo = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const requesterMetaData =
      this.getOrCreateParticipantMetadata(requesterInfo);
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    const validNumPublication = await this.validateNumPublication(
      session.room_name
    );
    //only 5 publishers are allowed
    if (!validNumPublication) {
      metadata.invited_to_stage = false;
      permission.canPublish = false;
      metadata.requested_to_call = false;
    }
    // If  invited to stage, then we let the put them on stage
    else if (metadata.requested_to_call) {
      metadata.invited_to_stage = true;
      permission.canPublish = true;
      metadata.requested_to_call = false;
      metadata.reqToPresent = false;
    } else if (metadata.reqToPresent) {
      permission.canPublish = true;
      metadata.invited_to_stage = true;
      metadata.reqToPresent = false;
      metadata.requested_to_call = false;
    } else if (
      session.identity == creator_identity ||
      requesterMetaData.isAdmin
    ) {
      metadata.invited_to_stage = true;
      permission.canPublish = true;
    }

    await this.roomService.updateParticipant(
      session.room_name,
      identity,
      JSON.stringify(metadata),
      permission
    );
    if (!validNumPublication)
      return {
        message: "5 person on call. Wait for availability",
      };
    else return { message: "success invited to stage" };
  }

  async lockSeat(
    session: Session,
    { seatId, state = true }: { seatId: number; state?: boolean }
  ) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    const room = rooms[0];

    if (rooms.length === 0 || !session.identity) {
      throw new Error("Room does not exist");
    }

    const requesterInfo = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const requesterMetaData =
      this.getOrCreateParticipantMetadata(requesterInfo);
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    if (creator_identity !== session.identity && !requesterMetaData?.isAdmin) {
      throw new Error("Only the Admin, user can lock seat");
    }
    // lock seat through room metadata

    const roomMetaData =
      room.metadata && (JSON.parse(room.metadata) as RoomMetadata);
    //update the seat and set locked

    if (roomMetaData) {
      const seat = roomMetaData.seats?.find((s) => s.id === seatId);
      if (seat) {
        seat.locked = state;
        seat.assignedParticipant = null;
        seat.occupied = false;
      }
    }

    //update metadata
    await this.roomService.updateRoomMetadata(
      session.room_name,
      JSON.stringify(roomMetaData)
    );
    return {
      message: "SeatId Status Updated Successfully",
    };
  }

  async inviteToStageAudio(
    session: Session,
    { identity, seatId = -1, multi_video_room = false }: InviteToStageParams
  ) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    const room = rooms[0];

    if (rooms.length === 0 || !session.identity) {
      throw new Error("Room does not exist");
    }

    const participant = await this.roomService.getParticipant(
      session.room_name,
      identity
    );

    const permission = participant.permission || ({} as ParticipantPermission);

    const metadata = this.getOrCreateParticipantMetadata(participant);

    if (seatId != -1) {
      const idBound = multi_video_room ? seatId > 5 : seatId > 9;
      if (idBound) {
        return {
          message: "SeatId out of bound",
        };
      }
    }
    if (seatId == -1 && metadata.reqSeatId && metadata.reqSeatId != -1) {
      seatId = metadata.reqSeatId;
      metadata.reqSeatId = -1;
    }
    const requesterInfo = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const requesterMetaData =
      this.getOrCreateParticipantMetadata(requesterInfo);
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    const validNumPublication = await this.validateNumPublication(
      session.room_name,
      !multi_video_room ? "audio-only" : "multi-video"
    );

    const roomMetadata =
      room.metadata && (JSON.parse(room.metadata) as RoomMetadata);
    //only 5 publishers for multi-video room and 9 for audio are allowed
    if (!validNumPublication) {
      metadata.invited_to_stage = false;
      permission.canPublish = false;
      metadata.requested_to_call = false;
      seatId = -1;
    }
    // If  invited to stage, then we let the put them on stage
    else if (metadata.requested_to_call) {
      metadata.invited_to_stage = true;
      permission.canPublish = true;
      permission.canPublishSources = [TrackSource.MICROPHONE];
      metadata.requested_to_call = false;
      metadata.reqToPresent = false;
      metadata.seatId = seatId;

      //update seat
      if (roomMetadata && roomMetadata.seats) {
        if (seatId != -1) {
          const seat = roomMetadata.seats.find((s) => s.id === seatId);
          if (seat && !seat.occupied && !seat.locked) {
            seat.occupied = true;
            seat.assignedParticipant = identity;
            metadata.seatId = seat.id;
          }
        } else {
          //assign to available seat
          const seat = roomMetadata.seats.find((s) => !s.occupied && !s.locked);
          if (seat) {
            seat.occupied = true;
            seat.assignedParticipant = identity;
            metadata.seatId = seat.id;
          }
        }
      }
    } else if (metadata.reqToPresent) {
      permission.canPublishSources = multi_video_room
        ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
        : [TrackSource.MICROPHONE];

      metadata.invited_to_stage = true;
      permission.canPublish = true;
      metadata.reqToPresent = false;
      metadata.requested_to_call = false;

      //update seat
      if (roomMetadata && roomMetadata.seats) {
        if (seatId != -1) {
          const seat = roomMetadata.seats.find((s) => s.id === seatId);
          if (seat && !seat.occupied && !seat.locked) {
            seat.occupied = true;
            seat.assignedParticipant = identity;
            metadata.seatId = seat.id;
            roomMetadata.seats[seat.id - 1] = seat;
          }
        } else {
          //assign to available seat
          const seat = roomMetadata.seats.find((s) => !s.occupied && !s.locked);
          if (seat) {
            seat.occupied = true;
            seat.assignedParticipant = identity;
            metadata.seatId = seat.id;
            roomMetadata.seats[seat.id - 1] = seat;
          }
        }
      }
    } else if (
      session.identity == creator_identity ||
      requesterMetaData.isAdmin
    ) {
      metadata.invited_to_stage = true;
      permission.canPublishSources = multi_video_room
        ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
        : [TrackSource.MICROPHONE];
      permission.canPublish = true;

      //update seat
      if (roomMetadata && roomMetadata.seats) {
        if (seatId != -1) {
          const seat = roomMetadata.seats.find((s) => s.id === seatId);
          if (seat && !seat.occupied && !seat.locked) {
            seat.occupied = true;
            seat.assignedParticipant = identity;
            metadata.seatId = seat.id;
            roomMetadata.seats[seat.id - 1] = seat;
          }
        } else {
          //assign to available seat
          const seat = roomMetadata.seats.find((s) => !s.occupied && !s.locked);
          if (seat) {
            seat.occupied = true;
            seat.assignedParticipant = identity;
            metadata.seatId = seat.id;
            roomMetadata.seats[seat.id - 1] = seat;
          }
        }
      }
    }

    await this.roomService.updateParticipant(
      session.room_name,
      identity,
      JSON.stringify(metadata),
      permission
    );

    await this.roomService.updateRoomMetadata(
      session.room_name,
      JSON.stringify(roomMetadata)
    );

    if (!validNumPublication)
      return {
        message: `${
          multi_video_room ? "5" : "9"
        } person on call. Wait for availability`,
      };
    else return {};
  }
  async userReqToPresent(session: Session) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    const room = rooms[0];

    if (rooms.length === 0 || !session.identity) {
      throw new Error("Room does not exist");
    }
    const participant = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const permission = participant.permission || ({} as ParticipantPermission);
    const metadata = this.getOrCreateParticipantMetadata(participant);
    metadata.reqToPresent = true;

    const validNumPublication = await this.validateNumPublication(
      session.room_name
    );
    //only 5 publishers are allowed
    if (!validNumPublication) {
      metadata.invited_to_stage = false;
      permission.canPublish = false;
      metadata.requested_to_call = false;
      metadata.reqToPresent = true;
    }
    // If hand is raised and invited to stage, then we let the put them on stage
    else if (metadata.requested_to_call) {
      permission.canPublish = true;
      metadata.invited_to_stage = true;
      metadata.requested_to_call = false;
      metadata.reqToPresent = false;
    }

    await this.roomService.updateParticipant(
      session.room_name,
      session.identity,
      JSON.stringify(metadata),
      permission
    );
    return {
      message: "Success",
    };
  }

  async userReqToPresentAudio(
    session: Session,
    {
      seatId = -1,
    }: {
      seatId: number;
    }
  ) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    const room = rooms[0];

    if (rooms.length === 0 || !session.identity) {
      throw new Error("Room does not exist");
    }
    const participant = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const permission = participant.permission || ({} as ParticipantPermission);
    const metadata = this.getOrCreateParticipantMetadata(participant);
    if (metadata.invited_to_stage) return { message: "Already on stage" };
    if (metadata.reqToPresent)
      return { message: "Already requested to present" };
    metadata.reqToPresent = true;
    metadata.reqSeatId = seatId;

    const roomMetaData =
      room.metadata && (JSON.parse(room.metadata) as RoomMetadata);

    let multi_video_room = false;
    if (roomMetaData) multi_video_room = roomMetaData?.type === "multi-video";
    const validNumPublication = await this.validateNumPublication(
      session.room_name,
      multi_video_room ? "multi-video" : "audio-only"
    );
    try {
      // If approved and invited to stage, then we let the put them on stage
      if (metadata.requested_to_call && validNumPublication) {
        permission.canPublish = true;
        metadata.invited_to_stage = true;
        metadata.requested_to_call = false;
        metadata.reqToPresent = false;
        if (metadata.reqSeatId != -1) metadata.seatId = metadata.reqSeatId;
        if (seatId != -1) metadata.seatId = seatId;
        metadata.reqSeatId = -1;

        //update the seat

        if (roomMetaData && roomMetaData.seats) {
          const seat = roomMetaData.seats.find((seat) => seat.id == seatId);
          if (seat) {
            seat.assignedParticipant = session.identity;
            seat.locked = false;
            seat.occupied = true;
          } else {
            // place on seat isunlocked and not occupied
            const seat = roomMetaData.seats.find(
              (seat) => !seat.occupied && !seat.locked
            );
            if (seat) {
              seat.assignedParticipant = session.identity;
              seat.locked = false;
              seat.occupied = true;
            }
          }
          await this.roomService.updateRoomMetadata(
            session.room_name,
            JSON.stringify(roomMetaData)
          );
        }
      }

      await this.roomService.updateParticipant(
        session.room_name,
        session.identity,
        JSON.stringify(metadata),
        permission
      );
    } catch (e) {
      return {
        message: e,
      };
    }
    return {
      message: "Success",
    };
  }

  async toggleRequestedToCall(
    session: Session,
    { identity, setFalse = false }: ToggleRequestedToCallParams
  ) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }

    const room = rooms[0];

    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    if (creator_identity != session.identity && !identity) {
      identity = session.identity;
    }
    const participant = await this.roomService.getParticipant(
      session.room_name,
      identity
    );

    const metadata = this.getOrCreateParticipantMetadata(participant);

    const requesterInfo = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const requesterMetaData =
      this.getOrCreateParticipantMetadata(requesterInfo);

    if (
      !setFalse &&
      creator_identity !== session.identity &&
      !requesterMetaData?.isAdmin
    ) {
      throw new Error("Only the Admin, user can set this to true");
    }

    const permission = participant.permission || ({} as ParticipantPermission);
    metadata.requested_to_call = true;

    if (setFalse) {
      metadata.requested_to_call = false;
      metadata.invited_to_stage = false;
      await this.roomService.updateParticipant(
        session.room_name,
        identity,
        JSON.stringify(metadata),
        permission
      );
      return { message: "success removed requested to call" };
    }
    const validNumPublication = await this.validateNumPublication(
      session.room_name
    );
    //only 5 publishers are allowed
    if (!validNumPublication) {
      metadata.invited_to_stage = false;
      permission.canPublish = false;
      metadata.requested_to_call = false;
    }
    //make speaker
    else if (metadata.reqToPresent) {
      metadata.requested_to_call = false;
      permission.canPublish = true;
      metadata.invited_to_stage = true;
      metadata.reqToPresent = false;
    }
    await this.roomService.updateParticipant(
      session.room_name,
      identity,
      JSON.stringify(metadata),
      permission
    );

    if (!validNumPublication)
      return { message: "5 person on video. Wait for availability" };
    return { message: "success requested to call" };
  }

  //merge room
  async EndPkRoom(session: Session) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }
    const room = rooms[0];
    const srcRoomMetadata = JSON.parse(room.metadata) as RoomMetadata;
    const creator_identity = srcRoomMetadata.creator_identity;

    if (creator_identity != session.identity) {
      return { message: "Only the Creator can end meeting" };
    }

    // getParticipant from room services and set token to ""

    const creator_info = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );

    const creator_metadata = this.getOrCreateParticipantMetadata(creator_info);

    const pkRoomToken = creator_metadata.pkRoomToken;

    if (pkRoomToken != "") {
      const targetRoomToken = jwt.decode(pkRoomToken);
      // set to defaults
      creator_metadata.pkRoomToken = "";
      srcRoomMetadata.pkSrcTtl = undefined;
      srcRoomMetadata.pkTarTtl = undefined;

      if (targetRoomToken) {
        //@ts-ignore
        const targetRoom = targetRoomToken.video?.room;

        const target_rooms = await this.roomService.listRooms([targetRoom]);

        // get targetRoom metadata and creator and update tokens

        const target_room_info = target_rooms[0];
        const targetRoomMetadata = JSON.parse(
          target_room_info.metadata
        ) as RoomMetadata;
        const target_creator_identity = targetRoomMetadata.creator_identity;

        const target_creator_info = await this.roomService.getParticipant(
          targetRoom,
          target_creator_identity
        );

        const target_creator_metadata =
          this.getOrCreateParticipantMetadata(target_creator_info);

        // set to defaults
        target_creator_metadata.pkRoomToken = "";
        targetRoomMetadata.pkSrcTtl = undefined;
        targetRoomMetadata.pkTarTtl = undefined;

        //remove participants connections to rooms

        await this.roomService.removeParticipant(
          session.room_name,
          target_creator_identity
        );
        await this.roomService.removeParticipant(targetRoom, session.identity);
        //update the participants and rooms metadata

        await this.roomService.updateParticipant(
          session.room_name,
          session.identity,
          JSON.stringify(creator_metadata)
        );
        await this.roomService.updateParticipant(
          targetRoom,
          target_creator_identity,
          JSON.stringify(target_creator_metadata)
        );

        await this.roomService.updateRoomMetadata(
          session.room_name,
          JSON.stringify(srcRoomMetadata)
        );
        await this.roomService.updateRoomMetadata(
          targetRoom,
          JSON.stringify(targetRoomMetadata)
        );
      }
    }

    return {
      message: "Successfully removed from PK Mode",
    };
  }

  // async TeamRoomEnd(session: Session) {
  //   const rooms = await this.roomService.listRooms([session.room_name]);

  //   if (rooms.length === 0) {
  //     throw new Error("Room does not exist");
  //   }
  //   const room = rooms[0];
  //   const srcRoomMetadata = JSON.parse(room.metadata) as RoomMetadata;
  //   const team_mode = srcRoomMetadata.team_mode;
  //   const team_room = team_mode?.team_room;

  //   if (!team_room) return { message: "No Team Room Found" };
  //   const teamRooms = await this.roomService.listRooms([team_room]);
  //   const teamRoom = teamRooms[0];
  //   if (team_mode.team_admin == "You") {
  //     const participants = await this.roomService.listParticipants(team_room);

  //     //get participants metadata.from_room set teamRoomToken to ""

  //     participants.forEach(async (p) => {
  //       const metadata = this.getOrCreateParticipantMetadata(p);

  //       //get from_room and set token to ""

  //       const from_room = metadata.from_room;
  //       const cur_participant_info = await this.roomService.getParticipant(
  //         from_room,
  //         p.identity
  //       );

  //       // set rooms metadata.team_mode to undefined

  //       const cur_rooms = await this.roomService.listRooms([from_room]);

  //       const cur_room = cur_rooms[0];
  //       const cur_participant_metadata =
  //         this.getOrCreateParticipantMetadata(cur_participant_info);

  //       cur_participant_metadata.teamRoomToken = "";
  //       await this.roomService.updateParticipant(
  //         from_room,
  //         p.identity,
  //         JSON.stringify(cur_participant_metadata)
  //       );
  //     });
  //   }

  //   try {
  //     const participant_info = await this.roomService.getParticipant(
  //       team_room,
  //       session.identity
  //     );
  //   } catch (e) {
  //     return { message: "No Participant Found" };
  //   }
  //   const participant_info = await this.roomService.getParticipant(
  //     team_room,
  //     session.identity
  //   );
  //   const participant_info_metadata =
  //     this.getOrCreateParticipantMetadata(participant_info);
  //   const decoded_user_token = jwt.decode(
  //     participant_info_metadata.teamRoomToken
  //   );
  //   //@ts-ignore
  //   const participant_team_room = decoded_user_token.video?.room;
  //   if (
  //     creator_identity != session.identity &&
  //     participant_team_room != team_room
  //   ) {
  //     return { message: "Only the Creator are Authorized" };
  //   }

  //   // getParticipant from room services and set token to ""
  //   const creator_info = await this.roomService.getParticipant(
  //     session.room_name,
  //     session.identity
  //   );

  //   const creator_metadata = this.getOrCreateParticipantMetadata(creator_info);

  //   const pkRoomToken = creator_metadata.pkRoomToken;

  //   if (pkRoomToken != "") {
  //     const targetRoomToken = jwt.decode(pkRoomToken);
  //     // set to defaults
  //     creator_metadata.pkRoomToken = "";
  //     srcRoomMetadata.pkSrcTtl = undefined;
  //     srcRoomMetadata.pkTarTtl = undefined;

  //     if (targetRoomToken) {
  //       //@ts-ignore
  //       const targetRoom = targetRoomToken.video?.room;

  //       const target_rooms = await this.roomService.listRooms([targetRoom]);

  //       // get targetRoom metadata and creator and update tokens

  //       const target_room_info = target_rooms[0];
  //       const targetRoomMetadata = JSON.parse(
  //         target_room_info.metadata
  //       ) as RoomMetadata;
  //       const target_creator_identity = targetRoomMetadata.creator_identity;

  //       const target_creator_info = await this.roomService.getParticipant(
  //         targetRoom,
  //         target_creator_identity
  //       );

  //       const target_creator_metadata =
  //         this.getOrCreateParticipantMetadata(target_creator_info);

  //       // set to defaults
  //       target_creator_metadata.pkRoomToken = "";
  //       targetRoomMetadata.pkSrcTtl = undefined;
  //       targetRoomMetadata.pkTarTtl = undefined;

  //       //remove participants connections to rooms

  //       await this.roomService.removeParticipant(
  //         session.room_name,
  //         target_creator_identity
  //       );
  //       await this.roomService.removeParticipant(targetRoom, session.identity);
  //       //update the participants and rooms metadata

  //       await this.roomService.updateParticipant(
  //         session.room_name,
  //         session.identity,
  //         JSON.stringify(creator_metadata)
  //       );
  //       await this.roomService.updateParticipant(
  //         targetRoom,
  //         target_creator_identity,
  //         JSON.stringify(target_creator_metadata)
  //       );

  //       await this.roomService.updateRoomMetadata(
  //         session.room_name,
  //         JSON.stringify(srcRoomMetadata)
  //       );
  //       await this.roomService.updateRoomMetadata(
  //         targetRoom,
  //         JSON.stringify(targetRoomMetadata)
  //       );
  //     }
  //   }

  //   return {
  //     message: "Successfully removed from PK Mode",
  //   };
  // }

  async SetChatMessages(
    session: Session,
    { enable_chat = true }: { enable_chat: boolean }
  ) {
    const rooms = await this.roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }
    const room = rooms[0];
    const RoomMetadata = JSON.parse(room.metadata) as RoomMetadata;
    const creator_identity = RoomMetadata.creator_identity;

    if (creator_identity != session.identity) {
      return { message: "Only the Creator can set Chat Messages Access" };
    }

    RoomMetadata.enable_chat = enable_chat;
    // getParticipant from room services and set token to

    await this.roomService.updateRoomMetadata(
      session.room_name,
      JSON.stringify(RoomMetadata)
    );

    // Send notification to the participant
    const notification = {
      action: "SetChatMessages",
      enable_chat: enable_chat,
    };
    const strNotification = JSON.stringify(notification);
    const encoder = new TextEncoder();
    const data = encoder.encode(strNotification);

    await this.roomService.sendData(
      session.room_name,
      data,
      DataPacket_Kind.RELIABLE
    );

    return {
      message: "Chat Messages Access Updated Successfully",
    };
  }

  /*Invite to Battle Modes */
  async PkRoomInvite(
    session: Session,
    {
      room_name,
      type = "random",
      ttl = "1h",
      end = false,
    }: {
      room_name?: string;
      type?: "random" | "team v/s 6" | "team v/s 4" | "mutual friend";
      ttl?: string | number;
      end?: boolean;
    }
  ) {
    try {
      if (room_name == session.room_name) {
        return {
          message: "Can't find room to merge!",
        };
      }

      if (room_name) {
        const response = await this.inviteToPkMode(
          room_name,
          session.identity,
          session.room_name,
          ttl,
          type
        );
        if (response?.accepted) {
          return {
            message: response,
          };
        } else {
          return {
            message: "User declined the call",
          };
        }
      }
      const rooms = await this.roomService.listRooms();

      const roomsNotInPk = rooms.filter((room) => {
        const cur_metadata = JSON.parse(room.metadata) as RoomMetadata;
        return (
          !cur_metadata.pkSrcTtl &&
          !cur_metadata.pkTarTtl &&
          room.name !== session.room_name &&
          !cur_metadata.team_mode
        );
      });

      if (roomsNotInPk.length === 0) {
        throw new Error("Room does not exist");
      }

      let isAccepted = false;

      while (!isAccepted) {
        const randomIndex = Math.floor(Math.random() * roomsNotInPk.length);
        const response = await this.inviteToPkMode(
          roomsNotInPk[randomIndex].name,
          session.identity,
          session.room_name,
          ttl,
          type
        );

        if (response?.accepted) {
          isAccepted = true;
        }
      }
    } catch (e) {
      return {
        message: e,
      };
    }
    if (this.endMergeRoom) {
      return {
        message: "Ended Inviting New Rooms",
      };
    }
    return { message: "success Invited to call" };
  }

  async inviteToPkMode(
    room_name: string,
    session_identity: string,
    session_room_name: string,

    ttl: string | number,
    type?: "random" | "team v/s 6" | "team v/s 4" | "mutual friend"
  ) {
    const rooms = await this.roomService.listRooms([session_room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }
    const room = rooms[0];
    const roomMetadata = JSON.parse(room.metadata) as RoomMetadata;
    const creator_identity = roomMetadata.creator_identity;

    const requestedRoom = await this.roomService.listRooms([room_name]);
    if (requestedRoom.length == 0) {
      return { message: "Room does not exist" };
    }
    const reqRoomMetaData = JSON.parse(
      requestedRoom[0].metadata
    ) as RoomMetadata;

    const creatorToInvite = reqRoomMetaData.creator_identity;

    if (creator_identity !== session_identity) {
      throw new Error("Only the Creator can set this to true");
    }

    //pre-checks for invites validation

    if (roomMetadata.team_mode || reqRoomMetaData.team_mode) {
      return { message: "Can't merge two team rooms" };
    } else if (roomMetadata.pkSrcTtl || roomMetadata.pkTarTtl) {
      return { message: "Already in a PK Room" };
    } else if (reqRoomMetaData.pkSrcTtl || reqRoomMetaData.pkTarTtl) {
      return { message: "Requested User already in a PK Room" };
    }
    //invite the creator to call
    const notification = {
      action: "invitePkRoom",
      creator_identity: session_identity,
      room_name: session_room_name,
      type,
      ttl,
    };
    const strNotification = JSON.stringify(notification);
    const encoder = new TextEncoder();
    const data = encoder.encode(strNotification);

    await this.roomService.sendData(room_name, data, DataPacket_Kind.RELIABLE, {
      destinationIdentities: [creatorToInvite],
    });

    const inviteAccepted = await this.waitForInviteResponse(
      session_room_name,
      5000
    );

    return { accepted: inviteAccepted };
  }

  async waitForInviteResponse(
    session_room_name: string,
    timeout: number
  ): Promise<boolean> {
    try {
      console.log("waiting for acceptance ...");
      // Wait for the specified timeout
      await new Promise((resolve) => setTimeout(resolve, timeout));

      // Fetch rooms after the timeout
      const rooms = await this.roomService.listRooms([session_room_name]);
      const room = rooms[0];
      const metadata = JSON.parse(room.metadata) as RoomMetadata;
      const accepted = !!metadata.pkSrcTtl || !!metadata.pkTarTtl;

      return accepted;
    } catch (error) {
      console.error("Error in waitForInviteResponse:", error);
      return false;
    }
  }

  // invite to team

  async TeamRoomInvite(
    session: Session,
    {
      room_name,
      type = "team v/s 6",
      ttl = "1h",
    }: {
      room_name: string;
      type: "random" | "team v/s 6" | "team v/s 4" | "mutual friend";
      ttl?: string | number;
    }
  ) {
    /* */
    const rooms = await this.roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }
    const room = rooms[0];
    const room_metadata = JSON.parse(room.metadata) as RoomMetadata;
    const creator_identity = room_metadata.creator_identity;

    const requested_room = await this.roomService.listRooms([room_name]);
    if (requested_room.length == 0) {
      return { message: "Room does not exist" };
    }
    const req_room_metadata = JSON.parse(
      requested_room[0].metadata
    ) as RoomMetadata;

    const creatorToInvite = req_room_metadata.creator_identity;

    if (creator_identity !== session.identity) {
      throw new Error("Only the creator could invite");
    }

    //pre-checks for invites validation
    if (req_room_metadata.team_mode) {
      return { message: "Can't merge two team rooms" };
    } else if (room_metadata.pkSrcTtl || room_metadata.pkTarTtl) {
      return { message: "Already in a PK Room" };
    } else if (req_room_metadata.pkSrcTtl || req_room_metadata.pkTarTtl) {
      return { message: "Requested User already in a PK Room" };
    }
    let notification = {
      action: "invitePkRoom",
      creator_identity: session.identity,
      room_name: session.room_name,
      type,
      ttl,
      defendingTeam: false,
    };
    // check if creator is admin of team and has invites left
    if (room_metadata.team_mode) {
      const creator_info = await this.roomService.getParticipant(
        session.room_name,
        session.identity
      );

      if (creator_info.identity == room_metadata.team_mode.team_admin) {
        const invites_available =
          type == "team v/s 4"
            ? room_metadata.team_mode.invites < 1
            : room_metadata.team_mode.invites < 2;
        if (!invites_available) {
          return {
            message: "Can't invite more team members",
          };
        }
      } else {
        return {
          message: "Only admin of team can invite to Team Room",
        };
      }

      notification.ttl = room_metadata.team_mode.ttl;
      notification.defendingTeam = room_metadata.team_mode.defendingTeam;
    }
    //invite the creator to call

    const strNotification = JSON.stringify(notification);
    const encoder = new TextEncoder();
    const data = encoder.encode(strNotification);

    await this.roomService.sendData(room_name, data, DataPacket_Kind.RELIABLE, {
      destinationIdentities: [creatorToInvite],
    });
  }
  async toggleRequestedToCallAudio(
    session: Session,
    { identity, setFalse = false }: ToggleRequestedToCallParams
  ) {
    try {
      const rooms = await this.roomService.listRooms([session.room_name]);

      if (rooms.length === 0) {
        throw new Error("Room does not exist");
      }

      const room = rooms[0];

      const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
        .creator_identity;
      if (creator_identity != session.identity && !identity) {
        identity = session.identity;
      }
      const participant = await this.roomService.getParticipant(
        session.room_name,
        identity
      );
      const metadata = this.getOrCreateParticipantMetadata(participant);

      const requesterInfo = await this.roomService.getParticipant(
        session.room_name,
        session.identity
      );
      const requesterMetaData =
        this.getOrCreateParticipantMetadata(requesterInfo);

      if (
        !setFalse &&
        creator_identity !== session.identity &&
        !requesterMetaData?.isAdmin
      ) {
        throw new Error("Only the Admin can set this to true");
      }
      const roomMetaData =
        room.metadata && (JSON.parse(room.metadata) as RoomMetadata);

      const permission =
        participant.permission || ({} as ParticipantPermission);
      metadata.requested_to_call = true;

      let multi_video_room = false;
      if (roomMetaData) multi_video_room = roomMetaData.type === "multi-video";
      if (setFalse) {
        metadata.requested_to_call = false;
        metadata.invited_to_stage = false;
        metadata.reqToPresent = false;

        metadata.seatId = -1;
        metadata.reqSeatId = -1;
        await this.roomService.updateParticipant(
          session.room_name,
          identity,
          JSON.stringify(metadata),
          permission
        );
        return { message: "success removed requested to call" };
      }
      const validNumPublication = await this.validateNumPublication(
        session.room_name,
        multi_video_room ? "multi-video" : "audio-only"
      );
      //only 9 publishers for audio and 5 for multi video are allowed
      if (!validNumPublication) {
        metadata.invited_to_stage = false;
        permission.canPublish = false;
        metadata.requested_to_call = false;
      }
      //make speaker
      else if (metadata.reqToPresent) {
        metadata.requested_to_call = false;
        permission.canPublish = true;
        metadata.invited_to_stage = true;
        metadata.reqToPresent = false;

        //update the audio room

        metadata.seatId = metadata.reqSeatId;
        metadata.reqSeatId = -1;

        if (roomMetaData && metadata.reqSeatId != -1) {
          const seat = roomMetaData.seats?.find(
            (seat) => seat.id == metadata.seatId
          );
          if (seat) {
            seat.assignedParticipant = identity;
            seat.occupied = true;
          }

          await this.roomService.updateRoomMetadata(
            session.room_name,
            JSON.stringify(roomMetaData)
          );
        }
      }
      await this.roomService.updateParticipant(
        session.room_name,
        identity,
        JSON.stringify(metadata),
        permission
      );

      if (!validNumPublication)
        return {
          message: `${
            multi_video_room ? "5" : "9"
          } person on video. Wait for availability`,
        };
    } catch (e) {
      return {
        message: e,
      };
    }
    return { message: "success requested to call" };
  }

  async pkRoomMerge(
    session: Session,
    {
      room_name,
      ttl = 900,
    }: {
      room_name: string;
      ttl?: string | number;
    }
  ) {
    try {
      //Invited Creator track
      const rooms = await this.roomService.listRooms([room_name]);
      const room = rooms[0];
      const tarRooms = await this.roomService.listRooms([session.room_name]);

      const tarRoom = tarRooms[0];

      const roomMetaData = JSON.parse(room.metadata) as RoomMetadata;
      const targetRoomMetaData = JSON.parse(tarRoom.metadata) as RoomMetadata;

      const creator_identity = roomMetaData.creator_identity;

      const srcCreatorInfo = await this.roomService.getParticipant(
        room_name,
        creator_identity
      );

      //come here
      const targCreatorInfo = await this.roomService.getParticipant(
        session.room_name,
        session.identity
      );

      if (
        roomMetaData.pkSrcTtl ||
        roomMetaData.pkTarTtl ||
        targetRoomMetaData.pkTarTtl
      ) {
        console.log("Can't find available rooms to merge");
        return {
          message: "Can't find available rooms to merge",
        };
      }

      const sourceToken = await this.generateToken(
        session.room_name,
        creator_identity,
        {
          canSubscribe: true,
          canPublish: true,
          ttl: ttl,
        }
      );
      const targetToken = await this.generateToken(
        room_name,
        session.identity,
        {
          canSubscribe: true,
          canPublish: true,
          ttl: ttl,
        }
      );
      console.log("<Tokens available>");
      // attach with metadata client on frontend

      /*source room participants add token to metadata */

      const src_metadata = this.getOrCreateParticipantMetadata(srcCreatorInfo);

      src_metadata.pkRoomToken = sourceToken;
      await this.roomService.updateParticipant(
        room_name,
        srcCreatorInfo.identity,
        JSON.stringify(src_metadata),
        srcCreatorInfo.permission
      );

      const tar_metadata = this.getOrCreateParticipantMetadata(targCreatorInfo);

      tar_metadata.pkRoomToken = targetToken;
      await this.roomService.updateParticipant(
        session.room_name,
        session.identity,
        JSON.stringify(tar_metadata),
        targCreatorInfo.permission
      );

      targetRoomMetaData.pkTarTtl = {
        ttl: ttl,
        createdAt: new Date().toISOString(),
      };

      roomMetaData.pkSrcTtl = {
        ttl: ttl,
        createdAt: new Date().toISOString(),
      };

      //update current rooms metadata

      await this.roomService.updateRoomMetadata(
        room_name,
        JSON.stringify(roomMetaData)
      );

      await this.roomService.updateRoomMetadata(
        session.room_name,
        JSON.stringify(targetRoomMetaData)
      );

      console.log("merge success.....");
      /*send notification to room creators */

      const notification = {
        action: "PkRoomMerge",
        message: "You are in PK battle now",
      };

      const strNotification = JSON.stringify(notification);
      const encoder = new TextEncoder();
      const data = encoder.encode(strNotification);

      await this.roomService.sendData(
        session.room_name,
        data,
        DataPacket_Kind.RELIABLE
      );

      await this.roomService.sendData(
        room_name,
        data,
        DataPacket_Kind.RELIABLE
      );

      // after ttl clear all the tokens and metadata about merging

      if (typeof ttl === "string") {
        ttl = this.convertTTLToSec(ttl);
      }

      //come up
      setTimeout(async () => {
        const srcCreatorInfo = await this.roomService.getParticipant(
          room_name,
          creator_identity
        );
        const src_metadata =
          this.getOrCreateParticipantMetadata(srcCreatorInfo);

        if (src_metadata.pkRoomToken != sourceToken) {
          return {
            message: "PK mode closed TTL expired",
          };
        }
        src_metadata.pkRoomToken = "";
        await this.roomService.updateParticipant(
          room_name,
          creator_identity,
          JSON.stringify(src_metadata),
          srcCreatorInfo.permission
        );
        tar_metadata.pkRoomToken = "";
        await this.roomService.updateParticipant(
          session.room_name,
          session.identity,
          JSON.stringify(tar_metadata),
          targCreatorInfo.permission
        );

        targetRoomMetaData.pkTarTtl = undefined;
        roomMetaData.pkSrcTtl = undefined;

        await this.roomService.updateRoomMetadata(
          room_name,
          JSON.stringify(roomMetaData)
        );

        await this.roomService.updateRoomMetadata(
          session.room_name,
          JSON.stringify(targetRoomMetaData)
        );

        return {
          message: "PK mode closed TTL expired",
        };
      }, ttl * 1000);

      return {
        message: "Success rooms merged",
      };
    } catch (e: any) {
      console.log("error in pkRoomMerge:", e);
      return {
        message: e.message,
      };
    }
  }

  /*Team Mode Merge rooms */
  async TeamModeMergeRooms(
    session: Session,
    {
      room_name,
      ttl = 900,
    }: {
      room_name: string;
      ttl?: string | number;
    }
  ) {
    try {
      //Team  tracks
      const src_rooms = await this.roomService.listRooms([room_name]);
      const src_room = src_rooms[0];

      //as flow is like api will be called when target accepts invite
      const tar_rooms = await this.roomService.listRooms([session.room_name]);
      const tar_room = tar_rooms[0];

      //src & tar rooms metadata's
      const src_room_metadata = JSON.parse(src_room.metadata) as RoomMetadata;
      const tar_room_metadata = JSON.parse(tar_room.metadata) as RoomMetadata;

      /*save team mode stats for cleanup function */

      const src_room_metadata_team_mode = src_room_metadata.team_mode;
      const tar_room_metadata_team_mode = tar_room_metadata.team_mode;

      //tar & src_room_creator info& metadata
      //step:1
      const src_room_creator_identity = src_room_metadata.creator_identity;
      const src_room_creator_info = await this.roomService.getParticipant(
        room_name,
        src_room_creator_identity
      );
      const src_room_creator_metadata = this.getOrCreateParticipantMetadata(
        src_room_creator_info
      );

      //step:2 same as step:1
      const tar_room_creator_info = await this.roomService.getParticipant(
        session.room_name,
        session.identity
      );
      const tar_room_creator_metadata = this.getOrCreateParticipantMetadata(
        tar_room_creator_info
      );

      const team_room = generateRoomId();
      /*Check for merge conditions */

      if (
        (src_room_metadata.team_mode && tar_room_metadata.team_mode) ||
        src_room_metadata.pkSrcTtl ||
        src_room_metadata.pkTarTtl ||
        tar_room_metadata.pkSrcTtl ||
        tar_room_metadata.pkTarTtl
      ) {
        //rooms are already merged
        return {
          message: "Can't find available rooms to merge",
        };
      } else if (src_room_metadata.team_mode && !tar_room_metadata.team_mode) {
        if (src_room_metadata.team_mode.invites) {
          const invites_available =
            src_room_creator_metadata.type == "Team v/s 4"
              ? src_room_metadata.team_mode.invites < 1
              : src_room_metadata.team_mode.invites < 2;

          if (!invites_available) {
            return {
              message: "Maximum Invites limit reached for admin",
            };
          }
        }

        const team_room = src_room_metadata.team_mode.team_room;
        //!important
        /*Add invited(target) room to all rooms in Same_Team Room */
        const createdAt = new Date(
          src_room_metadata.team_mode.createdAt
        ).getTime();
        const currentTime = new Date().getTime();
        const elapsedTime = Math.floor((currentTime - createdAt) / 1000);

        //ttl is decided of when first time team got created
        let ttl = src_room_metadata.team_mode.ttl;
        if (typeof ttl === "string") {
          ttl = this.convertTTLToSec(ttl);
        }
        const remaining_TTL = ttl - elapsedTime;
        if (remaining_TTL <= 0) {
          return {
            message: "Team Room TTL has expired",
          };
        }

        const all_rooms = await this.roomService.listRooms();
        //If TTl than change states of src_room and tar_room metadata

        src_room_metadata.team_mode.invites =
          src_room_metadata.team_mode.invites + 1;
        tar_room_metadata.team_mode = src_room_metadata.team_mode;
        tar_room_metadata.team_mode.invites = 0;
        tar_room_metadata.team_mode.members = [];

        // add the target(invited) room to each Room In same Team

        for (const room of all_rooms) {
          //get room metadata
          const room_metadata = JSON.parse(room.metadata) as RoomMetadata;

          //get cur_team_rooms
          if (room_metadata.team_mode?.team_room == team_room) {
            //add tar to cur_room as in same-team-room
            console.log("--- ", room.name, "-------");
            const tar_access_to_room_token = await this.generateToken(
              room.name,
              tar_room_metadata.creator_identity,
              {
                canSubscribe: true,
                canPublish: true,
                ttl: remaining_TTL,
              }
            );

            //add target-creator as member for other rooms
            room_metadata.team_mode.members.push(
              tar_room_metadata.creator_identity
            );

            //push tokens to access_tokens_list of tar_room_creator
            if (tar_room_creator_metadata.team_access_tokens_list) {
              tar_room_creator_metadata.team_access_tokens_list.push(
                tar_access_to_room_token
              );
            } else {
              tar_room_creator_metadata.team_access_tokens_list = [
                tar_access_to_room_token,
              ];
            }

            //generate access token for other rooms in team to join target(invited) room

            //step: 1 create token for cur_room_creator
            const team_member_access_token = await this.generateToken(
              session.room_name,
              room_metadata.creator_identity,
              {
                canSubscribe: true,
                canPublish: true,
                ttl: remaining_TTL,
              }
            );

            //build team-members for target room
            tar_room_metadata.team_mode.members.push(
              room_metadata.creator_identity
            );

            // step 2: update cur_room creator team_access_tokens_list

            const cur_room_creator_info = await this.roomService.getParticipant(
              room.name,
              room_metadata.creator_identity
            );

            const cur_room_creator_metadata =
              this.getOrCreateParticipantMetadata(cur_room_creator_info);

            console.log(
              "   be:: list",
              cur_room_creator_metadata?.team_access_tokens_list?.length
            );
            cur_room_creator_metadata.team_access_tokens_list?.push(
              team_member_access_token
            );

            //step 3: update cur_room creator metadata
            if (
              src_room.name == room.name &&
              src_room_metadata.creator_identity ==
                room_metadata.creator_identity
            ) {
              src_room_creator_metadata.team_access_tokens_list =
                cur_room_creator_metadata.team_access_tokens_list;

              src_room_metadata.team_mode.members =
                room_metadata.team_mode.members;
            }
            await this.roomService.updateParticipant(
              room.name,
              cur_room_creator_info.identity,
              JSON.stringify(cur_room_creator_metadata),
              cur_room_creator_info.permission
            );

            await this.roomService.updateRoomMetadata(
              room.name,
              JSON.stringify(room_metadata)
            );

            /*Done updating cur_room & target room req */
          }
        }
      } else if (!src_room_metadata.team_mode && !tar_room_metadata.team_mode) {
        //create team room

        //step:1 first create auth tokens to join each other rooms
        const src_room_access_token_for_target = await this.generateToken(
          room_name,
          session.identity,
          {
            canSubscribe: true,
            canPublish: true,
            ttl: ttl,
          }
        );

        const tar_room_access_token_for_src = await this.generateToken(
          session.room_name,
          src_room_creator_identity,
          {
            canSubscribe: true,
            canPublish: true,
            ttl: ttl,
          }
        );

        const members_list_tar = [src_room_creator_info.identity];
        const members_list_src = [tar_room_creator_info.identity];
        //step:2 update both rooms metadata
        src_room_metadata.team_mode = {
          team_room: team_room,
          team_admin: src_room_creator_identity,
          invites: 0,
          ttl: ttl,
          defendingTeam: true,
          createdAt: new Date().toISOString(),
          members: members_list_src,
        };

        tar_room_metadata.team_mode = {
          team_room: team_room,
          team_admin: session.identity,
          invites: 0,
          ttl: ttl,
          defendingTeam: false,
          createdAt: new Date().toISOString(),
          members: members_list_tar,
        };

        //step:3 update both rooms creators metadata
        src_room_creator_metadata.team_access_tokens_list = [
          tar_room_access_token_for_src,
        ];

        tar_room_creator_metadata.team_access_tokens_list = [
          src_room_access_token_for_target,
        ];
      }

      //last step save all changes

      //step:1 update rooms metadata
      await this.roomService.updateRoomMetadata(
        src_room.name,
        JSON.stringify(src_room_metadata)
      );

      await this.roomService.updateRoomMetadata(
        tar_room.name,
        JSON.stringify(tar_room_metadata)
      );

      //step:2 updates creators metadata

      await this.roomService.updateParticipant(
        src_room.name,
        src_room_creator_identity,
        JSON.stringify(src_room_creator_metadata),
        src_room_creator_info.permission
      );

      await this.roomService.updateParticipant(
        tar_room.name,
        tar_room_creator_info.identity,
        JSON.stringify(tar_room_creator_metadata),
        tar_room_creator_info.permission
      );

      /*Clear the changes after ttl passed */
      if (typeof ttl === "string") {
        ttl = this.convertTTLToSec(ttl);
      }
      setTimeout(async () => {
        console.log("Clearing team room......", team_room, "cur ttl:", ttl);

        if (src_room_metadata_team_mode || tar_room_metadata_team_mode) {
          return;
        }
        const all_rooms = await this.roomService.listRooms();

        for (const room of all_rooms) {
          //get room metadata
          const room_metadata = JSON.parse(room.metadata) as RoomMetadata;

          //delete cur_team_rooms
          if (room_metadata.team_mode?.team_room == team_room) {
            /*remove all the participants of team from cur room */

            const cur_room_creator = await this.roomService.getParticipant(
              room.name,
              room_metadata.creator_identity
            );

            const cur_room_creator_metadata =
              this.getOrCreateParticipantMetadata(cur_room_creator);

            cur_room_creator_metadata.team_access_tokens_list = [];

            //clear access tokens of participants and remove from room;

            const team_members = room_metadata.team_mode.members;

            try {
              for (const member_identity of team_members) {
                await this.roomService.removeParticipant(
                  room.name,
                  member_identity
                );
              }
            } catch (e) {
              console.log("cleanup rooms team members", e);
            }

            await this.roomService.updateParticipant(
              room.name,
              cur_room_creator.identity,
              JSON.stringify(cur_room_creator_metadata),
              cur_room_creator.permission
            );
            room_metadata.team_mode = undefined;

            await this.roomService.updateRoomMetadata(
              room.name,
              JSON.stringify(room_metadata)
            );
            /*Done  cleanup run after ttl expires*/
          }
        }
      }, ttl * 1000);
    } catch (e: any) {
      return {
        message: e.message,
      };
    }

    return {
      message:
        "success provided clients with auth tokens to publish and subscribe",
    };
  }

  convertTTLToSec(ttl: string): number {
    const timeValue = parseInt(ttl.slice(0, -1));
    const timeUnit = ttl.slice(-1);

    switch (timeUnit) {
      case "h":
        return timeValue * 60 * 60; // Convert hours to milliseconds
      case "m":
        return timeValue * 60; // Convert minutes to milliseconds
      case "d":
        return timeValue * 24 * 60 * 60;
      default:
        throw new Error("Invalid TTL format");
    }
  }

  async generateToken(
    roomName: string,
    identity: string,
    permissions: any = {},
    metadata: any = {}
  ) {
    const token = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity,
        ttl: permissions.ttl || 900,
      }
    );
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublishData: true,
      ...permissions,
    });

    const tk = await token.toJwt();

    return tk;
  }

  /*TeamRoomEnd */
  async TeamRoomEnd(session: Session) {
    const requester_rooms = await this.roomService.listRooms([
      session.room_name,
    ]);
    const requester_room = requester_rooms[0];
    const requester_room_metadata = JSON.parse(
      requester_room.metadata
    ) as RoomMetadata;

    const team_room = requester_room_metadata.team_mode?.team_room;

    if (
      !team_room ||
      session.identity != requester_room_metadata.team_mode?.team_admin
    ) {
      console.log("end-team: only admins can send end request");
      return {
        message: "Only the admins can end the team room",
      };
    }
    const all_rooms = await this.roomService.listRooms();

    for (const room of all_rooms) {
      //get room metadata
      const room_metadata = JSON.parse(room.metadata) as RoomMetadata;

      //delete cur_team_rooms
      if (room_metadata.team_mode?.team_room == team_room) {
        /*remove all the participants of team from cur room */

        const cur_room_creator = await this.roomService.getParticipant(
          room.name,
          room_metadata.creator_identity
        );

        const cur_room_creator_metadata =
          this.getOrCreateParticipantMetadata(cur_room_creator);

        cur_room_creator_metadata.team_access_tokens_list = [];
        await this.roomService.updateParticipant(
          room.name,
          cur_room_creator.identity,
          JSON.stringify(cur_room_creator_metadata),
          cur_room_creator.permission
        );

        /** for testing only */
        const temp_cre = await this.roomService.getParticipant(
          room.name,
          room_metadata.creator_identity
        );
        const temp_cre_metadata = this.getOrCreateParticipantMetadata(temp_cre);

        console.log("temp_cre_metadata", temp_cre_metadata);
        //clear access tokens of participants and remove from room;

        const team_members = room_metadata.team_mode.members;

        console.log(
          "room",
          room.name,
          "team_members",
          team_members,
          "creator: ",
          room_metadata.creator_identity
        );
        try {
          for (const member_identity of team_members) {
            await this.roomService.removeParticipant(
              room.name,
              member_identity
            );
            console.log("removed --", member_identity);
          }
        } catch (e) {
          console.log("Unable to remove participant", e);
        }

        room_metadata.team_mode = undefined;

        await this.roomService.updateRoomMetadata(
          room.name,
          JSON.stringify(room_metadata)
        );

        /**for testing */
        const temp_room = await this.roomService.listRooms([room.name]);
        const temp_room_metadata = JSON.parse(
          temp_room[0].metadata
        ) as RoomMetadata;
        console.log("up:team_mode", temp_room_metadata.team_mode);
        /*Done  cleanup run after ttl expires*/
      }
    }
  }

  // Remove RemoveTeamMember
  async RemoveTeamMember(session: Session, { identity }: { identity: string }) {
    const s_rooms = await this.roomService.listRooms([session.room_name]);

    const s_room = s_rooms[0];
    const s_room_metadata = JSON.parse(s_room.metadata) as RoomMetadata;

    const s_room_team_admin = s_room_metadata.team_mode?.team_admin;

    if (
      !(identity == session.identity) ||
      !(session.identity == s_room_team_admin)
    ) {
      return {
        message: "Only the admin or member himself can perform removal",
      };
    }

    //step: 1
    const p = await this.roomService.getParticipant(
      session.room_name,
      identity
    );
    const p_metadata = this.getOrCreateParticipantMetadata(p);
    p_metadata.team_access_tokens_list = [];

    //step: 2  remove all team members from cur_room
    const from_room = await this.find_room_from_creator_identity(
      identity,
      s_room_metadata.team_mode?.team_room
    );

    if (!from_room) {
      console.log("can't find team room of creator");
      return {
        message: "can't find team room of creator",
      };
    }

    const from_room_metadata = JSON.parse(from_room.metadata) as RoomMetadata;
    if (!from_room_metadata.team_mode) {
      return {
        message: "can't find team room of creator",
      };
    }
    const team_members = from_room_metadata.team_mode.members;
    for (const member of team_members) {
      await this.roomService.removeParticipant(from_room.name, member);
    }

    //step: 3 remove team_mode -> r.metadata
    from_room_metadata.team_mode = undefined;
    await this.roomService.updateRoomMetadata(
      from_room.name,
      JSON.stringify(from_room_metadata)
    );

    //step: 4

    const all_rooms = await this.roomService.listRooms();

    for (const room of all_rooms) {
      //get room metadata
      const room_metadata = JSON.parse(room.metadata) as RoomMetadata;
      if (
        room_metadata.team_mode?.team_room ==
          s_room_metadata.team_mode?.team_room &&
        room.name != from_room.name
      ) {
        /*get access tokens find from_room equivalent and remove token*/
        const cur_room_creator = await this.roomService.getParticipant(
          room.name,
          room_metadata.creator_identity
        );

        const cur_room_creator_metadata =
          this.getOrCreateParticipantMetadata(cur_room_creator);

        const access_tokens = cur_room_creator_metadata.team_access_tokens_list;
        if (!access_tokens)
          throw new Error("can't find access list in other team members");

        const updated_access_list = access_tokens.filter((token) => {
          const decoded_user_token = jwt.decode(token);

          //@ts-ignore
          if (decoded_user_token && decoded_user_token.video?.room) {
            //@ts-ignore
            return decoded_user_token.video?.room !== from_room.name;
          }

          // If the token doesn't have the expected structure, keep it in the list
          return true;
        });

        cur_room_creator_metadata.team_access_tokens_list = updated_access_list;

        await this.roomService.updateParticipant(
          room.name,
          cur_room_creator.identity,
          JSON.stringify(cur_room_creator_metadata),
          cur_room_creator.permission
        );
        //update members list from team_mode

        if (room_metadata.team_mode) {
          const team_members = room_metadata.team_mode?.members;
          const updated_team_members = team_members.filter(
            (member) => member !== identity
          );
          room_metadata.team_mode.members = updated_team_members;

          //remove from room

          await this.roomService.removeParticipant(room.name, identity);
        }
        await this.roomService.updateRoomMetadata(
          room.name,
          JSON.stringify(room_metadata)
        );
      }
    }
  }

  async find_room_from_creator_identity(
    identity: string,
    team_room: string | undefined
  ) {
    const all_rooms = await this.roomService.listRooms();
    for (const room of all_rooms) {
      const room_metadata = JSON.parse(room.metadata) as RoomMetadata;

      //check creator and team_room
      if (!room_metadata.team_mode?.team_room) continue;
      if (
        room_metadata.creator_identity == identity &&
        room_metadata.team_mode?.team_room == team_room
      ) {
        return room;
      }
    }
  }
  async validateNumPublication(roomName: string, type?: string) {
    if (type === "audio-only") {
      const participants = await this.roomService.listParticipants(roomName);
      let prevPresenters = 0;
      participants.forEach((p) => {
        if (p.metadata) {
          const metadata = JSON.parse(p.metadata) as ParticipantMetadata;
          if (metadata.invited_to_stage) prevPresenters++;
        }
      });

      if (prevPresenters > 8) {
        return false;
      }
    } else {
      const participants = await this.roomService.listParticipants(roomName);
      let prevPresenters = 0;
      participants.forEach((p) => {
        if (p.metadata) {
          const metadata = JSON.parse(p.metadata) as ParticipantMetadata;
          if (metadata.invited_to_stage) prevPresenters++;
        }
      });

      if (prevPresenters > 4) {
        return false;
      }
    }
    return true;
  }
  async getRoomsList() {
    const roomsList = await this.roomService.listRooms();

    return roomsList;
  }

  async getAudioRoomWithParticipants() {
    const roomsList = await this.roomService.listRooms();
    let roomWithparticipants: any = [];

    for (const r of roomsList) {
      const metadata = r.metadata && (JSON.parse(r.metadata) as RoomMetadata);
      if (r.name && metadata && metadata.type === "audio-only") {
        const roomparticipants = await this.roomService.listParticipants(
          r.name
        );

        const cur = {
          roomInfo: r,
          participants: roomparticipants,
        };
        roomWithparticipants.push(cur);
      }
    }

    return roomWithparticipants;
  }

  async getMutliVideoRoomWithParticipants() {
    const roomsList = await this.roomService.listRooms();
    let roomWithparticipants: any = [];

    for (const r of roomsList) {
      const metadata = r.metadata && (JSON.parse(r.metadata) as RoomMetadata);
      if (r.name && metadata && metadata.type === "multi-video") {
        const roomparticipants = await this.roomService.listParticipants(
          r.name
        );

        const cur = {
          roomInfo: r,
          participants: roomparticipants,
        };
        roomWithparticipants.push(cur);
      }
    }

    return roomWithparticipants;
  }

  async muteTracks(
    session: Session,
    { identity, options = { audio: false, video: false } }: any
  ) {
    try {
      /*auth*/
      const rooms = await this.roomService.listRooms([session.room_name]);

      if (rooms.length === 0) {
        throw new Error("Room does not exist");
      }

      const room = rooms[0];
      const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
        .creator_identity;

      const requesterInfo = await this.roomService.getParticipant(
        session.room_name,
        session.identity
      );
      const requesterMetaData =
        this.getOrCreateParticipantMetadata(requesterInfo);

      if (
        creator_identity !== session.identity &&
        !requesterMetaData.isAdmin &&
        identity !== session.identity
      ) {
        throw new Error(
          "Only the creator,admin or the participant him self can mute tracks "
        );
      }

      // List participants in the room
      const participants = await this.roomService.listParticipants(
        session.room_name
      );
      const participant = participants.find((p) => p.identity === identity);

      if (!participant) {
        console.error("Participant not found");
        return;
      }

      // Mute audio tracks
      if (options.audio) {
        const audioTrack = participant.tracks.find(
          (track) => track.type === TrackType.AUDIO
        );
        if (audioTrack) {
          await this.roomService.mutePublishedTrack(
            session.room_name,
            identity,
            audioTrack.sid,
            true
          );
        }
      }

      // Mute video tracks
      if (options.video) {
        const videoTrack = participant.tracks.find(
          (track) => track.type === TrackType.VIDEO
        );
        if (videoTrack) {
          await this.roomService.mutePublishedTrack(
            session.room_name,
            identity,
            videoTrack.sid,
            true
          );
        }
      }

      // Send notification to the participant
      const notification = {
        action: "muteTracks",
        audio: options.audio,
        video: options.video,
      };
      const strNotification = JSON.stringify(notification);
      const encoder = new TextEncoder();
      const data = encoder.encode(strNotification);

      await this.roomService.sendData(
        session.room_name,
        data,
        DataPacket_Kind.RELIABLE,
        {
          destinationIdentities: [identity],
        }
      );
    } catch (error) {
      console.error("Error muting tracks:", error);
    }
    return {
      message: "Successfully Muted required Tracks",
    };
  }

  async removeFromStage(session: Session, { identity }: RemoveFromStageParams) {
    if (!identity) {
      // remove self if no identity specified
      identity = session.identity;
    }

    const rooms = await this.roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }

    const room = rooms[0];
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    const requesterInfo = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const requesterMetaData =
      this.getOrCreateParticipantMetadata(requesterInfo);

    if (
      creator_identity !== session.identity &&
      !requesterMetaData.isAdmin &&
      identity !== session.identity
    ) {
      throw new Error(
        "Only the creator or the participant him self can remove from stage"
      );
    }

    const participant = await this.roomService.getParticipant(
      session.room_name,
      identity
    );

    const permission = participant.permission || ({} as ParticipantPermission);
    const metadata = this.getOrCreateParticipantMetadata(participant);

    // Reset everything and disallow them from publishing (this will un-publish them automatically)

    metadata.invited_to_stage = false;
    metadata.requested_to_call = false;
    permission.canPublish = false;
    permission.canUpdateMetadata = false;
    metadata.reqToPresent = false;

    //update the seat allotment in room metadata

    const roomMetaData =
      room.metadata && (JSON.parse(room.metadata) as RoomMetadata);

    if (roomMetaData && metadata.seatId != -1) {
      const seat = roomMetaData.seats?.find(
        (seat) => seat.id == metadata.seatId
      );
      if (seat) {
        seat.assignedParticipant = null;
        seat.occupied = false;
      }

      await this.roomService.updateRoomMetadata(
        session.room_name,
        JSON.stringify(roomMetaData)
      );
    }

    metadata.reqSeatId = -1;
    metadata.seatId = -1;

    await this.roomService.updateParticipant(
      session.room_name,
      identity,
      JSON.stringify(metadata),
      permission
    );
  }

  async rejectUserToPresent(
    session: Session,
    {
      identity,
    }: {
      identity: string;
    }
  ) {
    if (!identity) {
      identity = session.identity;
    }

    const rooms = await this.roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }

    const room = rooms[0];
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    const requesterInfo = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const requesterMetaData =
      this.getOrCreateParticipantMetadata(requesterInfo);

    if (
      creator_identity !== session.identity &&
      !requesterMetaData.isAdmin &&
      identity !== session.identity
    ) {
      throw new Error(
        "Only the creator or the participant him self can cancel req"
      );
    }

    const participant = await this.roomService.getParticipant(
      session.room_name,
      identity
    );

    const permission = participant.permission || ({} as ParticipantPermission);
    const metadata = this.getOrCreateParticipantMetadata(participant);

    // Reset everything and disallow them from publishing (this will un-publish them automatically)

    metadata.requested_to_call = false;
    metadata.invited_to_stage = false;
    permission.canPublish = false;
    metadata.reqToPresent = false;
    await this.roomService.updateParticipant(
      session.room_name,
      identity,
      JSON.stringify(metadata),
      permission
    );
    return {
      message: "success",
    };
  }

  async removeParticipant(
    session: Session,
    { identity }: RemoveFromStageParams
  ) {
    if (!identity) {
      // remove self if no identity specified
      identity = session.identity;
    }

    const rooms = await this.roomService.listRooms([session.room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }

    const room = rooms[0];
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;

    const requesterInfo = await this.roomService.getParticipant(
      session.room_name,
      session.identity
    );
    const requesterMetaData =
      this.getOrCreateParticipantMetadata(requesterInfo);

    if (
      creator_identity !== session.identity &&
      !requesterMetaData.isAdmin &&
      identity !== session.identity
    ) {
      throw new Error(
        "Only the creator,admin or the participant him self can remove "
      );
    }

    // for audio room
    const participant = await this.roomService.getParticipant(
      session.room_name,
      identity
    );

    const metadata = participant.metadata && JSON.parse(participant.metadata);
    const roomMetaData =
      room.metadata && (JSON.parse(room.metadata) as RoomMetadata);

    if (roomMetaData && metadata.seatId != -1) {
      const seat = roomMetaData.seats?.find(
        (seat) => seat.id == metadata.seatId
      );
      if (seat) {
        seat.assignedParticipant = null;
        seat.occupied = false;
      }

      await this.roomService.updateRoomMetadata(
        session.room_name,
        JSON.stringify(roomMetaData)
      );
    }

    //participant will still be able to re-join
    await this.roomService.removeParticipant(session.room_name, identity);

    return {
      message: "success removed participant",
    };
  }

  async blockParticipant(session: Session, reqBody: any) {
    this.removeParticipant(session, reqBody);

    const { identity } = reqBody as RemoveFromStageParams;

    //TODO do this in your backend
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity,
        ttl: 3600,
      }
    );

    at.addGrant({
      room: session.room_name,
      roomJoin: false,
      canPublish: false,
      canSubscribe: false,
      canPublishData: false,
      canUpdateOwnMetadata: false,
    });
  }
  getOrCreateParticipantMetadata(
    participant: ParticipantInfo
  ): ParticipantMetadata {
    if (participant.metadata) {
      return JSON.parse(participant.metadata) as ParticipantMetadata;
    }
    return {
      invited_to_stage: false,
      isAdmin: false,
      requested_to_call: false,
      reqToPresent: false,
      hand_raised: false,
      seatId: -1,
      reqSeatId: -1,
      pkRoomToken: "",
      team_access_tokens_list: [],
    };
  }

  createAuthToken(room_name: string, identity: string) {
    return jwt.sign(
      JSON.stringify({ room_name, identity }),
      process.env.LIVEKIT_API_SECRET!
    );
  }
}

function generateRoomId(): string {
  return `${randomString(4)}-${randomString(4)}`;
}

function randomString(length: number): string {
  let result = "";
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
