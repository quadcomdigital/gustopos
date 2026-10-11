// ─── Push Subscriptions Repository ─────────────────────────────────────────
// CRUD + fan-out queries for Web Push subscriptions. One row per browser
// registration (endpoint) per tenant; the row can simultaneously hold the
// staff identity and the consumer contexts (see db/schema.ts).

import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../db/client";
import { publicTakeawayTrackingSessions, pushSubscriptions } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import type { PushAudience, PushCategory, PushSubscription } from "@gustopos/shared";

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

export interface UpsertPushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  audience: PushAudience;
  /** Staff identity captured at subscribe time (staff audience only). */
  staffId?: string | null;
  categories: PushCategory[];
  /** Consumer context resolved by the controller (consumer audience only). */
  trackingSessionId?: string | null;
  groupSessionId?: string | null;
  deviceLabel?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class PushRepository {
  private currentTenantId(): string {
    return getTenantIdOrDefault();
  }

  private mapRow(row: PushSubscriptionRow): PushSubscription {
    return {
      id: row.id,
      endpoint: row.endpoint,
      staffCategories: (row.staffCategories as PushCategory[] | null) ?? [],
      consumerCategories: (row.consumerCategories as PushCategory[] | null) ?? [],
      staff: Boolean(row.staffId),
      consumer: Boolean(row.trackingSessionId || row.groupSessionId),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findByEndpoint(endpoint: string, tenantId = this.currentTenantId()): Promise<PushSubscriptionRow | null> {
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.endpoint, endpoint)))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Contract-shaped record for this device, or null when it is not registered. */
  async getSubscription(endpoint: string): Promise<PushSubscription | null> {
    const row = await this.findByEndpoint(endpoint);
    return row ? this.mapRow(row) : null;
  }

  /**
   * Creates or refreshes the row for `endpoint`. The two sides are updated
   * independently so subscribing from the public menu never wipes the staff
   * preferences of the same device (and vice versa).
   */
  async upsertSubscription(input: UpsertPushSubscriptionInput): Promise<PushSubscription> {
    const tenantId = this.currentTenantId();
    const now = new Date();
    const existing = await this.findByEndpoint(input.endpoint, tenantId);

    if (!existing) {
      const consumerSide = input.audience === "consumer";
      const rows = await db
        .insert(pushSubscriptions)
        .values({
          id: `psub_${crypto.randomUUID()}`,
          tenantId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          staffId: input.audience === "staff" ? (input.staffId ?? null) : null,
          // Omitted sides keep their column default (see db/schema.ts).
          ...(input.audience === "staff" ? { staffCategories: input.categories } : {}),
          ...(consumerSide
            ? {
                consumerCategories: input.categories,
                trackingSessionId: input.trackingSessionId ?? null,
                groupSessionId: input.groupSessionId ?? null,
              }
            : {}),
          deviceLabel: input.deviceLabel ?? null,
          userAgent: input.userAgent ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return this.mapRow(rows[0]);
    }

    const patch: Partial<PushSubscriptionRow> = { updatedAt: now };
    if (input.audience === "staff") {
      if (input.staffId !== undefined) patch.staffId = input.staffId;
      patch.staffCategories = input.categories;
    } else {
      patch.consumerCategories = input.categories;
      // Only overwrite a context when one was supplied: subscribing to a
      // group order must not detach the device from its tracked order.
      if (input.trackingSessionId !== undefined) patch.trackingSessionId = input.trackingSessionId;
      if (input.groupSessionId !== undefined) patch.groupSessionId = input.groupSessionId;
    }
    if (input.deviceLabel !== undefined) patch.deviceLabel = input.deviceLabel;
    if (input.userAgent !== undefined) patch.userAgent = input.userAgent;
    if (input.p256dh) patch.p256dh = input.p256dh;
    if (input.auth) patch.auth = input.auth;

    const rows = await db
      .update(pushSubscriptions)
      .set(patch)
      .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.endpoint, input.endpoint)))
      .returning();
    return this.mapRow(rows[0]);
  }

  async updateCategories(
    endpoint: string,
    audience: PushAudience,
    categories: PushCategory[],
  ): Promise<PushSubscription | null> {
    const tenantId = this.currentTenantId();
    const patch =
      audience === "staff"
        ? { staffCategories: categories, updatedAt: new Date() }
        : { consumerCategories: categories, updatedAt: new Date() };
    const rows = await db
      .update(pushSubscriptions)
      .set(patch)
      .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.endpoint, endpoint)))
      .returning();
    const row = rows[0];
    return row ? this.mapRow(row) : null;
  }

  async removeByEndpoint(endpoint: string): Promise<boolean> {
    const tenantId = this.currentTenantId();
    const rows = await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.endpoint, endpoint)))
      .returning({ id: pushSubscriptions.id });
    return rows.length > 0;
  }

  /** Staff terminals of a tenant. Category filtering happens in JS: the row
   *  count per tenant is tiny (one per installed terminal) and this keeps the
   *  query free of jsonb operator quirks. */
  async listStaffTargets(tenantId: string): Promise<PushSubscriptionRow[]> {
    return db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.tenantId, tenantId), isNotNull(pushSubscriptions.staffId)));
  }

  /** Devices bound to any of the given takeaway tracking sessions. */
  async listTargetsForTrackingSessions(tenantId: string, sessionIds: string[]): Promise<PushSubscriptionRow[]> {
    if (sessionIds.length === 0) return [];
    return db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.tenantId, tenantId),
          inArray(pushSubscriptions.trackingSessionId, sessionIds),
        ),
      );
  }

  async listTargetsForGroupSession(tenantId: string, sessionId: string): Promise<PushSubscriptionRow[]> {
    return db
      .select()
      .from(pushSubscriptions)
      .where(
        and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.groupSessionId, sessionId)),
      );
  }

  async findTargetByEndpoint(tenantId: string, endpoint: string): Promise<PushSubscriptionRow | null> {
    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.tenantId, tenantId), eq(pushSubscriptions.endpoint, endpoint)))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Resolves the tracking session id for an order (token validated upstream).
   *  Revoked or expired sessions resolve to null so nobody gets notified for a
   *  link the customer can no longer open. */
  async findTrackingSessionId(tenantId: string, orderId: string): Promise<string | null> {
    const rows = await db
      .select({ id: publicTakeawayTrackingSessions.id, expiresAt: publicTakeawayTrackingSessions.expiresAt, revokedAt: publicTakeawayTrackingSessions.revokedAt })
      .from(publicTakeawayTrackingSessions)
      .where(
        and(
          eq(publicTakeawayTrackingSessions.tenantId, tenantId),
          eq(publicTakeawayTrackingSessions.orderId, orderId),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return row.id;
  }

  async markNotified(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(pushSubscriptions)
      .set({ lastNotifiedAt: new Date() })
      .where(inArray(pushSubscriptions.id, ids));
  }

  /** Drops a row whose push service answered 404/410 (endpoint expired). */
  async removeById(id: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }
}

/** True when the row has at least one of the requested categories. */
export function rowWantsCategories(
  rowCategories: unknown,
  wanted: readonly PushCategory[],
): boolean {
  if (!Array.isArray(rowCategories)) return false;
  const enabled = new Set(rowCategories.filter((value): value is string => typeof value === "string"));
  return wanted.some((category) => enabled.has(category));
}
