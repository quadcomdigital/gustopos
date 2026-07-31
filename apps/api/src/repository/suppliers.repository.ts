// ─── Suppliers Repository ──────────────────────────────────────────────────
// Extracted from AppRepository — Phase 3 of the Strangler Fig refactoring.
// Contains: suppliers CRUD, supplier-ingredient links, purchase orders, goods receipts.
// Internal cross-refs: createPurchaseOrder/updatePurchaseOrderStatus → this.listPurchaseOrders

import crypto from "node:crypto";
import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, inArray, lte, ne, type SQL } from "drizzle-orm";
import { db, withTenantTx } from "../db/client";
import {
  suppliers,
  supplierIngredients,
  purchaseOrders,
  purchaseOrderItems,
  goodsReceipts,
  goodsReceiptItems,
  inventory,
  stockMovements,
} from "../db/schema";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { purchaseOrderTransitions } from "./utils/state-machines";
import {
  supplierSchema,
  supplierCreateRequestSchema,
  supplierUpdateRequestSchema,
  suppliersQuerySchema,
  supplierIngredientSchema,
  supplierIngredientCreateSchema,
  supplierIngredientUpdateSchema,
  purchaseOrderSchema,
  purchaseOrderCreateRequestSchema,
  purchaseOrderStatusSchema,
  purchaseOrderStatusUpdateRequestSchema,
  purchaseOrdersQuerySchema,
  goodsReceiptSchema,
  goodsReceiptCreateRequestSchema,
  type Supplier,
  type SupplierCreateRequest,
  type SupplierUpdateRequest,
  type SuppliersQuery,
  type PurchaseOrder,
  type PurchaseOrderCreateRequest,
  type PurchaseOrderStatus,
  type PurchaseOrderStatusUpdateRequest,
  type PurchaseOrdersQuery,
  type PurchaseOrderItem,
  type GoodsReceipt,
  type GoodsReceiptCreateRequest,
} from "@gustopos/shared";

@Injectable()
export class SuppliersRepository {

  // ─── Suppliers CRUD ──────────────────────────────────────────────────

