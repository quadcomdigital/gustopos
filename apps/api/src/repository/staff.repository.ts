// ─── Staff Repository ──────────────────────────────────────────────────────
// Extracted from AppRepository — Phase 2 of the Strangler Fig refactoring.
// Contains: staff CRUD, auth sessions, tenant lookup, module checks, audit logging.

import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client";
import {
  authSessions,
  staff,
  tenants,
  tenantAuditLogs,
  tenantModules,
} from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { hashPin, isHashedPin, verifyPin } from "../auth/pin-hash";
import {
  staffCreateRequestSchema,
  staffUpdateRequestSchema,
  staffResetPinRequestSchema,
  staffAdminListResponseSchema,
  type Staff,
  type StaffAdmin,
  type StaffCreateRequest,
  type StaffUpdateRequest,
  type StaffResetPinRequest,
  type ModuleKey,
} from "@gustopos/shared";

// ─── Interfaces ────────────────────────────────────────────────────────

export interface StoredSession {
  id: string;
  tenantId: string;
  staffId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

// ─── Staff Repository ──────────────────────────────────────────────────

@Injectable()
export class StaffRepository {

  // ─── Audit ───────────────────────────────────────────────────────────

  async logTenantAudit(params: {
    tenantId: string;
    actor: string;
    event: string;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await db.insert(tenantAuditLogs).values({
      id: `tal_${crypto.randomUUID()}`,
      tenantId: params.tenantId,
      actor: params.actor,
      event: params.event,
      payload: JSON.stringify(params.payload ?? {}),
      createdAt: new Date(),
    });
  }

  // ─── Modules ─────────────────────────────────────────────────────────

  async getEnabledModulesRows(tenantId: string): Promise<ModuleKey[]> {
    const rows = await db
      .select({ moduleKey: tenantModules.moduleKey })
      .from(tenantModules)
      .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.enabled, 1)));

