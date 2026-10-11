// ─── Push dispatcher ───────────────────────────────────────────────────────
// Turns realtime events into Web Push notifications.
//
// Called from `RealtimeGateway.emit()` / `emitToRoom()`, i.e. only on the
// instance that ORIGINATED the event (the Redis relay path never calls emit),
// so a multi-instance PM2 deployment sends each notification exactly once.
//
// Everything is fire-and-forget: a slow or broken push service must never
// delay or fail the realtime fan-out that the POS depends on.

import { Injectable, Logger } from "@nestjs/common";
import {
  isSocketEventName,
  parseSocketEventPayload,
  socketEvents,
  type Ingredient,
  type ModuleKey,
  type Order,
  type PrintBridge,
  type PrintJob,
  type PushAudience,
  type PushCategory,
  type Reservation,
  pushNotificationPayloadSchema,
} from "@gustopos/shared";
import { isPushConfigured } from "../config/push.config";
import { PushRepository, rowWantsCategories, type PushSubscriptionRow } from "../repository/push.repository";
import { TenantService } from "../tenant/tenant.service";
import { getTenantContext } from "../tenant/tenant-context.store";
import { PushNotificationService } from "./push.service";
import {
  buildBridgeDraft,
  buildGroupOrderSubmittedDraft,
  buildGroupOrderDraftReviewDraft,
  buildLowStockDraft,
  buildOrderCreatedDraft,
  buildOrderStatusDraft,
  buildPrintJobDraft,
  buildReservationDraft,
  buildTakeawayStatusDraft,
  diffBelowThreshold,
  resolvePushUrl,
  type NotificationDraft,
} from "./notification-drafts";

interface FanOutRequest {
  tenantId: string;
  tenantSlug?: string;
  audience: PushAudience;
  category: PushCategory;
  /** Every module must be enabled for the tenant, otherwise the event is
   *  stale (module just disabled) and must not reach anybody. */
  modules: ModuleKey[];
  draft: NotificationDraft;
  /** App-relative path used when the draft carries no explicit url. */
  fallbackUrl: string;
  loadRows: () => Promise<PushSubscriptionRow[]>;
}

@Injectable()
export class PushDispatcher {
  private readonly logger = new Logger(PushDispatcher.name);

  /** tenantId → ingredient ids currently at/below threshold. Seeded on the
   *  first inventory event so a restart never triggers a notification storm. */
  private readonly lowStockBaseline = new Map<string, Set<string>>();

  constructor(
    private readonly pushRepo: PushRepository,
    private readonly pushService: PushNotificationService,
    private readonly tenantService: TenantService,
  ) {}

  /** Entry point from the realtime gateway. Never rejects. */
  async dispatch(event: string, payload: unknown, tenantId: string | null, tenantSlug?: string): Promise<void> {
    try {
      if (!tenantId || !isPushConfigured() || !isSocketEventName(event)) {
        return;
      }
      const parsed = parseSocketEventPayload(event, payload);
      if (parsed === null) {
        return;
      }

      switch (event) {
        case socketEvents.orderNew:
          await this.onOrder(parsed as Order, tenantId, tenantSlug, "created");
          break;
        case socketEvents.orderUpdate:
          await this.onOrder(parsed as Order, tenantId, tenantSlug, "updated");
          break;
        case socketEvents.reservationUpdate:
          await this.onReservation(parsed as Reservation, tenantId, tenantSlug);
          break;
        case socketEvents.inventoryUpdate:
          await this.onInventory(parsed as Ingredient[], tenantId, tenantSlug);
          break;
        case socketEvents.bridgeStatus:
          await this.onBridge(parsed as PrintBridge, tenantId, tenantSlug, false);
          break;
        case socketEvents.bridgeRemoved:
          await this.onBridge(parsed as PrintBridge, tenantId, tenantSlug, true);
          break;
        case socketEvents.jobFailed:
          await this.onPrintJob(parsed as PrintJob, tenantId, tenantSlug);
          break;
        case socketEvents.groupOrderSubmitted:
          await this.onGroupOrderSubmitted(parsed as Parameters<typeof buildGroupOrderSubmittedDraft>[0], tenantId, tenantSlug);
          break;
        default:
          break;
      }
    } catch (error) {
      this.logger.warn(`dispatch failed for "${event}": ${(error as Error).message}`);
    }
  }

  // ─── Event handlers ───────────────────────────────────────────────────

  private async onOrder(order: Order, tenantId: string, tenantSlug: string | undefined, phase: "created" | "updated"): Promise<void> {
    const staffDraft = phase === "created" ? buildOrderCreatedDraft(order) : buildOrderStatusDraft(order);
    if (staffDraft) {
      await this.fanOut({
        tenantId,
        tenantSlug,
        audience: "staff",
        category: "orders",
        modules: ["kitchen"],
        draft: staffDraft,
        fallbackUrl: "/app",
        loadRows: () => this.pushRepo.listStaffTargets(tenantId),
      });
    }

    // Consumers only hear about their own tracked takeaway order.
    const consumerDraft = phase === "updated" ? buildTakeawayStatusDraft(order) : null;
    if (consumerDraft) {
      const sessionId = await this.pushRepo.findTrackingSessionId(tenantId, order.id);
      if (sessionId) {
        await this.fanOut({
          tenantId,
          tenantSlug,
          audience: "consumer",
          category: "takeaway_status",
          modules: ["public_takeaway"],
          draft: consumerDraft,
          fallbackUrl: "/takeaway/track",
          loadRows: () => this.pushRepo.listTargetsForTrackingSessions(tenantId, [sessionId]),
        });
      }
    }
  }