  async listSuppliers(query: SuppliersQuery): Promise<Supplier[]> {
    const parsed = suppliersQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();

    const rows = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.tenantId, tenantId))
      .orderBy(desc(suppliers.updatedAt))
      .limit(parsed.limit ?? 200);

    const filtered = rows.filter((row) => {
      if (parsed.active !== undefined && (row.isActive === 1) !== parsed.active) {
        return false;
      }
      if (parsed.query?.trim()) {
        const q = parsed.query.trim().toLowerCase();
        return (
          row.name.toLowerCase().includes(q) ||
          (row.vatNumber ?? "").toLowerCase().includes(q) ||
          (row.email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    return filtered.map((row) =>
      supplierSchema.parse({
        id: row.id,
        name: row.name,
        vatNumber: row.vatNumber ?? undefined,
        phone: row.phone ?? undefined,
        email: row.email ?? undefined,
        isActive: row.isActive === 1,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }),
    );
  }

  async createSupplier(payload: SupplierCreateRequest): Promise<Supplier> {
    const parsed = supplierCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();

    const inserted = await db
      .insert(suppliers)
      .values({
        id: `sup_${crypto.randomUUID()}`,
        tenantId,
        name: parsed.name.trim(),
        vatNumber: parsed.vatNumber ?? null,
        phone: parsed.phone ?? null,
        email: parsed.email ?? null,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const row = inserted[0];
    return supplierSchema.parse({
      id: row.id,
      name: row.name,
      vatNumber: row.vatNumber ?? undefined,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      isActive: row.isActive === 1,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async updateSupplier(id: string, payload: SupplierUpdateRequest): Promise<Supplier | null> {
    const parsed = supplierUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const updated = await db
      .update(suppliers)
      .set({
        ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
        ...(parsed.vatNumber !== undefined ? { vatNumber: parsed.vatNumber } : {}),
        ...(parsed.phone !== undefined ? { phone: parsed.phone } : {}),
        ...(parsed.email !== undefined ? { email: parsed.email } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return supplierSchema.parse({
      id: row.id,
      name: row.name,
      vatNumber: row.vatNumber ?? undefined,
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      isActive: row.isActive === 1,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  // ─── Supplier-Ingredient Links ───────────────────────────────────────

  async listSupplierIngredients(supplierId?: string, ingredientId?: string): Promise<Array<{
    supplierId: string; supplierName: string;
    ingredientId: string; ingredientName: string;
    brandName: string | null;
    unitCost: number | null; isPreferred: boolean;
  }>> {
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(supplierIngredients.tenantId, tenantId)];
    if (supplierId) conditions.push(eq(supplierIngredients.supplierId, supplierId));
    if (ingredientId) conditions.push(eq(supplierIngredients.ingredientId, ingredientId));

    const rows = await db
      .select({
        supplierId: supplierIngredients.supplierId,
        supplierName: suppliers.name,
        ingredientId: supplierIngredients.ingredientId,
        ingredientName: inventory.name,
        brandName: supplierIngredients.brandName,
        unitCost: supplierIngredients.unitCost,
        isPreferred: supplierIngredients.isPreferred,
      })
      .from(supplierIngredients)
      .innerJoin(suppliers, eq(supplierIngredients.supplierId, suppliers.id))
      .innerJoin(inventory, eq(supplierIngredients.ingredientId, inventory.id))
      .where(and(...conditions));

    return rows.map((r) => supplierIngredientSchema.parse({
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      ingredientId: r.ingredientId,
      ingredientName: r.ingredientName,
      brandName: r.brandName ?? null,
      unitCost: r.unitCost ? Number(r.unitCost) : null,
      isPreferred: r.isPreferred === 1,
    }));
  }

  async createSupplierIngredient(payload: { supplierId: string; ingredientId: string; brandName?: string; unitCost?: number; isPreferred?: boolean }): Promise<void> {
    const tenantId = getTenantIdOrDefault();
    const parsed = supplierIngredientCreateSchema.parse(payload);

    // If marking as preferred, unset other preferred suppliers for this ingredient
    if (parsed.isPreferred) {
      await db.update(supplierIngredients)
        .set({ isPreferred: 0 })
        .where(and(
          eq(supplierIngredients.tenantId, tenantId),
          eq(supplierIngredients.ingredientId, parsed.ingredientId),
        ));
    }

    await db.insert(supplierIngredients).values({
      tenantId,
      supplierId: parsed.supplierId,
      ingredientId: parsed.ingredientId,
      brandName: parsed.brandName ?? null,
      unitCost: parsed.unitCost?.toString() ?? null,
      isPreferred: parsed.isPreferred ? 1 : 0,
    }).onConflictDoUpdate({
      target: [supplierIngredients.tenantId, supplierIngredients.supplierId, supplierIngredients.ingredientId],
      set: {
        brandName: parsed.brandName ?? null,
        unitCost: parsed.unitCost?.toString() ?? null,
        isPreferred: parsed.isPreferred ? 1 : 0,
      },
    });
  }

  async updateSupplierIngredient(supplierId: string, ingredientId: string, payload: { brandName?: string; unitCost?: number; isPreferred?: boolean }): Promise<void> {
    const tenantId = getTenantIdOrDefault();
    const parsed = supplierIngredientUpdateSchema.parse(payload);

    if (parsed.isPreferred) {
      await db.update(supplierIngredients)
        .set({ isPreferred: 0 })
        .where(and(
          eq(supplierIngredients.tenantId, tenantId),
          eq(supplierIngredients.ingredientId, ingredientId),
          ne(supplierIngredients.supplierId, supplierId),
        ));
    }

    const sets: Record<string, unknown> = {};
    if (parsed.brandName !== undefined) sets.brandName = parsed.brandName ?? null;
    if (parsed.unitCost !== undefined) sets.unitCost = parsed.unitCost.toString();
    if (parsed.isPreferred !== undefined) sets.isPreferred = parsed.isPreferred ? 1 : 0;

    if (Object.keys(sets).length > 0) {
      await db.update(supplierIngredients)
        .set(sets)
        .where(and(
          eq(supplierIngredients.tenantId, tenantId),
          eq(supplierIngredients.supplierId, supplierId),
          eq(supplierIngredients.ingredientId, ingredientId),
        ));
    }
  }

  async deleteSupplierIngredient(supplierId: string, ingredientId: string): Promise<void> {
    const tenantId = getTenantIdOrDefault();
    await db.delete(supplierIngredients)
      .where(and(
        eq(supplierIngredients.tenantId, tenantId),
        eq(supplierIngredients.supplierId, supplierId),
        eq(supplierIngredients.ingredientId, ingredientId),
      ));
  }

  async getSupplierIngredientsForPo(supplierId: string): Promise<Array<{
    ingredientId: string;
    name: string;
    brandName: string | null;
    supplierCost: number | null;
    currentCost: number;
    currentStock: number;
    unit: string;
  }>> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select({
        ingredientId: supplierIngredients.ingredientId,
        name: inventory.name,
        brandName: supplierIngredients.brandName,
        supplierCost: supplierIngredients.unitCost,
        currentCost: inventory.unitCost,
        currentStock: inventory.quantity,
        unit: inventory.unit,
      })
      .from(supplierIngredients)
      .innerJoin(inventory, eq(supplierIngredients.ingredientId, inventory.id))
      .where(and(
        eq(supplierIngredients.tenantId, tenantId),
        eq(supplierIngredients.supplierId, supplierId),
        eq(inventory.isActive, 1),
      ));
    return rows.map(r => ({
      ingredientId: r.ingredientId,
      name: r.name,
      brandName: r.brandName ?? null,
      supplierCost: r.supplierCost ? Number(r.supplierCost) : null,
      currentCost: Number(r.currentCost),
      currentStock: Number(r.currentStock),
      unit: r.unit,
    }));
  }

  // ─── Purchase Orders ─────────────────────────────────────────────────

  async listPurchaseOrders(query: PurchaseOrdersQuery): Promise<PurchaseOrder[]> {
    const parsed = purchaseOrdersQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(purchaseOrders.tenantId, tenantId)];

    if (parsed.supplierId) {
      conditions.push(eq(purchaseOrders.supplierId, parsed.supplierId));
    }
    if (parsed.status) {
      conditions.push(eq(purchaseOrders.status, parsed.status));
    }
    if (parsed.from) {
      conditions.push(gte(purchaseOrders.createdAt, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(purchaseOrders.createdAt, new Date(parsed.to)));
    }

    const rows = await db
      .select()
      .from(purchaseOrders)
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(parsed.limit ?? 200);

    const ids = rows.map((row) => row.id);
    const poItems =
      ids.length > 0
        ? await db
            .select()
            .from(purchaseOrderItems)
            .where(and(eq(purchaseOrderItems.tenantId, tenantId), inArray(purchaseOrderItems.purchaseOrderId, ids)))
        : [];
    const poItemIds = poItems.map((item) => item.id);
    const receiptItems =
      poItemIds.length > 0
        ? await db
            .select()
            .from(goodsReceiptItems)
            .where(and(eq(goodsReceiptItems.tenantId, tenantId), inArray(goodsReceiptItems.purchaseOrderItemId, poItemIds)))
        : [];

    const receivedByItem = new Map<string, number>();
    for (const item of receiptItems) {
      receivedByItem.set(item.purchaseOrderItemId, (receivedByItem.get(item.purchaseOrderItemId) ?? 0) + Number(item.receivedQty));
    }

    const itemsByPo = new Map<string, PurchaseOrderItem[]>();
    for (const item of poItems) {
      const existing = itemsByPo.get(item.purchaseOrderId) ?? [];
      existing.push({
        id: item.id,
        inventoryId: item.inventoryId ?? undefined,
        itemName: item.itemName,
        unit: item.unit,
        orderedQty: Number(item.orderedQty),
        unitCost: Number(item.unitCost),
        receivedQty: Number((receivedByItem.get(item.id) ?? 0).toFixed(3)),
      });
      itemsByPo.set(item.purchaseOrderId, existing);
    }

    return rows.map((row) =>
      purchaseOrderSchema.parse({
        id: row.id,
        supplierId: row.supplierId,
        status: purchaseOrderStatusSchema.parse(row.status),
        expectedAt: row.expectedAt ? row.expectedAt.toISOString() : undefined,
        notes: row.notes ?? undefined,
        items: itemsByPo.get(row.id) ?? [],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }),
    );
  }

  async createPurchaseOrder(payload: PurchaseOrderCreateRequest): Promise<PurchaseOrder> {
    const parsed = purchaseOrderCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();
    const poId = `po_${crypto.randomUUID()}`;

    const supplierRows = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.id, parsed.supplierId), eq(suppliers.isActive, 1)))
      .limit(1);
    if (supplierRows.length === 0) {
      throw new Error("Supplier not found or inactive");
    }

    await withTenantTx(async (tx) => {
      await tx.insert(purchaseOrders).values({
        id: poId,
        tenantId,
        supplierId: parsed.supplierId,
        status: "draft",
        expectedAt: parsed.expectedAt ? new Date(parsed.expectedAt) : null,
        notes: parsed.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(purchaseOrderItems).values(
        parsed.items.map((item, index) => ({
          id: `poi_${crypto.randomUUID()}_${index}`,
          tenantId,
          purchaseOrderId: poId,
          inventoryId: item.inventoryId ?? null,
          itemName: item.itemName,
          unit: item.unit,
          orderedQty: String(item.orderedQty),
          unitCost: String(item.unitCost),
          createdAt: now,
        })),
      );
    });

    const orders = await this.listPurchaseOrders({ supplierId: parsed.supplierId, limit: 200 });
    const created = orders.find((entry) => entry.id === poId);
    if (!created) {
      throw new Error("Purchase order creation failed");
    }
    return created;
  }

  async updatePurchaseOrderStatus(id: string, payload: PurchaseOrderStatusUpdateRequest): Promise<PurchaseOrder | null> {
    const parsed = purchaseOrderStatusUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const existingRows = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, id)))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) {
      return null;
    }

    const currentStatus = purchaseOrderStatusSchema.parse(existing.status);
    if (!purchaseOrderTransitions[currentStatus].includes(parsed.status)) {
      throw new Error(`Purchase order transition not allowed: ${currentStatus} -> ${parsed.status}`);
    }

    await db
      .update(purchaseOrders)
      .set({ status: parsed.status, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, id)));

    const rows = await this.listPurchaseOrders({ limit: 200 });
    return rows.find((entry) => entry.id === id) ?? null;
  }

  // ─── Goods Receipts ──────────────────────────────────────────────────

  async createGoodsReceipt(purchaseOrderId: string, payload: GoodsReceiptCreateRequest, actorStaffId?: string): Promise<GoodsReceipt> {
    const parsed = goodsReceiptCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();
    const receiptId = `gr_${crypto.randomUUID()}`;

    return withTenantTx(async (tx) => {
      const orderRows = await tx
        .select()
        .from(purchaseOrders)
        .where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, purchaseOrderId)))
        .limit(1);
      const order = orderRows[0];
      if (!order) {
        throw new Error("Purchase order not found");
      }

      const poItems = await tx
        .select()
        .from(purchaseOrderItems)
        .where(and(eq(purchaseOrderItems.tenantId, tenantId), eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId)));
      const itemById = new Map(poItems.map((item) => [item.id, item]));

      const invalidItem = parsed.items.find((item) => !itemById.has(item.purchaseOrderItemId));
      if (invalidItem) {
        throw new Error(`PO item not found: ${invalidItem.purchaseOrderItemId}`);
      }

      await tx.insert(goodsReceipts).values({
        id: receiptId,
        tenantId,
        purchaseOrderId,
        receivedAt: new Date(parsed.receivedAt),
        staffId: actorStaffId ?? null,
        notes: parsed.notes ?? null,
        createdAt: now,
      });

      await tx.insert(goodsReceiptItems).values(
        parsed.items.map((item, index) => ({
          id: `gri_${crypto.randomUUID()}_${index}`,
          tenantId,
          goodsReceiptId: receiptId,
          purchaseOrderItemId: item.purchaseOrderItemId,
          receivedQty: String(item.receivedQty),
          unitCost: String(item.unitCost),
        })),
      );

      for (const entry of parsed.items) {
        const poItem = itemById.get(entry.purchaseOrderItemId);
        if (!poItem?.inventoryId) {
          continue;
        }

        const invRows = await tx
          .select()
          .from(inventory)
          .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, poItem.inventoryId)))
          .for("update")
          .limit(1);
        const inv = invRows[0];
        if (!inv) {
          continue;
        }

        const oldQty = Number(inv.quantity);
        const addQty = Number(entry.receivedQty);
        const nextQty = oldQty + addQty;

        await tx
          .update(inventory)
          .set({ quantity: String(nextQty) })
          .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, inv.id)));

        await tx.insert(stockMovements).values({
          id: crypto.randomUUID(),
          tenantId,
          ingredientId: inv.id,
          orderId: null,
          movementType: "purchase_receipt",
          quantity: String(addQty),
          previousQuantity: String(oldQty),
          newQuantity: String(nextQty),
          notes: `Goods receipt ${receiptId}`,
          staffId: actorStaffId ?? null,
        });

        // Update generic ingredient cost with received cost
        if (entry.unitCost) {
          await tx
            .update(inventory)
            .set({ unitCost: String(entry.unitCost) })
            .where(and(eq(inventory.id, inv.id), eq(inventory.tenantId, tenantId)));
        }

        // Update supplier-specific ingredient cost
        if (entry.unitCost && order.supplierId) {
          await tx
            .update(supplierIngredients)
            .set({ unitCost: String(entry.unitCost) })
            .where(and(
              eq(supplierIngredients.tenantId, tenantId),
              eq(supplierIngredients.supplierId, order.supplierId),
              eq(supplierIngredients.ingredientId, inv.id),
            ));
        }
      }

      const allReceipts = await tx
        .select()
        .from(goodsReceiptItems)
        .where(and(eq(goodsReceiptItems.tenantId, tenantId), inArray(goodsReceiptItems.purchaseOrderItemId, poItems.map((x) => x.id))));

      const receivedByItem = new Map<string, number>();
      for (const item of allReceipts) {
        receivedByItem.set(item.purchaseOrderItemId, (receivedByItem.get(item.purchaseOrderItemId) ?? 0) + Number(item.receivedQty));
      }

      const isComplete = poItems.every((item) => (receivedByItem.get(item.id) ?? 0) >= Number(item.orderedQty));
      const hasAny = poItems.some((item) => (receivedByItem.get(item.id) ?? 0) > 0);

      let nextStatus: PurchaseOrderStatus = purchaseOrderStatusSchema.parse(order.status);
      if (isComplete) {
        nextStatus = "received";
      } else if (hasAny && nextStatus !== "received") {
        nextStatus = "partial_received";
      }

      await tx
        .update(purchaseOrders)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.id, purchaseOrderId)));

      return goodsReceiptSchema.parse({
        id: receiptId,
        purchaseOrderId,
        receivedAt: new Date(parsed.receivedAt).toISOString(),
        notes: parsed.notes ?? undefined,
        items: parsed.items,
        createdAt: now.toISOString(),
      });
    });
  }
}
