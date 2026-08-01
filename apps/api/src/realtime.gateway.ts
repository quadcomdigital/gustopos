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
import { getTenantContext, runWithTenantContext } from "./tenant/tenant-context.store";
import { TenantService } from "./tenant/tenant.service";
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
    @Inject(TenantService) private readonly tenantService: TenantService,
  ) {}

  @WebSocketServer()
  server!: Server;

  onModuleInit(): void {
    this.server.use(async (socket, next) => {
      const token = socket.handshake.auth?.token;
      const participantToken = socket.handshake.auth?.participantToken;
      if (!token || typeof token !== "string") {
        // Public group-order clients do not have staff JWTs. They may connect
        // with a participant token, but can receive events only after the room
        // join handler validates that token against the requested session.
        const sessionId = socket.handshake.auth?.sessionId;
        const tenantSlug = socket.handshake.auth?.tenantSlug;
        if (
          !participantToken || typeof participantToken !== "string" ||
          !sessionId || typeof sessionId !== "string" ||
          !tenantSlug || typeof tenantSlug !== "string"
        ) {
          next(new Error("Authentication required"));
          return;
        }

        const tenant = await this.tenantService.resolveTenantBySlug(tenantSlug);
        if (!tenant || !tenant.isActive) {
          next(new Error("Invalid group-order tenant"));
          return;
        }
        const participant = await runWithTenantContext(
          {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            resolutionSource: "slug",
            enabledModules: [],
          },
          () => this.appRepository.findGroupOrderParticipantByToken(sessionId, participantToken),
        );
        if (!participant) {
          next(new Error("Invalid group-order participant"));
          return;
        }

        socket.data.authenticated = false;
        socket.data.isGroupOrder = true;
        socket.data.groupOrderSessionId = sessionId;
        socket.data.groupOrderParticipantToken = participantToken;
        socket.data.tenantId = tenant.id;
        socket.data.enabledModules = [];
        next();
        return;
      }

      try {
        const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;
        if (payload.tokenType !== "access" || !payload.sessionId || !payload.sub || !payload.tenantId) {
          next(new Error("Invalid socket token type"));
          return;
        }

        const tenantContext = {
          tenantId: payload.tenantId,
          resolutionSource: "jwt" as const,
          enabledModules: [] as ModuleKey[],
        };
        const { activeSession, enabledModules } = await runWithTenantContext(tenantContext, async () => ({
          activeSession: await this.staffRepo.findActiveSessionById(payload.sessionId!, payload.sub!, payload.tenantId!),
          enabledModules: await this.staffRepo.getEnabledModulesForTenant(payload.tenantId!),
        }));
        if (!activeSession) {
          next(new Error("Socket session expired or revoked"));
          return;
        }

        if (activeSession.tenantId !== payload.tenantId) {
          next(new Error("Socket tenant mismatch"));
          return;
        }

        socket.data.authenticated = true;
        socket.data.isGroupOrder = false;
        socket.data.tenantId = payload.tenantId;
        socket.data.enabledModules = enabledModules;
        next();
      } catch {
        next(new Error("Invalid socket token"));
      }
    });

    this.pubSubService.onMessage((event, payload) => {
      const isScoped = payload !== null && typeof payload === "object" && "__tenantId" in (payload as Record<string, unknown>);
      const tenantId = isScoped ? (payload as Record<string, unknown>).__tenantId as string : null;
      const actualPayload = isScoped ? (payload as Record<string, unknown>).payload : payload;

      // Room events are published with a namespaced event so public group-order
      // sockets work across API instances without being exposed to global events.
      if (event.startsWith("groupOrder:")) {
        const separator = event.lastIndexOf(":");
        if (separator > "groupOrder:".length) {
          const room = event.slice(0, separator);
          const roomEvent = event.slice(separator + 1);
          for (const socket of this.server.sockets.sockets.values()) {
            if (socket.rooms.has(room) && (!tenantId || socket.data.tenantId === tenantId)) {
              socket.emit(roomEvent, actualPayload);
            }
          }
        }
        return;
      }

      for (const socket of this.server.sockets.sockets.values()) {
        // Public sockets are intentionally excluded from global pub/sub events.
        if (socket.data.authenticated !== true) {
          continue;
        }
        if (tenantId && socket.data.tenantId !== tenantId) {
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
    for (const socket of sockets) {
      if (socket.data.authenticated !== true) {
        continue;
      }
      if (tenantId && socket.data.tenantId !== tenantId) {
        continue;
      }
      const modules = socket.data.enabledModules as ModuleKey[] | undefined;
      if (canReceiveEvent(modules, event)) {
        socket.emit(event, payload);
      }
    }

    const scopedTenantId = tenantId ?? getTenantContext()?.tenantId;
    const pubsubPayload = scopedTenantId ? { __tenantId: scopedTenantId, payload } : payload;
    await this.pubSubService.publish(event, pubsubPayload);
  }

  async emitToRoom<T>(room: string, event: string, payload: T): Promise<void> {
    const tenantId = getTenantContext()?.tenantId;
    this.server.to(room).emit(event, payload);
    await this.pubSubService.publish(`${room}:${event}`, tenantId ? { __tenantId: tenantId, payload } : payload);
  }

  @SubscribeMessage("group_order_join_room")
  async handleJoinGroupOrderRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { sessionId?: string; participantToken?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!socket.data.isGroupOrder) {
      return { ok: false, error: "Only group-order sockets may join group-order rooms" };
    }
    if (payload.sessionId !== socket.data.groupOrderSessionId || payload.participantToken !== socket.data.groupOrderParticipantToken) {
      return { ok: false, error: "Group-order identity mismatch" };
    }
    if (!payload?.sessionId || typeof payload.sessionId !== "string") {
      return { ok: false, error: "Missing sessionId" };
    }
    if (!payload?.participantToken || typeof payload.participantToken !== "string") {
      return { ok: false, error: "Missing participantToken" };
    }

    const participant = await runWithTenantContext(
      {
        tenantId: socket.data.tenantId as string,
        resolutionSource: "slug",
        enabledModules: [],
      },
      () => this.appRepository.findGroupOrderParticipantByToken(payload.sessionId!, payload.participantToken!),
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
    if (!socket.data.isGroupOrder || !payload?.sessionId || typeof payload.sessionId !== "string") {
      return { ok: false };
    }
    socket.leave(`groupOrder:${payload.sessionId}`);
    return { ok: true };
  }
}