  private async onReservation(reservation: Reservation, tenantId: string, tenantSlug: string | undefined): Promise<void> {
    const draft = buildReservationDraft(reservation);
    if (!draft) return;
    await this.fanOut({
      tenantId,
      tenantSlug,
      audience: "staff",
      category: "reservations",
      modules: ["reservations"],
      draft,
      fallbackUrl: "/app/reservations",
      loadRows: () => this.pushRepo.listStaffTargets(tenantId),
    });
  }

  private async onInventory(items: Ingredient[], tenantId: string, tenantSlug: string | undefined): Promise<void> {
    const previous = this.lowStockBaseline.get(tenantId) ?? null;
    const { newlyBelow, next } = diffBelowThreshold(previous, items);
    // Always advance the baseline — even when nobody is subscribed — so
    // enabling notifications later does not replay old crossings.
    this.lowStockBaseline.set(tenantId, next);
    if (newlyBelow.length === 0) return;

    const draft = buildLowStockDraft(newlyBelow);
    if (!draft) return;
    await this.fanOut({
      tenantId,
      tenantSlug,
      audience: "staff",
      category: "low_stock",
      modules: ["inventory"],
      draft,
      fallbackUrl: "/app/inventory",
      loadRows: () => this.pushRepo.listStaffTargets(tenantId),
    });
  }

  private async onBridge(bridge: PrintBridge, tenantId: string, tenantSlug: string | undefined, removed: boolean): Promise<void> {
    const draft = buildBridgeDraft(bridge, removed);
    if (!draft) return;
    await this.fanOut({
      tenantId,
      tenantSlug,
      audience: "staff",
      category: "printing",
      modules: ["printing"],
      draft,
      fallbackUrl: "/app/settings",
      loadRows: () => this.pushRepo.listStaffTargets(tenantId),
    });
  }

  private async onPrintJob(job: PrintJob, tenantId: string, tenantSlug: string | undefined): Promise<void> {
    const draft = buildPrintJobDraft(job);
    if (!draft) return;
    await this.fanOut({
      tenantId,
      tenantSlug,
      audience: "staff",
      category: "printing",
      modules: ["printing"],
      draft,
      fallbackUrl: "/app/settings",
      loadRows: () => this.pushRepo.listStaffTargets(tenantId),
    });
  }

  private async onGroupOrderSubmitted(
    payload: Parameters<typeof buildGroupOrderSubmittedDraft>[0],
    tenantId: string,
    tenantSlug: string | undefined,
  ): Promise<void> {
    const sessionId = payload.session.id;
    await this.fanOut({
      tenantId,
      tenantSlug,
      audience: "consumer",
      category: "group_order",
      modules: ["public_group_order"],
      draft: buildGroupOrderSubmittedDraft(payload),
      fallbackUrl: "/",
      loadRows: () => this.pushRepo.listTargetsForGroupSession(tenantId, sessionId),
    });

    // Staff: the submitted order is only a draft until someone approves it.
    await this.fanOut({
      tenantId,
      tenantSlug,
      audience: "staff",
      category: "orders",
      modules: ["public_group_order"],
      draft: buildGroupOrderDraftReviewDraft(payload),
      fallbackUrl: "/app/group-orders",
      loadRows: () => this.pushRepo.listStaffTargets(tenantId),
    });
  }

  // ─── Fan-out ──────────────────────────────────────────────────────────

  private async fanOut(request: FanOutRequest): Promise<void> {
    if (!isPushConfigured()) return;

    const enabledModules = await this.modulesFor(request.tenantId);
    if (!request.modules.every((module) => enabledModules.includes(module))) {
      return;
    }

    const rows = await request.loadRows();
    const wanted: PushCategory[] = [request.category];
    const targets = rows.filter((row) =>
      rowWantsCategories(
        request.audience === "staff" ? row.staffCategories : row.consumerCategories,
        wanted,
      ),
    );
    if (targets.length === 0) return;

    const url = request.draft.url ?? resolvePushUrl(request.audience, request.tenantSlug, request.fallbackUrl);
    const notification = pushNotificationPayloadSchema.parse({
      title: request.draft.title,
      body: request.draft.body,
      tag: request.draft.tag,
      url,
      whenVisible: true,
    });

    const delivered: string[] = [];
    const results = await Promise.allSettled(
      targets.map(async (row) => {
        const result = await this.pushService.send(row, notification);
        if (result === "gone") {
          await this.pushRepo.removeById(row.id);
        } else if (result === "sent") {
          delivered.push(row.id);
        }
      }),
    );
    const failures = results.filter((entry) => entry.status === "rejected").length;
    if (failures > 0) {
      this.logger.warn(`${failures} push target(s) failed for "${request.category}"`);
    }
    await this.pushRepo.markNotified(delivered);
  }

  private async modulesFor(tenantId: string): Promise<ModuleKey[]> {
    const context = getTenantContext();
    if (context && context.tenantId === tenantId && context.enabledModules.length > 0) {
      return context.enabledModules;
    }
    return this.tenantService.getEnabledModulesForTenant(tenantId);
  }
}
