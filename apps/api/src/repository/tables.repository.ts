import { Injectable } from "@nestjs/common";
import { db, withTenantTx } from "../db/client";
import { tables, orders, orderItems, payments, paymentItems,
  reservations, deliveryOrders, printJobs, appSettings, menuItems,
  menuModifierGroups, menuModifierOptions, menuModifierOptionOverrides,
  categories, categoryModifierPools, categoryModifierPoolOptions, inventory,
} from "../db/schema";
import { eq, and, ne, inArray, sql, desc, asc, gte, lte, or, like, lt, isNotNull, type SQL } from "drizzle-orm";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { EscPosBuilder, RECEIPT_WIDTH, padRight, buildCashierReceiptPayload } from "./utils/escpos-builder";
import crypto from "node:crypto";
import {
  closeTableRequestSchema, closeTableResponseSchema,
  tableCreateRequestSchema, tableUpdateRequestSchema, tableBulkCreateRequestSchema,
  splitBillRequestSchema, splitBillResponseSchema,
  paySelectedItemsRequestSchema, paySelectedItemsResponseSchema,
  markShareAsPaidRequestSchema, markShareAsPaidResponseSchema,
  transferTableRequestSchema, transferTableResponseSchema,
  reservationCreateRequestSchema, reservationUpdateRequestSchema,
  reservationSchema, reservationListResponseSchema, reservationsQuerySchema,
  reservationStatusSchema, reservationNoShowRequestSchema,
  deliveryOrderSchema, deliveryStatusUpdateRequestSchema, deliveryStatusSchema,
  deliveryOrdersListResponseSchema, deliveryOrdersQuerySchema, deliveryUpsertRequestSchema,
  operationalSummaryQuerySchema, reservationsSummarySchema, deliverySummarySchema,
  uiSettingsSchema, printAreaSchema,
  type PrintArea, type UiSettings, type ReservationStatus, type DeliveryStatus,
  type PaymentStatus, type Order, defaultUiSettings,
  type Table, type TableCreateRequest, type TableUpdateRequest, type TableBulkCreateRequest,
  type CloseTableRequest, type CloseTableResponse,
  type SplitBillRequest, type SplitBillResponse,
  type PaySelectedItemsRequest, type PaySelectedItemsResponse,
  type MarkShareAsPaidRequest, type MarkShareAsPaidResponse,
  type TransferTableRequest, type TransferTableResponse,
  type Reservation, type ReservationCreateRequest, type ReservationUpdateRequest,
  type ReservationsQuery, type ReservationsSummary,
  type DeliveryOrder, type DeliveryStatusUpdateRequest, type DeliveryUpsertRequest,
  type DeliveryOrdersQuery, type DeliverySummary,
  type OperationalSummaryQuery,
} from "@gustopos/shared";

function parsePrintAreas(raw: string|null|undefined): PrintArea[] { if(!raw) return ["kitchen"]; try { const p=JSON.parse(raw); if(!Array.isArray(p)) return ["kitchen"]; const v=p.map((e:unknown)=>{try{return printAreaSchema.parse(e)}catch{return null}}).filter((e):e is PrintArea=>e!==null); return v.length>0?v:["kitchen"]; } catch { return ["kitchen"]; } }

const reservationTransitions: Record<ReservationStatus, ReservationStatus[]> = {
  pending: ["confirmed", "cancelled", "no_show", "seated"],
  confirmed: ["seated", "cancelled", "no_show"],
  seated: ["cancelled"],
  cancelled: [],
  no_show: [],
};
const deliveryTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

@Injectable()
export class TablesRepository {
  private readonly settingsKey = "global_ui_settings";

  private mergeUiSettingsWithDefaults(raw: unknown): UiSettings {
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const theme = obj.theme && typeof obj.theme === "object" ? (obj.theme as Record<string, unknown>) : {};
    const printing = obj.printing && typeof obj.printing === "object" ? (obj.printing as Record<string, unknown>) : {};
    return uiSettingsSchema.parse({ ...defaultUiSettings, ...obj, theme: { ...defaultUiSettings.theme, ...theme }, printing: { ...defaultUiSettings.printing, ...printing } });
  }

  private currentTenantId(): string { return getTenantIdOrDefault(); }

  private buildEscPosPayload(params: {
    order: Order;
    area: PrintArea;
    items: Array<{ name: string; quantity: number; price: number; notes: string; modifiers: string[]; modifierOptionIds: string[]; overrides: string[] }>;
    kitchenSummary: Record<string, number> | null;
    settings: UiSettings;
    priceDeltaByOptionId: Map<string, number>;
  }): string {
    const { order, area, items, kitchenSummary, settings, priceDeltaByOptionId } = params;
    const showPrice = area === "cashier";
    const ep = new EscPosBuilder();

    ep.init();

    if (settings.printing.logoMode === "bitmap" && settings.printing.logoBitmap) {
      ep.raw(0x1B, 0x33, 0x0A);
      ep.line(`LOGO_BITMAP:${settings.printing.logoWidth}:${settings.printing.logoThreshold}`);
      ep.raw(0x1B, 0x32);
    }

    ep.align("center").doubleWidth(true).bold(true);
    ep.line(area.toUpperCase());
    ep.doubleWidth(false).bold(false);
    ep.align("left").line();

    const orderTypeLabel = order.orderType === "takeaway" ? "Take away" : order.orderType === "delivery" ? "Delivery" : order.orderType === "dine_in" ? "Dine-in" : order.orderType;
    const ref = order.orderType === "dine_in"
      ? `Tavolo: ${order.table ?? "-"}`
      : `Cliente: ${order.customerName ?? "-"}`;
    ep.line(`Ordine: ${order.id.slice(0, 8)} | ${orderTypeLabel}`);
    ep.line(ref);
    if (order.customerPhone) {
      ep.line(`Telefono: ${order.customerPhone}`);
    }
    if (order.ticketNumber) {
      ep.line(`Ticket: ${order.ticketNumber}`);
    }
    if (order.scheduledFor) {
      const scheduledDate = new Date(order.scheduledFor);
      const time = scheduledDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
      ep.bold(true).line(`Consegna: ${time}`).bold(false);
    }
    ep.line();

    if (kitchenSummary && area === "kitchen" && Object.keys(kitchenSummary).length > 0) {
      const sep = "-".repeat(RECEIPT_WIDTH);
      ep.bold(true).line(sep);
      ep.align("center").line("*** REF ***");
      ep.align("left").bold(false);
      for (const [name, count] of Object.entries(kitchenSummary)) {
        ep.line(`${padRight(name.toUpperCase(), 24)} ${String(count).padStart(4)}`);
      }
      ep.bold(true).line(sep);
      ep.bold(false).line();
    }

    for (const item of items) {
      const label = `${item.quantity}x ${item.name}`;
      if (showPrice) {
        const priceStr = `EUR ${(item.price * item.quantity).toFixed(2)}`;
        const pad = RECEIPT_WIDTH - label.length - priceStr.length;
        ep.line(`${label}${" ".repeat(Math.max(1, pad))}${priceStr}`);
      } else {
        // Legacy PHP: bar/kitchen items at double width (GS ! 16), no bold
        ep.doubleWidth(true).line(label);
      }

      // Modifiers/overrides/notes inherit the item size (legacy PHP prints them while FontLarge is active)
      for (let i = 0; i < item.modifiers.length; i++) {
        const modName = item.modifiers[i];
        if (showPrice) {
          const optId = item.modifierOptionIds[i];
          const pd = priceDeltaByOptionId.get(optId) ?? 0;
          ep.line(pd > 0 ? `  ${modName} +EUR ${pd.toFixed(2)}` : `  ${modName}`);
        } else {
          ep.line(`  ${modName}`);
        }
      }
      for (const ovr of item.overrides) {
        if (showPrice) {
          ep.font("b").line(`  ${ovr}`).font("a");
        } else {
          ep.line(`  ${ovr}`);
        }
      }
      if (item.notes) {
        if (showPrice) {
          ep.font("b").line(`  * ${item.notes}`).font("a");
        } else {
          ep.line(`  * ${item.notes}`);
        }
      }
      if (!showPrice) {
        ep.doubleWidth(false);
      }
      ep.line();
    }

    if (showPrice) {
      const sep = "-".repeat(RECEIPT_WIDTH);
      ep.line(sep);
      const totalLabel = "TOTALE";
      const totalVal = `EUR ${order.total.toFixed(2)}`;
      const pad = RECEIPT_WIDTH - totalLabel.length - totalVal.length;
      ep.bold(true).line(`${totalLabel}${" ".repeat(Math.max(1, pad))}${totalVal}`).bold(false);
      ep.line();
      if (settings.printing.receiptFooter) {
        ep.align("center").line(settings.printing.receiptFooter);
      }
    }

    // Paper feed + full cut (NO ESC @ before cut to avoid clearing printer buffer)
    ep.feed(5);
    ep.cut();
    return ep.build();
  }

