import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import type { Socket } from "socket.io";
import { parseCorsOrigins } from "./config/cors.config";
import { RealtimePubSubService } from "./realtime/pubsub.service";
import type { JwtPayload } from "./auth/jwt.types";
import { AppRepository } from "./repository/app.repository";
import { StaffRepository } from "./repository/staff.repository";
import { getJwtSecret } from "./auth/jwt-secret";
import type { ModuleKey } from "@gustopos/shared";

const EVENT_MODULE_MAP: Record<string, Array<ModuleKey>> = {
  "order:new": ["kitchen"],
  "order:update": ["kitchen"],
  "orders:update": ["kitchen"],
  "inventory:update": ["inventory"],
  "tables:update": ["kitchen"],
  "settings:update": [],
};

function canReceiveEvent(enabledModules: ModuleKey[] | undefined, event: string): boolean {
  const requiredModules = EVENT_MODULE_MAP[event];
  if (!requiredModules || requiredModules.length === 0) {
    return true;
  }

  const modules = enabledModules ?? [];
  return requiredModules.some((moduleKey) => modules.includes(moduleKey));
}

@WebSocketGateway({
  cors: {
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  },
})
@Injectable()
export class RealtimeGateway implements OnModuleInit {
  private readonly jwtSecret = getJwtSecret();

  constructor(
    @Inject(RealtimePubSubService) private readonly pubSubService: RealtimePubSubService,
    @Inject(AppRepository) private readonly appRepository: AppRepository,
    @Inject(StaffRepository) private readonly staffRepo: StaffRepository,
  ) {}

  @WebSocketServer()
  server!: Server;

  onModuleInit(): void {
    this.server.use(async (socket, next) => {
      const token = socket.handshake.auth?.token;
      console.log(`[realtime] middleware: socket ${socket.id} token=${token ? token.substring(0, 20) + '...' : 'NONE'}`);
      if (!token || typeof token !== "string") {
        socket.data.tenantId = null;
        socket.data.enabledModules = [];
        console.log(`[realtime] middleware: no token, allowing with empty modules`);
        next();
        return;
      }

      try {
        const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
        if (payload.tokenType !== "access" || !payload.sessionId || !payload.sub || !payload.tenantId) {
          console.log(`[realtime] middleware: invalid token type`);
          next(new Error("Invalid socket token type"));
          return;
        }

        const activeSession = await this.staffRepo.findActiveSessionById(payload.sessionId, payload.sub, payload.tenantId);
        if (!activeSession) {
          console.log(`[realtime] middleware: session expired or revoked`);
          next(new Error("Socket session expired or revoked"));
          return;
        }

        if (activeSession.tenantId !== payload.tenantId) {
          console.log(`[realtime] middleware: tenant mismatch`);
          next(new Error("Socket tenant mismatch"));
          return;
        }

        socket.data.tenantId = payload.tenantId;
        const latestEnabledModules = await this.staffRepo.getEnabledModulesForTenant(payload.tenantId);
        socket.data.enabledModules = latestEnabledModules;
        console.log(`[realtime] middleware: socket ${socket.id} connected tenant=${payload.tenantId} modules=${JSON.stringify(latestEnabledModules)}`);

        next();
      } catch (err) {
        console.log(`[realtime] middleware: token verification failed: ${err instanceof Error ? err.message : err}`);
        next(new Error("Invalid socket token"));
      }
    });

    this.pubSubService.onMessage((event, payload) => {
      const isScoped = payload !== null && typeof payload === "object" && "__tenantId" in (payload as Record<string, unknown>);
      const tenantId = isScoped ? (payload as Record<string, unknown>).__tenantId as string : null;
      const actualPayload = isScoped ? (payload as Record<string, unknown>).payload : payload;

      for (const socket of this.server.sockets.sockets.values()) {
        if (tenantId && socket.data.tenantId && socket.data.tenantId !== tenantId) {
          continue;
        }
        if (canReceiveEvent(socket.data.enabledModules as ModuleKey[] | undefined, event)) {
          socket.emit(event, actualPayload);
        }
      }
    });
  }

  async emit<T>(event: string, payload: T, tenantId?: string): Promise<void> {
    const sockets = [...this.server.sockets.sockets.values()];
    console.log(`[realtime] emit "${event}" to ${sockets.length} socket(s) tenant=${tenantId ?? "all"}`);
    for (const socket of sockets) {
      if (tenantId && socket.data.tenantId && socket.data.tenantId !== tenantId) {
        continue;
      }
      const modules = socket.data.enabledModules as ModuleKey[] | undefined;
      const allowed = canReceiveEvent(modules, event);
      console.log(`[realtime]   socket ${socket.id} modules=${JSON.stringify(modules)} allowed=${allowed}`);
      if (allowed) {
        socket.emit(event, payload);
      }
    }
    const pubsubPayload = tenantId ? { __tenantId: tenantId, payload } : payload;
    await this.pubSubService.publish(event, pubsubPayload);
  }

  async emitToRoom<T>(room: string, event: string, payload: T): Promise<void> {
    this.server.to(room).emit(event, payload);
    await this.pubSubService.publish(`${room}:${event}`, payload);
  }

  @SubscribeMessage("group_order_join_room")
  async handleJoinGroupOrderRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { sessionId?: string; participantToken?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!payload?.sessionId || typeof payload.sessionId !== "string") {
      return { ok: false, error: "Missing sessionId" };
    }
    if (!payload?.participantToken || typeof payload.participantToken !== "string") {
      return { ok: false, error: "Missing participantToken" };
    }

    const participant = await this.appRepository.findGroupOrderParticipantByToken(
      payload.sessionId,
      payload.participantToken,
    );
    if (!participant) {
      return { ok: false, error: "Invalid participant token" };
    }

    socket.join(`groupOrder:${payload.sessionId}`);
    return { ok: true };
  }

  @SubscribeMessage("group_order_leave_room")
  handleLeaveGroupOrderRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { sessionId?: string },
  ): { ok: boolean } {
    if (!payload?.sessionId || typeof payload.sessionId !== "string") {
      return { ok: false };
    }
    socket.leave(`groupOrder:${payload.sessionId}`);
    return { ok: true };
  }
}
