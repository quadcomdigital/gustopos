import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/client";
import {
  consumerAccountsConfigSchema,
  consumerLoginRequestSchema,
  consumerOrderHistoryResponseSchema,
  consumerRegisterRequestSchema,
  consumerUserSchema,
  orderSchema,
  type ConsumerAccountsConfig,
  type ConsumerLoginRequest,
  type ConsumerOrderHistoryResponse,
  type ConsumerRegisterRequest,
  type ConsumerUser,
  type Order,
} from "@gustopos/shared";
import {
  consumerOrderLinks,
  consumerSessions,
  consumerUsers,
  tenantModuleConfigs,
  orders,
  orderItems,
} from "../db/schema";
import { hashPin, verifyPin } from "../auth/pin-hash";

// Import shared helpers from AppRepository - these are plain functions, not DI
import { parseIngredientOverrides, parseSelectedModifiers } from "./app.repository";

// ─── Local helpers ──────────────────────────────────────────────

function normalizeCustomerName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeConsumerEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeConsumerPhone(value: string): string {
  return value.replace(/\s+/g, "").replace(/[^+\d]/g, "").trim();
}

// ─── Local types ────────────────────────────────────────────────

interface StoredConsumerSession {
  id: string;
  tenantId: string;
  consumerUserId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

@Injectable()
export class ConsumerRepository {
  private mapConsumerUserRow(row: typeof consumerUsers.$inferSelect): ConsumerUser {
    return consumerUserSchema.parse({
      id: row.id,
      tenantId: row.tenantId,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      fullName: row.fullName,
      isActive: row.isActive === 1,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    });
  }

  async getConsumerAccountsConfig(tenantId: string): Promise<ConsumerAccountsConfig> {
    const rows = await db
      .select({ config: tenantModuleConfigs.config })
      .from(tenantModuleConfigs)
      .where(and(eq(tenantModuleConfigs.tenantId, tenantId), eq(tenantModuleConfigs.moduleKey, "consumer_accounts")))
      .limit(1);

    if (rows.length === 0) {
      return consumerAccountsConfigSchema.parse({});
    }

    try {
      return consumerAccountsConfigSchema.parse(JSON.parse(rows[0].config));
    } catch {
      return consumerAccountsConfigSchema.parse({});
    }
  }

  async createConsumerUser(tenantId: string, payload: ConsumerRegisterRequest): Promise<ConsumerUser> {
    const parsed = consumerRegisterRequestSchema.parse(payload);
    const emailNormalized = parsed.email ? normalizeConsumerEmail(parsed.email) : null;
    const phoneNormalized = parsed.phone ? normalizeConsumerPhone(parsed.phone) : null;

    if (emailNormalized) {
      const existingByEmail = await db
        .select({ id: consumerUsers.id })
        .from(consumerUsers)
        .where(and(eq(consumerUsers.tenantId, tenantId), eq(consumerUsers.emailNormalized, emailNormalized)))
        .limit(1);
      if (existingByEmail.length > 0) {
        throw new Error("Consumer account already exists for email");
      }
    }

    if (phoneNormalized) {
      const existingByPhone = await db
        .select({ id: consumerUsers.id })
        .from(consumerUsers)
        .where(and(eq(consumerUsers.tenantId, tenantId), eq(consumerUsers.phoneNormalized, phoneNormalized)))
        .limit(1);
      if (existingByPhone.length > 0) {
        throw new Error("Consumer account already exists for phone");
      }
    }

    const now = new Date();
    const inserted = await db
      .insert(consumerUsers)
      .values({
        id: `cu_${crypto.randomUUID()}`,
        tenantId,
        fullName: parsed.fullName.trim(),
        fullNameNormalized: normalizeCustomerName(parsed.fullName),
        email: parsed.email?.trim() ?? null,
        emailNormalized,
        phone: parsed.phone?.trim() ?? null,
        phoneNormalized,
        passwordHash: await hashPin(parsed.password),
        isActive: 1,
        createdAt: now,
        updatedAt: now
      })
      .returning();

    return this.mapConsumerUserRow(inserted[0]);
  }

  async findConsumerUserByCredentials(tenantId: string, payload: ConsumerLoginRequest): Promise<ConsumerUser | null> {
    const parsed = consumerLoginRequestSchema.parse(payload);
    const emailNormalized = parsed.email ? normalizeConsumerEmail(parsed.email) : null;
    const phoneNormalized = parsed.phone ? normalizeConsumerPhone(parsed.phone) : null;

    let rows: Array<typeof consumerUsers.$inferSelect> = [];
    if (emailNormalized) {
      rows = await db
        .select()
        .from(consumerUsers)
        .where(and(eq(consumerUsers.tenantId, tenantId), eq(consumerUsers.emailNormalized, emailNormalized), eq(consumerUsers.isActive, 1)))
        .limit(1);
    } else if (phoneNormalized) {
      rows = await db
        .select()
        .from(consumerUsers)
        .where(and(eq(consumerUsers.tenantId, tenantId), eq(consumerUsers.phoneNormalized, phoneNormalized), eq(consumerUsers.isActive, 1)))
        .limit(1);
    }

    const found = rows[0];
    if (!found) {
      return null;
    }

    const isValid = await verifyPin(parsed.password, found.passwordHash);
    if (!isValid) {
      return null;
    }

    return this.mapConsumerUserRow(found);
  }

