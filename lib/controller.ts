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
export type RoomMetadata = {
  creator_identity: string;
  enable_chat?: boolean;
  type?:
    | "audio-only"
    | "audio-video"
    | "multi-video"
    | "live-audio-video"
    | "vs-mode";
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
      canSubscribe: true,
      canPublishData: true,
    });

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

      if (!roomMetaData || (!roomMetaData.pkSrcTtl && !roomMetaData.pkTarTtl))
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
      return { message: "Only the Creator can set this to true" };
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
  async PkRoomInvite(
    session: Session,
    {
      room_name,
      type = "random",
      ttl = "1h",
      end = false,
    }: {
      room_name?: string;
      type?: "random" | "team v/s" | "mutual friend";
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
          type,
          ttl
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
      if (end) this.endMergeRoom = end;
      while (!isAccepted && !this.endMergeRoom) {
        const randomIndex = Math.floor(Math.random() * roomsNotInPk.length);
        const response = await this.inviteToPkMode(
          roomsNotInPk[randomIndex].name,
          session.identity,
          session.room_name,
          type,
          ttl
        );
        console.log("accepted:", response?.accepted);
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
    type: "random" | "team v/s" | "mutual friend",
    ttl: string | number
  ) {
    const rooms = await this.roomService.listRooms([session_room_name]);

    if (rooms.length === 0) {
      throw new Error("Room does not exist");
    }
    const room = rooms[0];
    const creator_identity = (JSON.parse(room.metadata) as RoomMetadata)
      .creator_identity;
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
    console.log("creatorInvited:", creatorToInvite, "in room", room_name);

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

  /* Team Mode merge */
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

      // attach with metadata client on frontend

      /*source room participants add token to metadata */

      const srcCreatorInfo = await this.roomService.getParticipant(
        room_name,
        creator_identity
      );
      if (srcCreatorInfo) {
        const metadata = this.getOrCreateParticipantMetadata(srcCreatorInfo);
        metadata.pkRoomToken = sourceToken;
        await this.roomService.updateParticipant(
          room_name,
          srcCreatorInfo.identity,
          JSON.stringify(metadata),
          srcCreatorInfo.permission
        );
      }

      const targCreatorInfo = await this.roomService.getParticipant(
        session.room_name,
        session.identity
      );

      if (targCreatorInfo) {
        const metadata = this.getOrCreateParticipantMetadata(targCreatorInfo);
        metadata.pkRoomToken = targetToken;
        await this.roomService.updateParticipant(
          session.room_name,
          session.identity,
          JSON.stringify(metadata),
          targCreatorInfo.permission
        );
      }

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

  async generateToken(roomName: string, identity: string, permissions: any) {
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
