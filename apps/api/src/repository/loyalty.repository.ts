import { Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { loyaltyPoints, loyaltyTransactions } from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import type { LoyaltyBalance, LoyaltyTransaction } from "@gustopos/shared";

@Injectable()
export class LoyaltyRepository {
  async getLoyaltyBalance(customerId: string): Promise<LoyaltyBalance> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, tenantId), eq(loyaltyPoints.customerId, customerId)))
      .limit(1);

    if (rows.length === 0) {
      return { customerId, points: 0, totalEarned: 0, totalRedeemed: 0 };
    }

    const row = rows[0];
    return {
      customerId: row.customerId,
      points: row.points,
      totalEarned: row.totalEarned,
      totalRedeemed: row.totalRedeemed
    };
  }

  async earnLoyaltyPoints(customerId: string, points: number, orderId?: string, notes?: string): Promise<LoyaltyTransaction> {
    const tenantId = getTenantIdOrDefault();
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const id = `lpt_${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Upsert the balance row
    const existingRows = await db
      .select()
      .from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, tenantId), eq(loyaltyPoints.customerId, customerId)))
      .limit(1);

    if (existingRows.length === 0) {
      await db.insert(loyaltyPoints).values({
        id: `lp_${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tenantId,
        customerId,
        points,
        totalEarned: points,
        totalRedeemed: 0,
        createdAt: nowDate,
        updatedAt: nowDate
      });
    } else {
      const existing = existingRows[0];
      await db
        .update(loyaltyPoints)
        .set({
          points: existing.points + points,
          totalEarned: existing.totalEarned + points,
          updatedAt: nowDate
        })
        .where(eq(loyaltyPoints.id, existing.id));
    }

    // Insert the transaction record
    await db.insert(loyaltyTransactions).values({
      id,
      tenantId,
      customerId,
      type: "earn",
      points,
      orderId: orderId ?? null,
      notes: notes ?? null,
      createdAt: nowDate
    });

    return { id, customerId, type: "earn", points, orderId, notes, createdAt: now };
  }

  async redeemLoyaltyPoints(customerId: string, points: number, orderId?: string): Promise<LoyaltyTransaction> {
    const tenantId = getTenantIdOrDefault();
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const id = `lpt_${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const existingRows = await db
      .select()
      .from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.tenantId, tenantId), eq(loyaltyPoints.customerId, customerId)))
      .limit(1);

    if (existingRows.length === 0 || existingRows[0].points < points) {
      throw new Error("Punti insufficienti per il riscatto");
    }

    const existing = existingRows[0];
    await db
      .update(loyaltyPoints)
      .set({
        points: existing.points - points,
        totalRedeemed: existing.totalRedeemed + points,
        updatedAt: nowDate
      })
      .where(eq(loyaltyPoints.id, existing.id));

    await db.insert(loyaltyTransactions).values({
      id,
      tenantId,
      customerId,
      type: "redeem",
      points: -points,
      orderId: orderId ?? null,
      notes: null,
      createdAt: nowDate
    });

    return { id, customerId, type: "redeem", points: -points, orderId, createdAt: now };
  }

  async listLoyaltyTransactions(customerId: string, limit = 50): Promise<LoyaltyTransaction[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(loyaltyTransactions)
      .where(and(eq(loyaltyTransactions.tenantId, tenantId), eq(loyaltyTransactions.customerId, customerId)))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      customerId: row.customerId,
      type: row.type as "earn" | "redeem" | "adjust",
      points: row.points,
      orderId: row.orderId ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString()
    }));
  }
}