  async findConsumerUserById(tenantId: string, consumerUserId: string): Promise<ConsumerUser | null> {
    const rows = await db
      .select()
      .from(consumerUsers)
      .where(and(eq(consumerUsers.tenantId, tenantId), eq(consumerUsers.id, consumerUserId), eq(consumerUsers.isActive, 1)))
      .limit(1);
    const found = rows[0];
    if (!found) {
      return null;
    }
    return this.mapConsumerUserRow(found);
  }

  async createConsumerSession(payload: {
    id: string;
    tenantId: string;
    consumerUserId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await db.insert(consumerSessions).values({
      id: payload.id,
      tenantId: payload.tenantId,
      consumerUserId: payload.consumerUserId,
      refreshTokenHash: payload.refreshTokenHash,
      expiresAt: payload.expiresAt,
      createdAt: new Date(),
      revokedAt: null
    });
  }

  async findActiveConsumerSessionByRefreshHash(refreshTokenHash: string): Promise<StoredConsumerSession | null> {
    const rows = await db
      .select()
      .from(consumerSessions)
      .where(eq(consumerSessions.refreshTokenHash, refreshTokenHash))
      .limit(1);
    const found = rows[0];
    if (!found || found.revokedAt || found.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return found;
  }

  async findActiveConsumerSessionById(sessionId: string, consumerUserId: string): Promise<StoredConsumerSession | null> {
    const rows = await db
      .select()
      .from(consumerSessions)
      .where(and(eq(consumerSessions.id, sessionId), eq(consumerSessions.consumerUserId, consumerUserId)))
      .limit(1);
    const found = rows[0];
    if (!found || found.revokedAt || found.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return found;
  }

  async revokeConsumerSessionById(sessionId: string): Promise<void> {
    await db.update(consumerSessions).set({ revokedAt: new Date() }).where(eq(consumerSessions.id, sessionId));
  }

  async revokeConsumerSessionByIdIfActive(sessionId: string): Promise<boolean> {
    const activeSession = await db
      .select({ id: consumerSessions.id })
      .from(consumerSessions)
      .where(and(eq(consumerSessions.id, sessionId), isNull(consumerSessions.revokedAt)))
      .limit(1);
    if (activeSession.length === 0) {
      return false;
    }
    await this.revokeConsumerSessionById(sessionId);
    return true;
  }

  async linkConsumerToOrder(tenantId: string, orderId: string, consumerUserId: string): Promise<void> {
    await db
      .insert(consumerOrderLinks)
      .values({
        tenantId,
        orderId,
        consumerUserId,
        createdAt: new Date()
      })
      .onConflictDoNothing();
  }

  async listConsumerOrderHistory(tenantId: string, consumerUserId: string): Promise<ConsumerOrderHistoryResponse> {
    const links = await db
      .select({ orderId: consumerOrderLinks.orderId })
      .from(consumerOrderLinks)
      .where(and(eq(consumerOrderLinks.tenantId, tenantId), eq(consumerOrderLinks.consumerUserId, consumerUserId)));

    const orderIds = links.map((entry) => entry.orderId);
    if (orderIds.length === 0) {
      return consumerOrderHistoryResponseSchema.parse([]);
    }

    const orderRows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), inArray(orders.id, orderIds)))
      .orderBy(desc(orders.timestamp));

    const itemRows = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.tenantId, tenantId), inArray(orderItems.orderId, orderIds)));

    const itemsByOrderId = new Map<string, Order["items"]>();
    for (const item of itemRows) {
      const existing = itemsByOrderId.get(item.orderId) ?? [];
      existing.push({
        id: item.menuItemId,
        orderItemId: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        ingredientOverrides: parseIngredientOverrides(item.ingredientOverrides),
        selectedModifiers: parseSelectedModifiers(item.selectedModifiers)
      });
      itemsByOrderId.set(item.orderId, existing);
    }

    return consumerOrderHistoryResponseSchema.parse(
      orderRows.map((row) => ({
        order: orderSchema.parse({
          id: row.id,
          orderType: row.orderType,
          table: row.tableNumber ?? undefined,
          ticketNumber: row.ticketNumber ?? undefined,
          customerName: row.customerName ?? undefined,
          customerId: row.customerId ?? undefined,
          items: itemsByOrderId.get(row.id) ?? [],
          total: Number(row.total),
          status: row.status,
          timestamp: row.timestamp.toISOString(),
          staffId: row.staffId
        })
      })),
    );
  }
}