    return rows
      .map((row) => row.moduleKey)
      .filter((value): value is ModuleKey =>
        value === "kitchen" ||
        value === "course_rounds" ||
        value === "inventory" ||
        value === "customers" ||
        value === "analytics" ||
        value === "printing" ||
        value === "public_menu" ||
        value === "public_takeaway" ||
        value === "consumer_accounts" ||
        value === "loyalty_points" ||
        value === "self_order_qr" ||
        value === "reservations" ||
        value === "delivery" ||
        value === "purchasing_suppliers" ||
        value === "staff_shifts_timeclock" ||
        value === "fiscal_exports" ||
        value === "simple_catalog" ||
        value === "public_group_order",
      );
  }

  async getEnabledModulesForTenant(tenantId: string): Promise<ModuleKey[]> {
    return this.getEnabledModulesRows(tenantId);
  }

  // ─── Tenant ──────────────────────────────────────────────────────────

  async getTenantBySlug(tenantSlug: string): Promise<{ id: string; slug: string } | null> {
    const rows = await db
      .select({ id: tenants.id, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  // ─── Staff CRUD ──────────────────────────────────────────────────────

  async listStaffPublic(): Promise<Staff[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.isActive, 1)));

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role as Staff["role"],
    }));
  }

  async listStaffAdmin(): Promise<StaffAdmin[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(staff)
      .where(eq(staff.tenantId, tenantId));

    return staffAdminListResponseSchema.parse(
      rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        name: row.name,
        role: row.role,
        isActive: row.isActive === 1,
        customPermissions: (row.customPermissions as string[]) ?? [],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    );
  }

  async createStaff(payload: StaffCreateRequest): Promise<StaffAdmin> {
    const parsed = staffCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const rows = await db
      .insert(staff)
      .values({
        id: `stf_${crypto.randomUUID()}`,
        tenantId,
        name: parsed.name.trim(),
        role: parsed.role,
        pin: await hashPin(parsed.pin),
        isActive: 1,
        customPermissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const row = rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role as StaffAdmin["role"],
      isActive: Boolean(row.isActive),
      customPermissions: [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateStaff(id: string, payload: StaffUpdateRequest): Promise<StaffAdmin | null> {
    const parsed = staffUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    if (!parsed.name && !parsed.role && !parsed.customPermissions) {
      return this.getStaffById(id);
    }

    const rows = await db
      .update(staff)
      .set({
        ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
        ...(parsed.role !== undefined ? { role: parsed.role } : {}),
        ...(parsed.customPermissions !== undefined ? { customPermissions: parsed.customPermissions } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, id)))
      .returning();

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role as StaffAdmin["role"],
      isActive: row.isActive === 1,
      customPermissions: (row.customPermissions as string[]) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async resetStaffPin(id: string, payload: StaffResetPinRequest): Promise<boolean> {
    const parsed = await staffResetPinRequestSchema.parseAsync(payload);
    const tenantId = getTenantIdOrDefault();

    const rows = await db
      .update(staff)
      .set({
        pin: await hashPin(parsed.pin),
        updatedAt: new Date(),
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, id)))
      .returning({ id: staff.id });

    return rows.length > 0;
  }

  async setStaffActiveState(id: string, isActive: boolean): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .update(staff)
      .set({ isActive: isActive ? 1 : 0, updatedAt: new Date() })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, id)))
      .returning({ id: staff.id });

    return rows.length > 0;
  }

  // ─── Staff Lookups ───────────────────────────────────────────────────

  async findStaffByCredentials(staffId: string, pin: string): Promise<Staff | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId), eq(staff.isActive, 1)))
      .limit(1);

    const found = rows[0];
    if (!found) return null;

    if (!isHashedPin(found.pin)) {
      // Plain-text PIN (legacy migration path)
      if (found.pin !== pin) return null;
      // Auto-upgrade to hashed PIN
      const pinHash = await hashPin(pin);
      await db
        .update(staff)
        .set({ pin: pinHash, updatedAt: new Date() })
        .where(and(eq(staff.tenantId, tenantId), eq(staff.id, found.id)));
    } else {
      const isValidPin = await verifyPin(pin, found.pin);
      if (!isValidPin) return null;
    }

    return {
      id: found.id,
      tenantId: found.tenantId,
      name: found.name,
      role: found.role as Staff["role"],
    };
  }

  async getStaffById(id: string): Promise<StaffAdmin | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, id)))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role as StaffAdmin["role"],
      isActive: Boolean(row.isActive),
      customPermissions: (row.customPermissions as string[]) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findStaffById(staffId: string, explicitTenantId?: string): Promise<Staff | null> {
    const tenantId = explicitTenantId ?? getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];

    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role as Staff["role"],
    };
  }

  // ─── Auth Sessions ───────────────────────────────────────────────────

  async createAuthSession(payload: {
    id: string;
    tenantId: string;
    staffId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await db.insert(authSessions).values({
      id: payload.id,
      tenantId: payload.tenantId,
      staffId: payload.staffId,
      refreshTokenHash: payload.refreshTokenHash,
      expiresAt: payload.expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    });
  }

  async findActiveSessionByRefreshHash(refreshTokenHash: string): Promise<StoredSession | null> {
    // NOTE: tenantId filter is intentionally omitted because the refresh token
    // hash (sha256 of 48 random bytes) is globally unique. The tenant context
    // from AsyncLocalStorage is unreliable for the @Public() refresh endpoint
    // due to how NestJS middleware propagates the context. The session's own
    // tenantId is used downstream for staff lookups.
    // NOTE: isNull() is used instead of eq(col, null) because Drizzle generates
    // "= NULL" (always false) instead of "IS NULL" for the eq() variant.
    const rows = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.refreshTokenHash, refreshTokenHash),
          isNull(authSessions.revokedAt),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      staffId: row.staffId,
      refreshTokenHash: row.refreshTokenHash,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    };
  }

  async findActiveSessionById(
    sessionId: string,
    staffId: string,
    explicitTenantId?: string,
  ): Promise<StoredSession | null> {
    const tenantId = explicitTenantId ?? getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.tenantId, tenantId),
          eq(authSessions.id, sessionId),
          eq(authSessions.staffId, staffId),
          isNull(authSessions.revokedAt),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      staffId: row.staffId,
      refreshTokenHash: row.refreshTokenHash,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      revokedAt: row.revokedAt,
    };
  }

  async revokeSessionById(sessionId: string): Promise<void> {
    const tenantId = getTenantIdOrDefault();
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.tenantId, tenantId), eq(authSessions.id, sessionId)));
  }

  async rotateSession(
    oldSessionId: string,
    newSession: {
      id: string;
      tenantId: string;
      staffId: string;
      refreshTokenHash: string;
      expiresAt: Date;
    },
    explicitTenantId?: string,
  ): Promise<void> {
    const tenantId = explicitTenantId ?? getTenantIdOrDefault();
    await db.transaction(async (tx) => {
      await tx
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.tenantId, tenantId), eq(authSessions.id, oldSessionId)));

      await tx.insert(authSessions).values({
        id: newSession.id,
        tenantId: newSession.tenantId,
        staffId: newSession.staffId,
        refreshTokenHash: newSession.refreshTokenHash,
        expiresAt: newSession.expiresAt,
        createdAt: new Date(),
        revokedAt: null,
      });
    });
  }

  async revokeSessionByIdIfActive(sessionId: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(
        and(
          eq(authSessions.tenantId, tenantId),
          eq(authSessions.id, sessionId),
          isNull(authSessions.revokedAt),
        ),
      )
      .limit(1);

    if (rows.length === 0) return false;

    await this.revokeSessionById(sessionId);
    return true;
  }
}