  async getUiSettings(): Promise<UiSettings> {
    const tenantId = this.currentTenantId();
    const rows = await db
      .select()
      .from(appSettings)
      .where(and(eq(appSettings.tenantId, tenantId), eq(appSettings.key, this.settingsKey)))
      .limit(1);
    if (rows.length === 0) {
      return defaultUiSettings;
    }

    const row = rows[0];
    try {
      const raw = JSON.parse(row.value) as unknown;
      const parsed = uiSettingsSchema.safeParse(raw);
      if (parsed.success) {
        return parsed.data;
      }

      console.error("[settings] uiSettingsSchema parse failed, merging defaults", {
        tenantId,
        key: this.settingsKey,
        error: parsed.error.flatten(),
      });

      return this.mergeUiSettingsWithDefaults(raw);
    } catch (error) {
      console.error("[settings] Failed to parse settings JSON, falling back to defaults", {
        tenantId,
        key: this.settingsKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return defaultUiSettings;
    }
  }

  async listTables(): Promise<Table[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(tables)
      .where(eq(tables.tenantId, tenantId))
      .orderBy(tables.number);

    return rows.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status as Table["status"],
      currentOrderId: row.currentOrderId ?? undefined,
    }));
  }

  async createTable(payload: TableCreateRequest): Promise<Table> {
    const tenantId = getTenantIdOrDefault();
    const parsed = tableCreateRequestSchema.parse(payload);
    const id = `tbl_${crypto.randomUUID()}`;

    // Check for duplicate table number
    const existing = await db
      .select()
      .from(tables)
      .where(and(eq(tables.tenantId, tenantId), eq(tables.number, parsed.number)))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Table number "${parsed.number}" already exists`);
    }

    const [created] = await db
      .insert(tables)
      .values({
        id,
        tenantId,
        number: parsed.number,
        status: "free",
        currentOrderId: null,
      })
      .returning();

    return {
      id: created.id,
      number: created.number,
      status: created.status as Table["status"],
      currentOrderId: created.currentOrderId ?? undefined,
    };
  }

  async bulkCreateTables(payload: TableBulkCreateRequest): Promise<Table[]> {
    const tenantId = getTenantIdOrDefault();
    const parsed = tableBulkCreateRequestSchema.parse(payload);
    const prefix = parsed.prefix ?? "";
    const now = new Date();
    const created: Table[] = [];

    // Find the highest existing table number to continue from
    const existingRows = await db
      .select({ number: tables.number })
      .from(tables)
      .where(eq(tables.tenantId, tenantId));

    const existingNumbers = new Set(existingRows.map((r) => r.number));

    let startNum = 1;
    for (let i = 1; i <= parsed.count + existingNumbers.size; i++) {
      const numStr = `${prefix}${i}`;
      if (!existingNumbers.has(numStr)) {
        startNum = i;
        break;
      }
    }

    for (let i = 0; i < parsed.count; i++) {
      const numStr = `${prefix}${startNum + i}`;
      if (existingNumbers.has(numStr)) {
        throw new Error(`Table number "${numStr}" already exists`);
      }
      existingNumbers.add(numStr);

      const id = `tbl_${crypto.randomUUID()}`;
      const [row] = await db
        .insert(tables)
        .values({
          id,
          tenantId,
          number: numStr,
          status: "free",
          currentOrderId: null,
        })
        .returning();

      created.push({
        id: row.id,
        number: row.number,
        status: row.status as Table["status"],
        currentOrderId: row.currentOrderId ?? undefined,
      });
    }

    return created;
  }

  async updateTable(id: string, payload: TableUpdateRequest): Promise<Table | null> {
    const tenantId = getTenantIdOrDefault();
    const parsed = tableUpdateRequestSchema.parse(payload);

    const existing = await db
      .select()
      .from(tables)
      .where(and(eq(tables.tenantId, tenantId), eq(tables.id, id)))
      .limit(1);

    if (existing.length === 0) {
      return null;
    }

    // If updating number, check for duplicates
    if (parsed.number !== undefined) {
      const duplicate = await db
        .select()
        .from(tables)
        .where(and(eq(tables.tenantId, tenantId), eq(tables.number, parsed.number), ne(tables.id, id)))
        .limit(1);

      if (duplicate.length > 0) {
        throw new Error(`Table number "${parsed.number}" already exists`);
      }
    }

    const [updated] = await db
      .update(tables)
      .set({
        ...(parsed.number !== undefined ? { number: parsed.number } : {}),
      })
      .where(and(eq(tables.tenantId, tenantId), eq(tables.id, id)))
      .returning();

    return {
      id: updated.id,
      number: updated.number,
      status: updated.status as Table["status"],
      currentOrderId: updated.currentOrderId ?? undefined,
    };
  }

  async deleteTable(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();

    const existing = await db
      .select()
      .from(tables)
      .where(and(eq(tables.tenantId, tenantId), eq(tables.id, id)))
      .limit(1);

    if (existing.length === 0) {
      return false;
    }

    // Cannot delete table with active order
    if (existing[0].currentOrderId) {
      throw new Error("Cannot delete a table with an active order");
    }

    await db
      .delete(tables)
      .where(and(eq(tables.tenantId, tenantId), eq(tables.id, id)));

    return true;
  }

  async closeTable(tableId: string, payload: CloseTableRequest, actorStaffId: string): Promise<CloseTableResponse | null> {
    const parsed = closeTableRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const paymentStatus: PaymentStatus = parsed.paymentStatus ?? "captured";
    const requiresGatewayReference = parsed.method === "card" || parsed.method === "mixed";
    if (requiresGatewayReference) {
      if (!parsed.gatewayReference || parsed.gatewayReference.trim().length < 3) {
        throw new Error("Gateway reference is required for card/mixed payments");
      }
      if (paymentStatus !== "captured") {
        throw new Error("Card/mixed payments must be captured before closing table");
      }
    }

    // Cashier close-receipt items (hoisted so they are usable after the tx for the print job).
    const receiptItems: Array<{ name: string; quantity: number; price: number; notes: string | null }> = [];

    const result = await withTenantTx(async (tx) => {
      await tx.execute(sql`
        SELECT id
        FROM tables
        WHERE tenant_id = ${tenantId} AND id = ${tableId}
        FOR UPDATE
      `);
      const tableRows = await tx
        .select()
        .from(tables)
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)))
        .limit(1);
      const table = tableRows[0];
      if (!table) {
        return null;
      }

      const openOrders = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.tableNumber, table.number), ne(orders.status, "paid"), ne(orders.status, "cancelled")));
      await tx.execute(sql`
        SELECT id
        FROM orders
        WHERE tenant_id = ${tenantId} AND table_number = ${table.number} AND status <> 'paid' AND status <> 'cancelled'
        FOR UPDATE
      `);

      const subtotal = openOrders.reduce((sum, order) => sum + Number(order.total), 0);
      if (subtotal <= 0) {
        throw new Error("No payable balance for this table");
      }

      const orderIds = openOrders.map((o) => o.id);

      const existingSplitPayments = await tx
        .select()
        .from(payments)
        .where(and(
          eq(payments.tenantId, tenantId),
          eq(payments.tableId, tableId),
        ));

      const hasSplitPayments = existingSplitPayments.some((p) => p.shareIndex !== null);
      const allSplitCaptured = hasSplitPayments && existingSplitPayments.every((p) => p.paymentStatus === "captured");

      let allItemsAlreadyPaid = false;
      if (orderIds.length > 0) {
        const orderItemRows = await tx
          .select()
          .from(orderItems)
          .where(and(eq(orderItems.tenantId, tenantId), inArray(orderItems.orderId, orderIds)));

        for (const it of orderItemRows) {
          receiptItems.push({ name: it.name, quantity: it.quantity, price: Number(it.price), notes: it.notes });
        }

        if (!hasSplitPayments) {
          const totalItemsQty = orderItemRows.reduce((sum, item) => sum + item.quantity, 0);

          const paymentItemRows = await tx
            .select()
            .from(paymentItems)
            .where(and(
              eq(paymentItems.tenantId, tenantId),
              inArray(
                paymentItems.orderItemId,
                orderItemRows.map((item) => item.id)
              )
            ));

          const paidItemsQty = paymentItemRows.reduce((sum, item) => sum + item.quantity, 0);

          // Only block if SOME items were individually paid but not all —
          // that's a partial-payment state requiring pay-items-specifici to finish.
          // If paidItemsQty is 0 (nothing paid yet), "Chiudi conto completo" pays everything at once.
          if (paidItemsQty > 0 && paidItemsQty < totalItemsQty) {
            throw new Error(`Not all items have been paid. Paid: ${paidItemsQty}, Total: ${totalItemsQty}`);
          }
          // All items paid via paySelectedItems — flag to avoid double-counting a new payment
          allItemsAlreadyPaid = totalItemsQty > 0 && paidItemsQty >= totalItemsQty;
        } else if (!allSplitCaptured) {
          throw new Error("Not all split payments are captured");
        }
      }

      const discountAmount = Math.max(0, parsed.discountAmount ?? 0);
      const surchargeAmount = Math.max(0, parsed.surchargeAmount ?? 0);
      const total = Math.max(0, Number((subtotal - discountAmount + surchargeAmount).toFixed(2)));
      if (total <= 0) {
        throw new Error("Final total must be greater than zero");
      }

      const paidAmount = parsed.paidAmount ?? total;
      if (!allItemsAlreadyPaid && paidAmount < total) {
        throw new Error("Paid amount is lower than total");
      }

      const changeAmount = allItemsAlreadyPaid ? 0 : Math.max(0, paidAmount - total);

      let paymentRow;

      if (allItemsAlreadyPaid) {
        // All items already paid via paySelectedItems — aggregate existing payments, don't create a new one
        const existingItemPayments = await tx
          .select()
          .from(payments)
          .where(and(
            eq(payments.tenantId, tenantId),
            eq(payments.tableId, tableId),
          ));
        const lastPayment = existingItemPayments[existingItemPayments.length - 1];
        // Update the last payment with close info (discount/surcharge adjustments)
        [paymentRow] = await tx
          .update(payments)
          .set({
            discountAmount: String(discountAmount),
            surchargeAmount: String(surchargeAmount),
            total: String(total),
            changeAmount: String(changeAmount),
            notes: parsed.notes ?? null,
            staffId: actorStaffId,
          })
          .where(eq(payments.id, lastPayment.id))
          .returning();
      } else if (hasSplitPayments) {
        const totalPaid = existingSplitPayments.reduce((sum, p) => sum + Number(p.paidAmount), 0);
        paymentRow = {
          id: existingSplitPayments[0].id,
          tableId,
          tableNumber: table.number,
          subtotal: String(total),
          discountAmount: String(discountAmount),
          surchargeAmount: String(surchargeAmount),
          total: String(total),
          method: parsed.method,
          kind: "sale",
          paymentStatus: "captured",
          paidAmount: String(totalPaid),
          changeAmount: String(Math.max(0, totalPaid - total)),
          reference: null,
          gatewayReference: null,
          capturedAt: new Date(),
          refundedPaymentId: null,
          refundReason: null,
          notes: null,
          staffId: actorStaffId,
          createdAt: new Date(),
        };
      } else {
        const paymentId = `pay_${Date.now().toString(36)}`;
        [paymentRow] = await tx
          .insert(payments)
          .values({
            id: paymentId,
            tenantId,
            tableId,
            tableNumber: table.number,
            subtotal: String(subtotal),
            discountAmount: String(discountAmount),
            surchargeAmount: String(surchargeAmount),
            total: String(total),
            method: parsed.method,
            kind: "sale",
            paymentStatus,
            paidAmount: String(paidAmount),
            changeAmount: String(changeAmount),
            reference: null,
            gatewayReference: parsed.gatewayReference?.trim() ?? null,
            capturedAt: paymentStatus === "captured" ? new Date() : null,
            refundedPaymentId: null,
            refundReason: null,
            notes: parsed.notes ?? null,
            staffId: actorStaffId,
            createdAt: new Date(),
          })
          .returning();
      }

      await tx
        .update(orders)
        .set({ status: "paid" })
        .where(and(eq(orders.tenantId, tenantId), eq(orders.tableNumber, table.number), ne(orders.status, "paid"), ne(orders.status, "cancelled")));

      await tx
        .update(tables)
        .set({ status: "free", currentOrderId: null })
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)));

      return closeTableResponseSchema.parse({
        success: true,
        payment: {
          id: paymentRow.id,
          tableId: paymentRow.tableId,
          tableNumber: paymentRow.tableNumber,
          subtotal: Number(paymentRow.subtotal),
          discountAmount: Number(paymentRow.discountAmount),
          surchargeAmount: Number(paymentRow.surchargeAmount),
          total: Number(paymentRow.total),
          method: paymentRow.method,
          kind: paymentRow.kind as "sale" | "refund",
          paymentStatus: paymentRow.paymentStatus as PaymentStatus,
          paidAmount: Number(paymentRow.paidAmount),
          changeAmount: Number(paymentRow.changeAmount),
          reference: paymentRow.reference ?? undefined,
          gatewayReference: paymentRow.gatewayReference ?? undefined,
          capturedAt: paymentRow.capturedAt?.toISOString(),
          refundedPaymentId: paymentRow.refundedPaymentId ?? undefined,
          refundReason: paymentRow.refundReason ?? undefined,
          notes: paymentRow.notes ?? undefined,
          staffId: paymentRow.staffId,
          createdAt: paymentRow.createdAt.toISOString(),
        },
      });
    });

    if (result) {
      // Print failure must never make a committed close look failed.
      void this
        .createCashierCloseReceiptJob(
          receiptItems,
          {
            tableNumber: result.payment.tableNumber,
            subtotal: result.payment.subtotal,
            discountAmount: result.payment.discountAmount,
            surchargeAmount: result.payment.surchargeAmount,
            total: result.payment.total,
            method: result.payment.method,
            paidAmount: result.payment.paidAmount,
            changeAmount: result.payment.changeAmount,
            notes: result.payment.notes ?? null,
          },
        )
        .catch((err) => {
          console.error("[print] cashier close receipt failed:", err instanceof Error ? err.message : String(err));
        });
    }

    return result;
  }

  /**
   * Create a cashier-area print job for the close receipt (legacy-PHP faithful):
   * prints all items with prices, subtotal/discount/surcharge/total and payment
   * summary on the bridge/worker claiming the "cashier" area.
   * Gated by settings.printing.autoPrintOnClose (Settings → printing).
   */
  private async createCashierCloseReceiptJob(
    items: Array<{ name: string; quantity: number; price: number; notes: string | null }>,
    ctx: {
      tableNumber: string;
      subtotal: number;
      discountAmount: number;
      surchargeAmount: number;
      total: number;
      method: "cash" | "card" | "mixed";
      paidAmount: number;
      changeAmount: number;
      notes: string | null;
    },
  ): Promise<void> {
    const settings = await this.getUiSettings();
    if (settings.printing.protocol !== "escpos") return;
    if (!settings.printing.autoPrintOnClose) return;

    const tenantId = this.currentTenantId();
    const payload = buildCashierReceiptPayload({
      brandName: settings.brandName,
      tableNumber: ctx.tableNumber,
      items,
      subtotal: ctx.subtotal,
      discountAmount: ctx.discountAmount,
      surchargeAmount: ctx.surchargeAmount,
      total: ctx.total,
      method: ctx.method,
      paidAmount: ctx.paidAmount,
      changeAmount: ctx.changeAmount,
      notes: ctx.notes,
      receiptFooter: settings.printing.receiptFooter,
      logoMode: settings.printing.logoMode,
      logoBitmap: settings.printing.logoBitmap,
      logoWidth: settings.printing.logoWidth,
      logoThreshold: settings.printing.logoThreshold,
    });

    await db.insert(printJobs).values({
      id: `pj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      tenantId,
      orderId: `close_${Date.now().toString(36)}`,
      area: "cashier",
      protocol: "escpos",
      status: "pending",
      payload,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      dispatchedAt: null,
    });
  }

  async splitBill(tableId: string, payload: SplitBillRequest, actorStaffId: string): Promise<SplitBillResponse | null> {
    const parsed = splitBillRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const makeShares = (total: number, people: number): number[] => {
      const perPersonRaw = people > 0 ? total / people : total;
      const perPersonRounded = Math.floor(perPersonRaw * 100) / 100;
      const result = Array.from({ length: people }, () => perPersonRounded);
      const allocated = result.reduce((sum, value) => sum + value, 0);
      const remainder = Math.round((total - allocated) * 100) / 100;
      if (result.length > 0) {
        result[result.length - 1] = Math.round((result[result.length - 1] + remainder) * 100) / 100;
      }
      return result;
    };

    if (!parsed.persist) {
      const tableRows = await db
        .select()
        .from(tables)
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)))
        .limit(1);
      const table = tableRows[0];
      if (!table) {
        return null;
      }

      const openOrders = await db
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.tableNumber, table.number), ne(orders.status, "paid"), ne(orders.status, "cancelled")));
      const total = openOrders.reduce((sum, order) => sum + Number(order.total), 0);
      const shares = makeShares(total, parsed.people);

      return splitBillResponseSchema.parse({
        tableId,
        tableNumber: table.number,
        total,
        people: parsed.people,
        shares,
        persisted: false,
      });
    }

    return withTenantTx(async (tx) => {
      await tx.execute(sql`
        SELECT id
        FROM tables
        WHERE tenant_id = ${tenantId} AND id = ${tableId}
        FOR UPDATE
      `);
      const tableRows = await tx
        .select()
        .from(tables)
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)))
        .limit(1);
      const table = tableRows[0];
      if (!table) {
        return null;
      }

      const openOrders = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.tableNumber, table.number), ne(orders.status, "paid"), ne(orders.status, "cancelled")));
      await tx.execute(sql`
        SELECT id
        FROM orders
        WHERE tenant_id = ${tenantId} AND table_number = ${table.number} AND status <> 'paid' AND status <> 'cancelled'
        FOR UPDATE
      `);

      const subtotal = openOrders.reduce((sum, order) => sum + Number(order.total), 0);
      if (subtotal <= 0) {
        throw new Error("No payable balance for this table");
      }

      const discountAmount = Math.max(0, parsed.discountAmount ?? 0);
      const surchargeAmount = Math.max(0, parsed.surchargeAmount ?? 0);
      const total = Math.max(0, Number((subtotal - discountAmount + surchargeAmount).toFixed(2)));
      if (total <= 0) {
        throw new Error("Final total must be greater than zero");
      }

      const reference = `split:${tableId}:${Date.now()}`;
      const now = new Date();

      const shares = makeShares(total, parsed.people);
      const paidAmountsInput = parsed.paidAmounts;
      const paidAmounts =
        paidAmountsInput && paidAmountsInput.length === shares.length
          ? paidAmountsInput.map((value) => Math.max(0, Number(value.toFixed(2))))
          : shares;

      if (paidAmounts.length !== shares.length) {
        throw new Error("Paid amounts length must match number of people");
      }

      for (let i = 0; i < shares.length; i += 1) {
        if (paidAmounts[i] < shares[i]) {
          throw new Error(`Paid amount for share ${i + 1} is lower than required total`);
        }
      }

      const method = parsed.method ?? "cash";
      const paymentsToInsert = shares.map((share, idx) => {
        const paidAmount = paidAmounts[idx];
        const changeAmount = Math.max(0, Number((paidAmount - share).toFixed(2)));
        return {
          id: `pay_${Date.now().toString(36)}_${idx + 1}`,
          tenantId,
          tableId,
          tableNumber: table.number,
          subtotal: String(share),
          discountAmount: "0",
          surchargeAmount: "0",
          total: String(share),
          method,
          kind: "sale",
          paymentStatus: "pending" as PaymentStatus,
          paidAmount: String(paidAmount),
          changeAmount: String(changeAmount),
          reference,
          gatewayReference: null,
          capturedAt: null,
          refundedPaymentId: null,
          refundReason: null,
          notes: parsed.notes ?? null,
          shareIndex: idx,
          staffId: actorStaffId,
          createdAt: now,
        };
      });

      const insertedRows = await tx.insert(payments).values(paymentsToInsert).returning();

      return splitBillResponseSchema.parse({
        tableId,
        tableNumber: table.number,
        total,
        people: parsed.people,
        shares,
        persisted: true,
        payments: insertedRows.map((paymentRow) => ({
          id: paymentRow.id,
          tableId: paymentRow.tableId,
          tableNumber: paymentRow.tableNumber,
          subtotal: Number(paymentRow.subtotal),
          discountAmount: Number(paymentRow.discountAmount),
          surchargeAmount: Number(paymentRow.surchargeAmount),
          total: Number(paymentRow.total),
          method: paymentRow.method,
          kind: paymentRow.kind as "sale" | "refund",
          paymentStatus: paymentRow.paymentStatus as PaymentStatus,
          paidAmount: Number(paymentRow.paidAmount),
          changeAmount: Number(paymentRow.changeAmount),
          reference: paymentRow.reference ?? undefined,
          gatewayReference: paymentRow.gatewayReference ?? undefined,
          capturedAt: paymentRow.capturedAt?.toISOString(),
          refundedPaymentId: paymentRow.refundedPaymentId ?? undefined,
          refundReason: paymentRow.refundReason ?? undefined,
          notes: paymentRow.notes ?? undefined,
          shareIndex: paymentRow.shareIndex ?? undefined,
          staffId: paymentRow.staffId,
          createdAt: paymentRow.createdAt.toISOString(),
        })),
      });
    });
  }

  async paySelectedItems(tableId: string, payload: PaySelectedItemsRequest, actorStaffId: string): Promise<PaySelectedItemsResponse | null> {
    const parsed = paySelectedItemsRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const paymentStatus: PaymentStatus = parsed.paymentStatus ?? "captured";

    const requiresGatewayReference = parsed.method === "card" || parsed.method === "mixed";
    if (requiresGatewayReference) {
      if (!parsed.gatewayReference || parsed.gatewayReference.trim().length < 3) {
        throw new Error("Gateway reference is required for card/mixed payments");
      }
      if (paymentStatus !== "captured") {
        throw new Error("Card/mixed payments must be captured");
      }
    }

    return withTenantTx(async (tx) => {
      await tx.execute(sql`
        SELECT id
        FROM tables
        WHERE tenant_id = ${tenantId} AND id = ${tableId}
        FOR UPDATE
      `);
      const tableRows = await tx
        .select()
        .from(tables)
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)))
        .limit(1);
      const table = tableRows[0];
      if (!table) {
        return null;
      }

      const openOrders = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.tableNumber, table.number), ne(orders.status, "paid"), ne(orders.status, "cancelled")));
      
      if (openOrders.length === 0) {
        throw new Error("No open orders for this table");
      }

      const orderIds = openOrders.map((o) => o.id);
      const orderItemRows = await tx
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.tenantId, tenantId), inArray(orderItems.orderId, orderIds)));

      const itemMap = new Map(orderItemRows.map((item) => [item.id, item]));

      const paidItemsData: Array<{ orderItemId: number; quantity: number; price: number; name: string; menuItemId: string }> = [];
      let subtotal = 0;

      for (const itemReq of parsed.items) {
        const orderItem = itemMap.get(itemReq.orderItemId);
        if (!orderItem) {
          throw new Error(`Order item ${itemReq.orderItemId} not found`);
        }

        const alreadyPaidRows = await tx
          .select()
          .from(paymentItems)
          .where(and(eq(paymentItems.tenantId, tenantId), eq(paymentItems.orderItemId, itemReq.orderItemId)));
        
        const alreadyPaidQty = alreadyPaidRows.reduce((sum, row) => sum + row.quantity, 0);
        const availableQty = orderItem.quantity - alreadyPaidQty;

        if (itemReq.quantity > availableQty) {
          throw new Error(`Quantity ${itemReq.quantity} exceeds available ${availableQty} for item "${orderItem.name}"`);
        }

        const itemTotal = Number(orderItem.price) * itemReq.quantity;
        subtotal += itemTotal;
        paidItemsData.push({
          orderItemId: itemReq.orderItemId,
          quantity: itemReq.quantity,
          price: Number(orderItem.price),
          name: orderItem.name,
          menuItemId: orderItem.menuItemId,
        });
      }

      if (subtotal <= 0) {
        throw new Error("Total must be greater than zero");
      }

      const paymentId = `pay_${Date.now().toString(36)}`;
      const now = new Date();
      const [paymentRow] = await tx
        .insert(payments)
        .values({
          id: paymentId,
          tenantId,
          tableId,
          tableNumber: table.number,
          subtotal: String(subtotal),
          discountAmount: "0",
          surchargeAmount: "0",
          total: String(subtotal),
          method: parsed.method,
          kind: "sale",
          paymentStatus,
          paidAmount: String(subtotal),
          changeAmount: "0",
          reference: `items:${tableId}:${Date.now()}`,
          gatewayReference: parsed.gatewayReference?.trim() ?? null,
          capturedAt: paymentStatus === "captured" ? now : null,
          refundedPaymentId: null,
          refundReason: null,
          notes: parsed.notes ?? null,
          staffId: actorStaffId,
          createdAt: now,
        })
        .returning();

      const paymentItemsToInsert = paidItemsData.map((item) => ({
        id: `pi_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
        tenantId,
        paymentId: paymentRow.id,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        createdAt: now,
      }));

      await tx.insert(paymentItems).values(paymentItemsToInsert);

      // Check if all items across all open orders are now fully paid
      const allOrderItemIds = orderItemRows.map((item) => item.id);
      const allPaymentItemRows = allOrderItemIds.length > 0
        ? await tx
            .select()
            .from(paymentItems)
            .where(and(
              eq(paymentItems.tenantId, tenantId),
              inArray(paymentItems.orderItemId, allOrderItemIds),
            ))
        : [];

      const totalPaidQty = allPaymentItemRows.reduce((sum, pi) => sum + pi.quantity, 0);
      const totalOrderQty = orderItemRows.reduce((sum, item) => sum + item.quantity, 0);
      const allItemsPaid = totalOrderQty > 0 && totalPaidQty >= totalOrderQty;

      if (allItemsPaid) {
        // All items paid — mark orders as paid and free the table
        await tx
          .update(orders)
          .set({ status: "paid" })
          .where(and(
            eq(orders.tenantId, tenantId),
            eq(orders.tableNumber, table.number),
            ne(orders.status, "paid"),
            ne(orders.status, "cancelled"),
          ));

        await tx
          .update(tables)
          .set({ status: "free", currentOrderId: null })
          .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)));
      }

      return paySelectedItemsResponseSchema.parse({
        payment: {
          id: paymentRow.id,
          tableId: paymentRow.tableId,
          tableNumber: paymentRow.tableNumber,
          subtotal: Number(paymentRow.subtotal),
          discountAmount: Number(paymentRow.discountAmount),
          surchargeAmount: Number(paymentRow.surchargeAmount),
          total: Number(paymentRow.total),
          method: paymentRow.method,
          kind: paymentRow.kind as "sale" | "refund",
          paymentStatus: paymentRow.paymentStatus as PaymentStatus,
          paidAmount: Number(paymentRow.paidAmount),
          changeAmount: Number(paymentRow.changeAmount),
          reference: paymentRow.reference ?? undefined,
          gatewayReference: paymentRow.gatewayReference ?? undefined,
          capturedAt: paymentRow.capturedAt?.toISOString(),
          refundedPaymentId: paymentRow.refundedPaymentId ?? undefined,
          refundReason: paymentRow.refundReason ?? undefined,
          notes: paymentRow.notes ?? undefined,
          staffId: paymentRow.staffId,
          createdAt: paymentRow.createdAt.toISOString(),
        },
        paidItems: paidItemsData.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
        })),
        allItemsPaid,
      });
    });
  }

  async markShareAsPaid(tableId: string, shareIndex: number, payload: MarkShareAsPaidRequest, actorStaffId: string): Promise<MarkShareAsPaidResponse | null> {
    const parsed = markShareAsPaidRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const requiresGatewayReference = parsed.method === "card" || parsed.method === "mixed";
    if (requiresGatewayReference) {
      if (!parsed.gatewayReference || parsed.gatewayReference.trim().length < 3) {
        throw new Error("Gateway reference is required for card/mixed payments");
      }
    }

    return withTenantTx(async (tx) => {
      await tx.execute(sql`
        SELECT id
        FROM tables
        WHERE tenant_id = ${tenantId} AND id = ${tableId}
        FOR UPDATE
      `);

      const tableRows = await tx
        .select()
        .from(tables)
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)))
        .limit(1);

      const table = tableRows[0];
      if (!table) {
        return null;
      }

      const paymentRows = await tx
        .select()
        .from(payments)
        .where(and(
          eq(payments.tenantId, tenantId),
          eq(payments.tableId, tableId),
          eq(payments.shareIndex, shareIndex),
          eq(payments.paymentStatus, "pending"),
        ))
        .limit(1);

      const payment = paymentRows[0];
      if (!payment) {
        throw new Error(`No pending payment found for share ${shareIndex}`);
      }

      const now = new Date();
      const [updatedPayment] = await tx
        .update(payments)
        .set({
          paymentStatus: "captured",
          method: parsed.method,
          gatewayReference: parsed.gatewayReference?.trim() ?? null,
          capturedAt: now,
        })
        .where(eq(payments.id, payment.id))
        .returning();

      const allPayments = await tx
        .select()
        .from(payments)
        .where(and(
          eq(payments.tenantId, tenantId),
          eq(payments.tableId, tableId),
          isNotNull(payments.shareIndex),
        ));

      const allSharesPaid = allPayments.length > 0 && allPayments.every((p) => p.paymentStatus === "captured");

      if (allSharesPaid) {
        await tx
          .update(orders)
          .set({ status: "paid" })
          .where(and(
            eq(orders.tenantId, tenantId),
            eq(orders.tableNumber, table.number),
            ne(orders.status, "paid"),
            ne(orders.status, "cancelled"),
          ));

        await tx
          .update(tables)
          .set({ status: "free", currentOrderId: null })
          .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)));
      }

      return markShareAsPaidResponseSchema.parse({
        payment: {
          id: updatedPayment.id,
          tableId: updatedPayment.tableId,
          tableNumber: updatedPayment.tableNumber,
          subtotal: Number(updatedPayment.subtotal),
          discountAmount: Number(updatedPayment.discountAmount),
          surchargeAmount: Number(updatedPayment.surchargeAmount),
          total: Number(updatedPayment.total),
          method: updatedPayment.method,
          kind: updatedPayment.kind as "sale" | "refund",
          paymentStatus: updatedPayment.paymentStatus as PaymentStatus,
          paidAmount: Number(updatedPayment.paidAmount),
          changeAmount: Number(updatedPayment.changeAmount),
          reference: updatedPayment.reference ?? undefined,
          gatewayReference: updatedPayment.gatewayReference ?? undefined,
          capturedAt: updatedPayment.capturedAt?.toISOString(),
          refundedPaymentId: updatedPayment.refundedPaymentId ?? undefined,
          refundReason: updatedPayment.refundReason ?? undefined,
          notes: updatedPayment.notes ?? undefined,
          shareIndex: updatedPayment.shareIndex ?? undefined,
          staffId: updatedPayment.staffId,
          createdAt: updatedPayment.createdAt.toISOString(),
        },
        allSharesPaid,
      });
    });
  }

  async transferTable(sourceTableId: string, payload: TransferTableRequest): Promise<TransferTableResponse | null> {
    const parsed = transferTableRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    if (parsed.targetTableId === sourceTableId) {
      throw new Error("Target table must differ from source table");
    }

    return withTenantTx(async (tx) => {
      const sourceRows = await tx
        .select()
        .from(tables)
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, sourceTableId)))
        .limit(1);
      const sourceTable = sourceRows[0];
      if (!sourceTable) {
        return null;
      }

      const targetRows = await tx
        .select()
        .from(tables)
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, parsed.targetTableId)))
        .limit(1);
      const targetTable = targetRows[0];
      if (!targetTable) {
        return null;
      }

      const openOrders = await tx
        .select()
        .from(orders)
        .where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.tableNumber, sourceTable.number),
          ne(orders.status, "paid"),
          ne(orders.status, "cancelled"),
        ));

      if (openOrders.length === 0) {
        throw new Error("No open orders to transfer");
      }

      await tx
        .update(orders)
        .set({ tableNumber: targetTable.number })
        .where(and(
          eq(orders.tenantId, tenantId),
          eq(orders.tableNumber, sourceTable.number),
          ne(orders.status, "paid"),
          ne(orders.status, "cancelled"),
        ));

      await tx
        .update(tables)
        .set({ status: "free", currentOrderId: null })
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, sourceTableId)));

      await tx
        .update(tables)
        .set({ status: "occupied", currentOrderId: openOrders[0].id })
        .where(and(eq(tables.tenantId, tenantId), eq(tables.id, parsed.targetTableId)));

      return transferTableResponseSchema.parse({
        success: true,
        sourceTableId,
        targetTableId: parsed.targetTableId,
        movedOrders: openOrders.length,
      });
    });
  }

  async getTablePaymentStatus(tableId: string): Promise<{ items: { orderItemId: number; name: string; price: number; totalQuantity: number; paidQuantity: number; availableQuantity: number; fullyPaid: boolean; }[]; totalAmount: number; paidAmount: number; remainingAmount: number; splitShares?: { shareIndex: number; amount: number; method: string; gatewayReference: string | null; isPaid: boolean; paymentId: string; }[] | undefined; } | null> {
    const tenantId = getTenantIdOrDefault();

    const tableRows = await db
      .select()
      .from(tables)
      .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)))
      .limit(1);

    const table = tableRows[0];
    if (!table) {
      return null;
    }

    const openOrders = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.tenantId, tenantId),
        eq(orders.tableNumber, table.number),
        ne(orders.status, "paid"),
        ne(orders.status, "cancelled"),
      ));

    if (openOrders.length === 0) {
      return {
        items: [],
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
      };
    }

    const orderIds = openOrders.map((o) => o.id);
    const orderItemRows = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.tenantId, tenantId), inArray(orderItems.orderId, orderIds)));

    const paymentItemRows = await db
      .select()
      .from(paymentItems)
      .where(and(
        eq(paymentItems.tenantId, tenantId),
        inArray(paymentItems.orderItemId, orderItemRows.map((item) => item.id)),
      ));

    const paidQuantityMap = new Map<number, number>();
    for (const pi of paymentItemRows) {
      const current = paidQuantityMap.get(pi.orderItemId) ?? 0;
      paidQuantityMap.set(pi.orderItemId, current + pi.quantity);
    }

    const items = orderItemRows.map((item) => {
      const paidQty = paidQuantityMap.get(item.id) ?? 0;
      const availableQty = item.quantity - paidQty;
      return {
        orderItemId: item.id,
        name: item.name,
        price: Number(item.price),
        totalQuantity: item.quantity,
        paidQuantity: paidQty,
        availableQuantity: availableQty,
        fullyPaid: availableQty <= 0,
      };
    });

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.totalQuantity, 0);
    const paidAmount = items.reduce((sum, item) => sum + item.price * item.paidQuantity, 0);
    const remainingAmount = totalAmount - paidAmount;

    const splitPayments = await db
      .select()
      .from(payments)
      .where(and(
        eq(payments.tenantId, tenantId),
        eq(payments.tableId, tableId),
      ));

    const hasSplitPayments = splitPayments.some((p) => p.shareIndex !== null);
    let splitShares;

    if (hasSplitPayments) {
      splitShares = splitPayments
        .filter((p) => p.shareIndex !== null)
        .sort((a, b) => (a.shareIndex ?? 0) - (b.shareIndex ?? 0))
        .map((p) => ({
          shareIndex: p.shareIndex!,
          amount: Number(p.total),
          method: p.method,
          gatewayReference: p.gatewayReference,
          isPaid: p.paymentStatus === "captured",
          paymentId: p.id,
        }));
    }

    return {
      items,
      totalAmount: Math.max(0, Number(totalAmount.toFixed(2))),
      paidAmount: Math.max(0, Number(paidAmount.toFixed(2))),
      remainingAmount: Math.max(0, Number(remainingAmount.toFixed(2))),
      ...(splitShares ? { splitShares } : {}),
    };
  }

  async listReservations(query: ReservationsQuery): Promise<Reservation[]> {
    const parsed = reservationsQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(reservations.tenantId, tenantId)];

    if (parsed.from) {
      conditions.push(gte(reservations.reservedFor, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(reservations.reservedFor, new Date(parsed.to)));
    }
    if (parsed.status) {
      conditions.push(eq(reservations.status, parsed.status));
    }

    const rows = await db
      .select()
      .from(reservations)
      .where(and(...conditions))
      .orderBy(desc(reservations.reservedFor))
      .limit(parsed.limit ?? 200);

    return reservationListResponseSchema.parse(
      rows.map((row) =>
        reservationSchema.parse({
          id: row.id,
          tableId: row.tableId ?? undefined,
          customerName: row.customerName,
          customerPhone: row.customerPhone ?? undefined,
          partySize: row.partySize,
          reservedFor: row.reservedFor.toISOString(),
          status: reservationStatusSchema.parse(row.status),
          noShowReason: row.noShowReason ?? undefined,
          notes: row.notes ?? undefined,
          source: row.source,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }),
      ),
    );
  }

  async createReservation(payload: ReservationCreateRequest): Promise<Reservation> {
    const parsed = reservationCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const id = `res_${Date.now().toString(36)}`;
    const now = new Date();

    const inserted = await db
      .insert(reservations)
      .values({
        id,
        tenantId,
        tableId: parsed.tableId ?? null,
        customerName: parsed.customerName.trim(),
        customerPhone: parsed.customerPhone ?? null,
        partySize: parsed.partySize,
        reservedFor: new Date(parsed.reservedFor),
        status: "pending",
        noShowReason: null,
        notes: parsed.notes ?? null,
        source: parsed.source,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const row = inserted[0];
    return reservationSchema.parse({
      id: row.id,
      tableId: row.tableId ?? undefined,
      customerName: row.customerName,
      customerPhone: row.customerPhone ?? undefined,
      partySize: row.partySize,
      reservedFor: row.reservedFor.toISOString(),
      status: reservationStatusSchema.parse(row.status),
      noShowReason: row.noShowReason ?? undefined,
      notes: row.notes ?? undefined,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async updateReservation(id: string, payload: ReservationUpdateRequest): Promise<Reservation | null> {
    const parsed = reservationUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const existingRows = await db
      .select()
      .from(reservations)
      .where(and(eq(reservations.tenantId, tenantId), eq(reservations.id, id)))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) {
      return null;
    }

    if (parsed.status) {
      const currentStatus = reservationStatusSchema.parse(existing.status);
      const allowed = reservationTransitions[currentStatus];
      if (!allowed.includes(parsed.status)) {
        throw new Error(`Reservation transition not allowed: ${currentStatus} -> ${parsed.status}`);
      }
    }

    const currentStatus = reservationStatusSchema.parse(existing.status);
    const nextStatus = parsed.status ?? currentStatus;
    const parsedNoShowReason =
      parsed.noShowReason === undefined
        ? undefined
        : reservationNoShowRequestSchema.parse({ reason: parsed.noShowReason }).reason.trim();

    let nextNoShowReason: string | null;
    if (nextStatus === "no_show") {
      const candidate = parsedNoShowReason ?? existing.noShowReason ?? null;
      if (!candidate || candidate.trim().length < 3) {
        throw new Error("Reservation no-show reason is required");
      }
      nextNoShowReason = candidate.trim();
    } else {
      nextNoShowReason = null;
    }

    const updated = await db
      .update(reservations)
      .set({
        ...(parsed.tableId !== undefined ? { tableId: parsed.tableId } : {}),
        ...(parsed.customerName !== undefined ? { customerName: parsed.customerName.trim() } : {}),
        ...(parsed.customerPhone !== undefined ? { customerPhone: parsed.customerPhone } : {}),
        ...(parsed.partySize !== undefined ? { partySize: parsed.partySize } : {}),
        ...(parsed.reservedFor !== undefined ? { reservedFor: new Date(parsed.reservedFor) } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        noShowReason: nextNoShowReason,
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        ...(parsed.source !== undefined ? { source: parsed.source } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(reservations.tenantId, tenantId), eq(reservations.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return reservationSchema.parse({
      id: row.id,
      tableId: row.tableId ?? undefined,
      customerName: row.customerName,
      customerPhone: row.customerPhone ?? undefined,
      partySize: row.partySize,
      reservedFor: row.reservedFor.toISOString(),
      status: reservationStatusSchema.parse(row.status),
      noShowReason: row.noShowReason ?? undefined,
      notes: row.notes ?? undefined,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async getReservationsSummary(query: OperationalSummaryQuery): Promise<ReservationsSummary> {
    const parsed = operationalSummaryQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();

    const conditions: SQL[] = [eq(reservations.tenantId, tenantId)];
    if (parsed.from) {
      conditions.push(gte(reservations.reservedFor, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(reservations.reservedFor, new Date(parsed.to)));
    }

    const rows = await db
      .select({ status: reservations.status })
      .from(reservations)
      .where(and(...conditions));

    const counters = {
      total: rows.length,
      pending: 0,
      confirmed: 0,
      seated: 0,
      cancelled: 0,
      noShow: 0,
    };

    for (const row of rows) {
      const status = reservationStatusSchema.parse(row.status);
      if (status === "pending") counters.pending += 1;
      if (status === "confirmed") counters.confirmed += 1;
      if (status === "seated") counters.seated += 1;
      if (status === "cancelled") counters.cancelled += 1;
      if (status === "no_show") counters.noShow += 1;
    }

    const noShowRate = counters.total > 0 ? counters.noShow / counters.total : 0;
    return reservationsSummarySchema.parse({
      ...counters,
      noShowRate,
    });
  }

  async listDeliveryOrders(query: DeliveryOrdersQuery): Promise<DeliveryOrder[]> {
    const parsed = deliveryOrdersQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(deliveryOrders.tenantId, tenantId)];

    if (parsed.status) {
      conditions.push(eq(deliveryOrders.status, parsed.status));
    }
    if (parsed.from) {
      conditions.push(gte(deliveryOrders.createdAt, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(deliveryOrders.createdAt, new Date(parsed.to)));
    }

    const rows = await db
      .select()
      .from(deliveryOrders)
      .where(and(...conditions))
      .orderBy(desc(deliveryOrders.updatedAt))
      .limit(parsed.limit ?? 200);

    return deliveryOrdersListResponseSchema.parse(
      rows.map((row) =>
        deliveryOrderSchema.parse({
          id: row.id,
          orderId: row.orderId,
          customerAddress: row.customerAddress,
          courierName: row.courierName ?? undefined,
          courierPhone: row.courierPhone ?? undefined,
          eta: row.eta ? row.eta.toISOString() : undefined,
          status: deliveryStatusSchema.parse(row.status),
          statusChangedAt: row.statusChangedAt ? row.statusChangedAt.toISOString() : undefined,
          assignedAt: row.assignedAt ? row.assignedAt.toISOString() : undefined,
          deliveryFee: Number(row.deliveryFee),
          notes: row.notes ?? undefined,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }),
      ),
    );
  }

  async upsertDeliveryOrder(orderId: string, payload: DeliveryUpsertRequest): Promise<DeliveryOrder> {
    const parsed = deliveryUpsertRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();

    const orderRows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)))
      .limit(1);
    if (orderRows.length === 0) {
      throw new Error("Order not found");
    }

    const existing = await db
      .select()
      .from(deliveryOrders)
      .where(and(eq(deliveryOrders.tenantId, tenantId), eq(deliveryOrders.orderId, orderId)))
      .limit(1);

    let row;
    if (existing.length === 0) {
      const assignedAt = parsed.status === "out_for_delivery" ? now : null;
      const created = await db
        .insert(deliveryOrders)
        .values({
          id: `del_${Date.now().toString(36)}`,
          tenantId,
          orderId,
          customerAddress: parsed.customerAddress.trim(),
          courierName: parsed.courierName ?? null,
          courierPhone: parsed.courierPhone ?? null,
          eta: parsed.eta ? new Date(parsed.eta) : null,
          status: parsed.status,
          statusChangedAt: now,
          assignedAt,
          deliveryFee: String(parsed.deliveryFee),
          notes: parsed.notes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      row = created[0];
    } else {
      const currentStatus = deliveryStatusSchema.parse(existing[0].status);
      const isTransition = currentStatus !== parsed.status;
      if (isTransition) {
        const allowed = deliveryTransitions[currentStatus];
        if (!allowed.includes(parsed.status)) {
          throw new Error(`Delivery transition not allowed: ${currentStatus} -> ${parsed.status}`);
        }
      }

      const assignedAt =
        parsed.status === "out_for_delivery" && !existing[0].assignedAt
          ? now
          : existing[0].assignedAt;

      const updated = await db
        .update(deliveryOrders)
        .set({
          customerAddress: parsed.customerAddress.trim(),
          courierName: parsed.courierName ?? null,
          courierPhone: parsed.courierPhone ?? null,
          eta: parsed.eta ? new Date(parsed.eta) : null,
          status: parsed.status,
          ...(isTransition ? { statusChangedAt: now } : {}),
          assignedAt,
          deliveryFee: String(parsed.deliveryFee),
          notes: parsed.notes ?? null,
          updatedAt: now,
        })
        .where(and(eq(deliveryOrders.tenantId, tenantId), eq(deliveryOrders.id, existing[0].id)))
        .returning();
      row = updated[0];
    }

    return deliveryOrderSchema.parse({
      id: row.id,
      orderId: row.orderId,
      customerAddress: row.customerAddress,
      courierName: row.courierName ?? undefined,
      courierPhone: row.courierPhone ?? undefined,
      eta: row.eta ? row.eta.toISOString() : undefined,
      status: deliveryStatusSchema.parse(row.status),
      statusChangedAt: row.statusChangedAt ? row.statusChangedAt.toISOString() : undefined,
      assignedAt: row.assignedAt ? row.assignedAt.toISOString() : undefined,
      deliveryFee: Number(row.deliveryFee),
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async updateDeliveryStatus(orderId: string, payload: DeliveryStatusUpdateRequest): Promise<DeliveryOrder | null> {
    const parsed = deliveryStatusUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const existing = await db
      .select()
      .from(deliveryOrders)
      .where(and(eq(deliveryOrders.tenantId, tenantId), eq(deliveryOrders.orderId, orderId)))
      .limit(1);
    if (existing.length === 0) {
      return null;
    }

    const currentStatus = deliveryStatusSchema.parse(existing[0].status);
    const allowed = deliveryTransitions[currentStatus];
    if (!allowed.includes(parsed.status)) {
      throw new Error(`Delivery transition not allowed: ${currentStatus} -> ${parsed.status}`);
    }

    const now = new Date();
    const assignedAt =
      parsed.status === "out_for_delivery" && !existing[0].assignedAt
        ? now
        : existing[0].assignedAt;

    const updated = await db
      .update(deliveryOrders)
      .set({
        status: parsed.status,
        statusChangedAt: now,
        assignedAt,
        ...(parsed.eta !== undefined ? { eta: parsed.eta ? new Date(parsed.eta) : null } : {}),
        ...(parsed.courierName !== undefined ? { courierName: parsed.courierName } : {}),
        ...(parsed.courierPhone !== undefined ? { courierPhone: parsed.courierPhone } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        updatedAt: now,
      })
      .where(and(eq(deliveryOrders.tenantId, tenantId), eq(deliveryOrders.orderId, orderId)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return deliveryOrderSchema.parse({
      id: row.id,
      orderId: row.orderId,
      customerAddress: row.customerAddress,
      courierName: row.courierName ?? undefined,
      courierPhone: row.courierPhone ?? undefined,
      eta: row.eta ? row.eta.toISOString() : undefined,
      status: deliveryStatusSchema.parse(row.status),
      statusChangedAt: row.statusChangedAt ? row.statusChangedAt.toISOString() : undefined,
      assignedAt: row.assignedAt ? row.assignedAt.toISOString() : undefined,
      deliveryFee: Number(row.deliveryFee),
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async getDeliverySummary(query: OperationalSummaryQuery): Promise<DeliverySummary> {
    const parsed = operationalSummaryQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();

    const conditions: SQL[] = [eq(deliveryOrders.tenantId, tenantId)];
    if (parsed.from) {
      conditions.push(gte(deliveryOrders.createdAt, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(deliveryOrders.createdAt, new Date(parsed.to)));
    }

    const rows = await db
      .select({ status: deliveryOrders.status })
      .from(deliveryOrders)
      .where(and(...conditions));

    const counters = {
      total: rows.length,
      active: 0,
      new: 0,
      preparing: 0,
      ready: 0,
      outForDelivery: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const row of rows) {
      const status = deliveryStatusSchema.parse(row.status);
      if (status === "new") counters.new += 1;
      if (status === "preparing") counters.preparing += 1;
      if (status === "ready") counters.ready += 1;
      if (status === "out_for_delivery") counters.outForDelivery += 1;
      if (status === "delivered") counters.delivered += 1;
      if (status === "cancelled") counters.cancelled += 1;
      if (status !== "delivered" && status !== "cancelled") counters.active += 1;
    }

    return deliverySummarySchema.parse(counters);
  }

}