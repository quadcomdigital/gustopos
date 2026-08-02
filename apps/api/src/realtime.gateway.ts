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
        // Room-based fan-out: each authenticated staff socket joins its tenant
        // room, one room per enabled feature module, and a cross-tenant
        // "staff" room. Emits are then O(1) adapter lookups instead of
        // iterating every connected socket per event.
        socket.join(`tenant:${payload.tenantId}`);
        for (const module of enabledModules) {
          socket.join(`tenant:${payload.tenantId}:${module}`);
        }
        socket.join("staff");
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
          this.server.to(room).emit(roomEvent, actualPayload);
        }
        return;
      }

      // Cross-instance delivery: every API instance receives the pub/sub
      // message and fans out to its own local room members.
      this.server.to(this.roomsForEvent(event, tenantId)).emit(event, actualPayload);
    });
  }

  // Maps an event to the socket rooms that should receive it, mirroring the
  // old per-socket module filter without iterating every connection. Events
  // without a module requirement go to the base tenant room (or "staff" when
  // no tenant scope is known); module-gated events go to the per-module rooms.
  // socket.io deduplicates sockets that appear in several target rooms.
  private roomsForEvent(event: string, tenantId: string | null): string[] {
    const requiredModules = EVENT_MODULE_MAP[event];
    const baseRoom = tenantId ? `tenant:${tenantId}` : "staff";
    if (!requiredModules || requiredModules.length === 0) {
      return [baseRoom];
    }
    return requiredModules.map((module) => `${baseRoom}:${module}`);
  }

  async emit<T>(event: string, payload: T, tenantId?: string): Promise<void> {
    const scopedTenantId = tenantId ?? getTenantContext()?.tenantId ?? null;
    this.server.to(this.roomsForEvent(event, scopedTenantId)).emit(event, payload);

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
