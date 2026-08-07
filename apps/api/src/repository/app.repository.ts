import { z } from "zod";
import {
  appDataSchema,
  bomItemSchema,
  bomUpsertComponentsRequestSchema,
  createOrderRequestSchema,
  uiSettingsSchema,
  updateUiSettingsRequestSchema,
  menuItemAdminListResponseSchema,
  menuItemAdminSchema,
  orderSchema,
  orderHistoryFiltersSchema,
  orderHistoryListResponseSchema,
  orderTypeSchema,
  categoryScopeSchema,
  printAreaSchema,
  printBridgePrinterMappingSchema,
  type PrintBridgePrinterMapping,
  printJobSchema,
  printJobsListResponseSchema,
  printJobsQuerySchema,
  publicMenuBrandingSchema,
  publicMenuModuleConfigSchema,
  publicTakeawayCreateRequestSchema,
  publicTakeawayCreateResponseSchema,
  publicTakeawayTrackingResponseSchema,
  publicMenuResponseSchema,
  groupOrderCreateSessionRequestSchema,
  groupOrderCreateSessionResponseSchema,
  groupOrderJoinSessionRequestSchema,
  groupOrderJoinSessionResponseSchema,
  groupOrderPatchCartRequestSchema,
  groupOrderPatchCartResponseSchema,
  groupOrderSubmitRequestSchema,
  groupOrderSubmitResponseSchema,
  groupOrderSessionSchema,
  groupOrderParticipantSchema,
  groupOrderCartItemSchema,
  selfOrderCreateRequestSchema,
  selfOrderCreateResponseSchema,
  selfOrderResolveResponseSchema,
  selfOrderSessionRotateResponseSchema,
  voidOrderRequestSchema,
  voidOrderResponseSchema,
  updateOrderRequestSchema,
  type AppData,
  type BomItem,
  type BomUpsertComponentsRequest,
  type CreateOrderRequest,
  type PrepItem,
  type PrintBridgeOnboardingSecret,
  type PrintBridgeOnboardingSecretCreateCode6DigitResponse,
  type PrintBridgeOnboardingSecretCreateResponse,
  type UnitConversion,
  type Ingredient,
  type Category,
  type CategoryModifierPool,
  type Customer,
  type OrderHistoryFilters,
  type CustomerAnalytics,
  type MenuItem,
  type MenuItemAdmin,
  type Order,
  type OrderStatus,
  type PaymentsListResponse,
  type StaffAdmin,
  type Staff,
  type ModuleKey,
  type UiSettings,
  type UpdateUiSettingsRequest,
  type Table,
  type OrderType,
  type PrintArea,
  type PrintJob,
  type PrintJobsQuery,
  type PrintBridge,
  type PublicMenuResponse,
  type GroupOrderCreateSessionRequest,
  type GroupOrderCreateSessionResponse,
  type GroupOrderJoinSessionRequest,
  type GroupOrderJoinSessionResponse,
  type GroupOrderPatchCartRequest,
  type GroupOrderPatchCartResponse,
  type GroupOrderSubmitRequest,
  type GroupOrderSubmitResponse,
  type GroupOrderSession,
  type GroupOrderParticipant,
  type GroupOrderCartItem,
  type PublicFunnelEventRequest,
  type PublicTakeawayCreateRequest,
  type PublicTakeawayCreateResponse,
  type PublicTakeawayTrackingResponse,
  type SelfOrderCreateRequest,
  type SelfOrderCreateResponse,
  type SelfOrderResolveResponse,
  type SelfOrderSessionRotateResponse,
  type VoidOrderRequest,
  type VoidOrderResponse,
  type UpdateOrderRequest,
  defaultUiSettings,
  convertUnit,
} from "@gustopos/shared";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, ne, or, SQL, sql, lt} from "drizzle-orm";
import { Injectable, Inject } from "@nestjs/common";
import crypto from "node:crypto";
import { db, withTenantTx } from "../db/client";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { assertOrderStatusTransition } from "../orders/order-status-policy";
import {
  bomComponents,
  bomItems,
  inventory,
  menuItemComponents,
  menuItems,
  menuModifierGroups,
  menuModifierOptions,
  menuModifierOptionOverrides,
  orderItems,
  orders,
  payments,
  appSettings,
  categories,
  customers,
  printJobs,
  reservations,
  deliveryOrders,
  suppliers,
  supplierIngredients,
  staff,
  tenants,
  tenantAuditLogs,
  tenantModuleConfigs,
  tenantModules,
  publicTakeawayTrackingSessions,
  groupOrderSessions,
  groupOrderParticipants,
  groupOrderCartItems,
  selfOrderSessions,
  tables,
  stockMovements,
  inventoryAudit,
  categoryModifierPools,
  categoryModifierPoolOptions,
  categoryModifierPoolCategories,
  prepItems,
  inventoryUnitConversions,
  orderStockImpacts,
  printBridges,
  printBridgeOnboardingSecrets,
} from "../db/schema";
import { StaffRepository } from "./staff.repository";
import { ShiftsRepository } from "./shifts.repository";
import { SuppliersRepository } from "./suppliers.repository";
import { InventoryRepository } from "./inventory.repository";
import { TablesRepository } from "./tables.repository";
import { ConsumerRepository } from "./consumer.repository";
import { CustomerRepository } from "./customer.repository";
import { PaymentsRepository } from "./payments.repository";
import { PrintJobsRepository } from "./print-jobs.repository";
import { EscPosBuilder, RECEIPT_WIDTH, padRight } from "./utils/escpos-builder";


type InventoryRow = typeof inventory.$inferSelect;
type BomRow = typeof bomItems.$inferSelect;
type BomComponentRow = typeof bomComponents.$inferSelect;

function toNumeric(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function channelToLinear(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  const lr = channelToLinear(r);
  const lg = channelToLinear(g);
  const lb = channelToLinear(b);
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = luminance(fgHex);
  const l2 = luminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}


export function parsePrintAreas(raw: string | null | undefined): PrintArea[] {
  if (!raw) {
    return ["kitchen"];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return ["kitchen"];
    }
    const valid = parsed
      .map((entry) => {
        try {
          return printAreaSchema.parse(entry);
        } catch {
          return null;
        }
      })
      .filter((entry): entry is PrintArea => entry !== null);

    return valid.length > 0 ? valid : ["kitchen"];
  } catch {
    return ["kitchen"];
  }
}

export function parseSelectedModifiers(raw: string | null | undefined): Array<{ groupId: string; optionId: string }> {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (entry): entry is { groupId: string; optionId: string } =>
          typeof entry === "object" &&
          entry !== null &&
          "groupId" in entry &&
          "optionId" in entry &&
          typeof (entry as { groupId: unknown }).groupId === "string" &&
          typeof (entry as { optionId: unknown }).optionId === "string",
      )
      .map((entry) => ({ groupId: entry.groupId, optionId: entry.optionId }));
  } catch {
    return [];
  }
}

export function parseIngredientOverrides(raw: string | null | undefined): Array<{ ingredientId: string; action: "add" | "remove" }> {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (entry): entry is { ingredientId: string; action: "add" | "remove" } =>
          typeof entry === "object" &&
          entry !== null &&
          "ingredientId" in entry &&
          "action" in entry &&
          typeof (entry as { ingredientId: unknown }).ingredientId === "string" &&
          ((entry as { action: unknown }).action === "add" || (entry as { action: unknown }).action === "remove"),
      )
      .map((entry) => ({ ingredientId: entry.ingredientId, action: entry.action }));
  } catch {
    return [];
  }
}

@Injectable()
export class AppRepository {
  private readonly selfOrderTokenTtlMinutes = Number(process.env.SELF_ORDER_TOKEN_TTL_MINUTES ?? 30);
  private readonly takeawayTrackingTtlMinutes = Number(process.env.PUBLIC_TAKEAWAY_TRACKING_TTL_MINUTES ?? 360);

  private readonly settingsKey = "global_ui_settings";

  private currentTenantId(): string {
    return getTenantIdOrDefault();
  }

  private validateThemeContrast(settings: UiSettings) {
    const checks = [
      {
        label: "textMain vs bg",
        ratio: contrastRatio(settings.theme.textMain, settings.theme.bg),
        min: 4.5,
      },
      {
        label: "textMuted vs bg",
        ratio: contrastRatio(settings.theme.textMuted, settings.theme.bg),
        min: 3,
      },
      {
        label: "white vs primary",
        ratio: contrastRatio("#ffffff", settings.theme.primary),
        min: 4.5,
      },
      {
        label: "white vs accent",
        ratio: contrastRatio("#ffffff", settings.theme.accent),
        min: 4.5,
      },
    ];

    const invalid = checks.filter((check) => check.ratio < check.min);
    if (invalid.length > 0) {
      const messages = invalid.map((check) => `${check.label} (${check.ratio.toFixed(2)} < ${check.min})`);
      throw new Error(`Theme contrast check failed: ${messages.join(", ")}`);
    }
  }

  private validatePrintingSettings(settings: UiSettings) {
    if (settings.printing.protocol === "escpos") {
      if (settings.printing.activeAreas.length === 0) {
        throw new Error("ESC/POS requires at least one active print area");
      }

      if (settings.printing.logoMode === "bitmap") {
        if (!settings.printing.logoBitmap) {
          throw new Error("Bitmap logo mode requires a logo bitmap payload");
        }
      }
    }
  }

  private mergeUiSettingsWithDefaults(raw: unknown): UiSettings {
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const theme = obj.theme && typeof obj.theme === "object" ? (obj.theme as Record<string, unknown>) : {};
    const printing = obj.printing && typeof obj.printing === "object" ? (obj.printing as Record<string, unknown>) : {};

    return uiSettingsSchema.parse({
      ...defaultUiSettings,
      ...obj,
      theme: {
        ...defaultUiSettings.theme,
        ...theme,
      },
      printing: {
        ...defaultUiSettings.printing,
        ...printing,
      },
    });
  }

  private async getRawUiSettingsJson(): Promise<{ value: unknown } | null> {
    const tenantId = this.currentTenantId();
    const rows = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(and(eq(appSettings.tenantId, tenantId), eq(appSettings.key, this.settingsKey)))
      .limit(1);
    if (rows.length === 0) {
      return null;
    }

    try {
      return { value: JSON.parse(rows[0].value) };
    } catch {
      return { value: null };
    }
  }

  private hashSelfOrderToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private hashTakeawayTrackingToken(token: string): string {
    return crypto.createHash("sha256").update(`takeaway:${token}`).digest("hex");
  }

  private hashGroupOrderJoinCode(joinCode: string): string {
    return crypto.createHash("sha256").update(`group-order:join:${joinCode}`).digest("hex");
  }

  private hashGroupOrderParticipantToken(token: string): string {
    return crypto.createHash("sha256").update(`group-order:participant:${token}`).digest("hex");
  }

  private hashGroupOrderSubmitIdempotencyKey(idempotencyKey: string): string {
    return crypto.createHash("sha256").update(`group-order:submit:${idempotencyKey}`).digest("hex");
  }

  async findGroupOrderParticipantByToken(
    sessionId: string,
    participantToken: string,
  ): Promise<{ id: string; tenantId: string } | null> {
    const sessionRows = await db
      .select({ id: groupOrderSessions.id, tenantId: groupOrderSessions.tenantId })
      .from(groupOrderSessions)
      .where(eq(groupOrderSessions.id, sessionId))
      .limit(1);
    const session = sessionRows[0];
    if (!session) return null;

    const participantRows = await db
      .select({ id: groupOrderParticipants.id, tenantId: groupOrderParticipants.tenantId })
      .from(groupOrderParticipants)
      .where(
        and(
          eq(groupOrderParticipants.tenantId, session.tenantId),
          eq(groupOrderParticipants.sessionId, sessionId),
          eq(groupOrderParticipants.participantTokenHash, this.hashGroupOrderParticipantToken(participantToken.trim())),
        ),
      )
      .limit(1);
    return participantRows[0] ?? null;
  }

  private async logTenantAudit(params: {
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

  private async getEnabledModulesRows(tenantId: string): Promise<ModuleKey[]> {
    const rows = await db
      .select({ moduleKey: tenantModules.moduleKey })
      .from(tenantModules)
      .where(and(eq(tenantModules.tenantId, tenantId), eq(tenantModules.enabled, 1)));

    return rows
      .map((row) => row.moduleKey)
      .filter((value): value is ModuleKey =>
        value === "kitchen" ||
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

  async assertSelfOrderPublicEnabled(tenantId: string): Promise<void> {
    const enabledModules = await this.getEnabledModulesRows(tenantId);
    if (!enabledModules.includes("self_order_qr") || !enabledModules.includes("public_menu")) {
      throw new Error("Self order module is disabled for this tenant");
    }
  }

  async assertPublicTakeawayEnabled(tenantId: string): Promise<void> {
    const enabledModules = await this.getEnabledModulesRows(tenantId);
    if (
      !enabledModules.includes("public_takeaway") ||
      !enabledModules.includes("public_menu") ||
      !enabledModules.includes("kitchen")
    ) {
      throw new Error("Public takeaway module is disabled for this tenant");
    }
  }

  async assertPublicGroupOrderEnabled(tenantId: string): Promise<void> {
    const enabledModules = await this.getEnabledModulesRows(tenantId);
    if (!enabledModules.includes("public_group_order") || !enabledModules.includes("public_menu")) {
      throw new Error("Public group order module is disabled for this tenant");
    }
  }

  private async resolveSelfOrderStaffId(tenantId: string): Promise<string> {
    const staffRows = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.isActive, 1)))
      .limit(1);

    const staffId = staffRows[0]?.id;
    if (!staffId) {
      throw new Error("No active staff available for self order");
    }

    return staffId;
  }

  private async resolvePrintAreasForMenuIds(menuIds: string[]): Promise<Map<string, PrintArea[]>> {
    if (menuIds.length === 0) {
      return new Map();
    }

    const tenantId = this.currentTenantId();

    const menuRows = await db
      .select({ id: menuItems.id, printAreas: menuItems.printAreas, categoryId: menuItems.categoryId })
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), inArray(menuItems.id, menuIds)));

    const categoryIds = [...new Set(menuRows.map((row) => row.categoryId).filter((value): value is string => Boolean(value)))];
    const categoryRows =
      categoryIds.length > 0
          ? await db
              .select({ id: categories.id, printAreas: categories.printAreas })
              .from(categories)
              .where(and(eq(categories.tenantId, tenantId), inArray(categories.id, categoryIds)))
        : [];
    const categoryMap = new Map(categoryRows.map((row) => [row.id, parsePrintAreas(row.printAreas)]));

    const result = new Map<string, PrintArea[]>();
    for (const row of menuRows) {
      const menuAreas = parsePrintAreas(row.printAreas);
      const fallback = row.categoryId ? categoryMap.get(row.categoryId) : undefined;
      result.set(row.id, menuAreas.length > 0 ? menuAreas : fallback ?? ["kitchen"]);
    }

    return result;
  }

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

    // The logo is intentionally NOT printed on kitchen/bar/cashier tickets:
    // it renders only on the cashier scontrino (buildCashierReceiptPayload).

    ep.align("center").doubleSize(true).bold(true);
    ep.line(area.toUpperCase());
    ep.doubleSize(false).bold(false);
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
        // BAR and kitchen use the unified large-item layout. Modifiers,
        // overrides and notes intentionally inherit this width until the
        // item is complete, matching the established print-station format.
        ep.doubleWidth(true).line(label);
      }

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
        ep.line(`  ${ovr}`);
      }
      if (item.notes) {
        ep.line(`  * ${item.notes}`);
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

    // Feed before a full cut so the last line and modifiers clear the platen.
    ep.feed(5);
    ep.cut();
    return ep.build();
  }

  private async createPrintJobsForOrder(order: Order): Promise<void> {
    const tenantId = this.currentTenantId();
    const settings = await this.getUiSettings();
    if (settings.printing.protocol !== "escpos") {
      return;
    }

    const activeAreas = settings.printing.activeAreas;
    if (activeAreas.length === 0) {
      return;
    }

    const menuIds = [...new Set(order.items.map((item) => item.id))];

    const allIngredientIds = new Set<string>();
    for (const item of order.items) {
      for (const entry of item.ingredientOverrides ?? []) {
        allIngredientIds.add(entry.ingredientId);
      }
    }
    const ingredientRows =
      allIngredientIds.size > 0
        ? await db
            .select({ id: inventory.id, name: inventory.name })
            .from(inventory)
            .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, [...allIngredientIds])))
        : [];
    const inventoryNameById = new Map(ingredientRows.map((row) => [row.id, row.name]));

    const allOptionIds = new Set<string>();
    for (const item of order.items) {
      for (const mod of item.selectedModifiers ?? []) {
        allOptionIds.add(mod.optionId);
      }
    }

    let optionNameByOptionId = new Map<string, string>();
    let priceDeltaByOptionId = new Map<string, number>();
    let inventoryItemIdByOptionId = new Map<string, string>();
    if (allOptionIds.size > 0) {
      const optionRows = await db
        .select({ id: menuModifierOptions.id, name: menuModifierOptions.name, priceDelta: menuModifierOptions.priceDelta, inventoryItemId: menuModifierOptions.inventoryItemId })
        .from(menuModifierOptions)
        .where(and(eq(menuModifierOptions.tenantId, tenantId), inArray(menuModifierOptions.id, [...allOptionIds])));
      for (const row of optionRows) {
        optionNameByOptionId.set(row.id, row.name);
        priceDeltaByOptionId.set(row.id, Number(row.priceDelta));
        if (row.inventoryItemId) {
          inventoryItemIdByOptionId.set(row.id, row.inventoryItemId);
        }
      }

      const poolOptionRows = await db
        .select({ id: categoryModifierPoolOptions.id, priceDelta: categoryModifierPoolOptions.priceDelta, inventoryItemId: categoryModifierPoolOptions.inventoryItemId })
        .from(categoryModifierPoolOptions)
        .where(and(eq(categoryModifierPoolOptions.tenantId, tenantId), inArray(categoryModifierPoolOptions.id, [...allOptionIds])));
      for (const row of poolOptionRows) {
        if (!priceDeltaByOptionId.has(row.id)) {
          priceDeltaByOptionId.set(row.id, Number(row.priceDelta));
        }
        if (row.inventoryItemId) {
          inventoryItemIdByOptionId.set(row.id, row.inventoryItemId);
        }
      }
    }

    const poolInventoryIds = [...new Set([...inventoryItemIdByOptionId.values()])];
    if (poolInventoryIds.length > 0) {
      const poolInvRows = await db
        .select({ id: inventory.id, name: inventory.name })
        .from(inventory)
        .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, poolInventoryIds)));
      for (const row of poolInvRows) {
        inventoryNameById.set(row.id, row.name);
      }
    }

    const areaByMenuId = await this.resolvePrintAreasForMenuIds(menuIds);
    const itemsByArea = new Map<PrintArea, Array<{
      name: string; quantity: number; price: number; notes: string;
      modifiers: string[]; modifierOptionIds: string[]; overrides: string[];
    }>>();

    for (const item of order.items) {
      const areas = areaByMenuId.get(item.id) ?? ["kitchen"];

      const modStrings: string[] = [];
      const modOptionIds: string[] = [];
      for (const mod of item.selectedModifiers ?? []) {
        const oName = optionNameByOptionId.get(mod.optionId) ?? mod.optionId;
        modStrings.push(oName);
        modOptionIds.push(mod.optionId);
      }

      const ovrStrings: string[] = [];
      for (const entry of item.ingredientOverrides ?? []) {
        const ingName = inventoryNameById.get(entry.ingredientId) ?? entry.ingredientId;
        ovrStrings.push(entry.action === "remove" ? `- ${ingName}` : `+ ${ingName}`);
      }

      const richItem = {
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes ?? "",
        modifiers: modStrings,
        modifierOptionIds: modOptionIds,
        overrides: ovrStrings,
      };

      for (const area of areas) {
        if (!activeAreas.includes(area)) continue;
        const existing = itemsByArea.get(area) ?? [];
        existing.push(richItem);
        itemsByArea.set(area, existing);
      }
    }

    if (itemsByArea.size === 0) {
      return;
    }

    const jobs = [...itemsByArea.entries()].map(([area, items]) => {
      const now = new Date();
      return {
        id: `pj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        tenantId,
        orderId: order.id,
        area,
        protocol: settings.printing.protocol,
        status: "pending" as const,
        payload: this.buildEscPosPayload({
          order,
          area,
          items,
          kitchenSummary: null,
          settings,
          priceDeltaByOptionId,
        }),
        error: null,
        createdAt: now,
        updatedAt: now,
        dispatchedAt: null,
      };
    });

    await withTenantTx(async (tx) => {
      await tx.insert(printJobs).values(jobs);
    });
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

  async getBootstrapData(enabledModules: string[], role?: string): Promise<{
    data: AppData;
    staff: Staff[];
    uiSettings: UiSettings;
    staffAdmin: StaffAdmin[];
    payments: PaymentsListResponse;
    printJobs: PrintJob[];
    inventoryItems: Ingredient[];
    bomItems: BomItem[];
    prepItems: PrepItem[];
    menuItemsAdmin: MenuItemAdmin[];
    categories: Category[];
    customers: Customer[];
    orderHistory: Order[];
    customerAnalytics: CustomerAnalytics | null;
  }> {
    const tenantId = this.currentTenantId();
    const inventoryEnabled = enabledModules.includes('inventory');
    const simpleCatalogOnly = enabledModules.includes('simple_catalog') && !inventoryEnabled;
    const kitchenEnabled = enabledModules.includes('kitchen');
    const analyticsEnabled = enabledModules.includes('analytics');
    const printingEnabled = enabledModules.includes('printing');
    const customersEnabled = enabledModules.includes('customers');

    // C4 — bootstrap per-dominio: carichiamo SOLO i domini accessibili al ruolo
    // (allineato a route-guards.ts). Un cameriere non scarica payments, analytics,
    // orderHistory o inventory admin che non può aprire; i domini admin si caricano
    // lazy alla prima apertura della view tramite le refresh* dello store.
    const isAdmin = role === "admin";
    const isChef = role === "chef";
    const isWaiter = role === "waiter";
    // Se il ruolo non è risolvibile, mantieni il comportamento precedente (tutto).
    const isAdminOrUnresolved = isAdmin || role === undefined;
    const canViewInventory = isAdmin || isChef;
    const canViewCustomers = isAdmin || isWaiter;

    // Parallel fetch all data in a single round-trip
    const [
      data,
      staff,
      uiSettings,
      staffAdmin,
      payments,
      printJobs,
      inventoryItems,
      bomItems,
      prepItems,
      categories,
      customers,
      orderHistory,
      customerAnalytics,
    ] = await Promise.all([
      kitchenEnabled ? this.getPublicData() : Promise.resolve({ staff: [], tables: [], inventory: [], bomItems: [], menu: [], orders: [], categories: [], categoryModifierPools: [] } as AppData),
      this.staffRepo.listStaffPublic(),
      this.getUiSettings(),
      isAdminOrUnresolved && kitchenEnabled ? this.staffRepo.listStaffAdmin() : Promise.resolve([]),
      isAdminOrUnresolved && analyticsEnabled ? this.paymentsRepo.listPayments({ limit: 200 }) : Promise.resolve([]),
      isAdminOrUnresolved && printingEnabled ? this.printJobsRepo.listPrintJobs({ limit: 100 }) : Promise.resolve([]),
      canViewInventory && inventoryEnabled ? this.inventoryRepo.listInventoryItems() : Promise.resolve([]),
      canViewInventory && inventoryEnabled ? this.inventoryRepo.listBomItems() : Promise.resolve([]),
      canViewInventory && inventoryEnabled ? this.inventoryRepo.listPrepItems() : Promise.resolve([]),
      canViewInventory && (inventoryEnabled || simpleCatalogOnly)
        ? this.inventoryRepo.listCategories()
        : Promise.resolve([]),
      canViewCustomers && customersEnabled ? this.customerRepo.listCustomers({ limit: 100 }) : Promise.resolve([]),
      isAdminOrUnresolved && analyticsEnabled ? this.listOrderHistory({ limit: 200 }) : Promise.resolve([]),
      isAdminOrUnresolved && analyticsEnabled ? this.customerRepo.getCustomerAnalytics({}) : Promise.resolve(null),
    ]);

    const menuItemsAdmin = canViewInventory && (inventoryEnabled || simpleCatalogOnly)
      ? await this.inventoryRepo.listMenuItemsAdmin()
      : [];

    return {
      data,
      staff,
      uiSettings,
      staffAdmin,
      payments,
      printJobs,
      inventoryItems,
      bomItems,
      prepItems,
      menuItemsAdmin,
      categories,
      customers,
      orderHistory,
      customerAnalytics,
    };
  }

  async updateUiSettings(payload: UpdateUiSettingsRequest): Promise<UiSettings> {
    const parsed = updateUiSettingsRequestSchema.parse(payload);
    const tenantId = this.currentTenantId();
    const raw = await this.getRawUiSettingsJson();
    const existing = raw?.value ? this.mergeUiSettingsWithDefaults(raw.value) : null;
    const themeChanged =
      !existing || JSON.stringify(existing.theme) !== JSON.stringify(parsed.theme);
    if (themeChanged) {
      this.validateThemeContrast(parsed);
    }
    this.validatePrintingSettings(parsed);

    await db
      .insert(appSettings)
      .values({
        key: this.settingsKey,
        tenantId,
        value: JSON.stringify(parsed),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [appSettings.tenantId, appSettings.key],
        set: {
          tenantId,
          value: JSON.stringify(parsed),
          updatedAt: new Date(),
        },
      });

    return parsed;
  }

  async updatePrintingSettings(payload: { printing: Partial<UiSettings["printing"]> }): Promise<UiSettings> {
    const tenantId = this.currentTenantId();
    const raw = await this.getRawUiSettingsJson();

    const base = raw?.value ? this.mergeUiSettingsWithDefaults(raw.value) : defaultUiSettings;
    const next: UiSettings = uiSettingsSchema.parse({
      ...base,
      printing: {
        ...base.printing,
        ...(payload.printing ?? {}),
      },
    });

    this.validatePrintingSettings(next);

    await db
      .insert(appSettings)
      .values({
        key: this.settingsKey,
        tenantId,
        value: JSON.stringify(next),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [appSettings.tenantId, appSettings.key],
        set: {
          tenantId,
          value: JSON.stringify(next),
          updatedAt: new Date(),
        },
      });

    return next;
  }

  private explodeBomRequirements(params: {
    bomId: string;
    multiplier: number;
    bomById: Map<string, BomRow>;
    componentsByBomId: Map<string, BomComponentRow[]>;
    visited?: Set<string>;
  }): { ingredients: Map<string, number>; preps: Map<string, number> } {
    const { bomId, multiplier, bomById, componentsByBomId } = params;
    const visited = params.visited ?? new Set<string>();

    if (visited.has(bomId)) {
      const bomName = bomById.get(bomId)?.name ?? bomId;
      throw new Error(`BoM recursion cycle detected at "${bomName}" (${bomId})`);
    }

    const bom = bomById.get(bomId);
    if (!bom) {
      throw new Error(`BoM item ${bomId} not found`);
    }

    if (bom.isActive !== 1) {
      throw new Error(`BoM "${bom.name}" (${bomId}) is not active`);
    }

    const yieldQty = toNumeric(bom.yieldQuantity);
    if (yieldQty <= 0) {
      throw new Error(`Invalid BoM yield for ${bomId}`);
    }

    const normalizedMultiplier = multiplier / yieldQty;
    const components = componentsByBomId.get(bomId) ?? [];
    const ingredients = new Map<string, number>();
    const preps = new Map<string, number>();

    const nextVisited = new Set(visited);
    nextVisited.add(bomId);

    for (const component of components) {
      const qty = toNumeric(component.quantity) * normalizedMultiplier;

      if (component.componentType === "ingredient") {
        ingredients.set(component.componentId, (ingredients.get(component.componentId) ?? 0) + qty);
      } else if (component.componentType === "bom") {
        const nested = this.explodeBomRequirements({
          bomId: component.componentId,
          multiplier: qty,
          bomById,
          componentsByBomId,
          visited: nextVisited,
        });

        for (const [ingredientId, nestedQty] of nested.ingredients) {
          ingredients.set(ingredientId, (ingredients.get(ingredientId) ?? 0) + nestedQty);
        }
        for (const [prepId, nestedQty] of nested.preps) {
          preps.set(prepId, (preps.get(prepId) ?? 0) + nestedQty);
        }
      } else if (component.componentType === "prep") {
        preps.set(component.componentId, (preps.get(component.componentId) ?? 0) + qty);
      }
    }

    return { ingredients, preps };
  }

  private async mapBomItems(executor: typeof db = db): Promise<BomItem[]> {
    const tenantId = getTenantIdOrDefault();
    const [bomRows, componentRows] = await Promise.all([
      executor.select().from(bomItems).where(eq(bomItems.tenantId, tenantId)),
      executor.select().from(bomComponents).where(eq(bomComponents.tenantId, tenantId)),
    ]);

    const componentsByBomId = new Map<string, typeof componentRows>();
    for (const component of componentRows) {
      const existing = componentsByBomId.get(component.bomId) ?? [];
      existing.push(component);
      componentsByBomId.set(component.bomId, existing);
    }

    return bomRows.map((row) =>
      bomItemSchema.parse({
        id: row.id,
        name: row.name,
        outputUnit: row.outputUnit,
        yieldQuantity: Number(row.yieldQuantity),
        isActive: row.isActive === 1,
        categoryId: row.categoryId ?? undefined,
        components: (componentsByBomId.get(row.id) ?? []).map((component) => ({
          id: String(component.id),
          componentType: component.componentType,
          componentId: component.componentId,
          quantity: Number(component.quantity),
          unit: component.unit,
        })),
      }),
    );
  }

  private mapInventoryRows(rows: { id: string; name: string; quantity: unknown; unit: string; minThreshold: unknown; categoryId: string | null; unitCost: unknown; salePrice: string | null; isActive: number; isStockTracked?: number; supplierName?: string | null; brandName?: string | null; sku?: string | null }[]): Ingredient[] {
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      sku: row.sku ?? null,
      quantity: Number(row.quantity),
      unit: row.unit,
      minThreshold: Number(row.minThreshold),
      categoryId: row.categoryId ?? undefined,
      unitCost: Number(row.unitCost ?? 0),
      salePrice: row.salePrice != null ? Number(row.salePrice) : null,
      isActive: row.isActive === 1,
      isStockTracked: row.isStockTracked == null || row.isStockTracked === 1,
      supplierName: row.supplierName ?? null,
      brandName: row.brandName ?? null,
    }));
  }

  private mapCategoryRow(row: typeof categories.$inferSelect): Category {
    return {
      id: row.id,
      name: row.name,
      scope: categoryScopeSchema.parse(row.scope),
      isActive: row.isActive === 1,
      printAreas: parsePrintAreas(row.printAreas),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }


  async getPublicData(): Promise<AppData> {
    const tenantId = getTenantIdOrDefault();
    const [staffRows, tableRows, inventoryRows, menuRows, canonicalMenuComponents, prepRows, orderRows, orderItemRows, mappedBomItems, modifierGroupRows, modifierOptionRows, modifierOptionOverrideRows, catPoolRows, catPoolOptionRows, catPoolCategoryRows, categoryRows, deliveryOrderRows] =
      // Run the whole read set on ONE pooled connection inside a transaction
      // with a single transaction-local RLS set_config. Previously each of the
      // ~20 standalone queries paid connect + set_config + query + clear (4
      // round trips), and the Promise.all needed ~20 concurrent pool
      // connections while the pool max is 10, so bursts queued under load.
      await withTenantTx(async (executor) => Promise.all([
        executor.select().from(staff).where(eq(staff.tenantId, tenantId)),
        executor.select().from(tables).where(eq(tables.tenantId, tenantId)),
        executor.select().from(inventory).where(eq(inventory.tenantId, tenantId)),
        executor.select().from(menuItems).where(eq(menuItems.tenantId, tenantId)),
        executor.select().from(menuItemComponents).where(eq(menuItemComponents.tenantId, tenantId)),
        executor.select().from(prepItems).where(eq(prepItems.tenantId, tenantId)),
        executor.select().from(orders).where(and(eq(orders.tenantId, tenantId), ne(orders.status, "paid"), ne(orders.status, "cancelled"))),
        // Solo item degli ordini aperti (specchia il filtro su orders): gli item
        // degli ordini paid/cancelled non servono mai a getPublicData e, senza
        // questo filtro, si scaricavano TUTTI gli item storici del tenant.
        executor.select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          menuItemId: orderItems.menuItemId,
          name: orderItems.name,
          price: orderItems.price,
          quantity: orderItems.quantity,
          ingredientOverrides: orderItems.ingredientOverrides,
          selectedModifiers: orderItems.selectedModifiers,
        })
          .from(orderItems)
          .where(and(
            eq(orderItems.tenantId, tenantId),
            inArray(
              orderItems.orderId,
              executor.select({ id: orders.id }).from(orders).where(and(
                eq(orders.tenantId, tenantId),
                ne(orders.status, "paid"),
                ne(orders.status, "cancelled"),
              )),
            ),
          )),
        this.mapBomItems(executor),
        executor.select().from(menuModifierGroups).where(eq(menuModifierGroups.tenantId, tenantId)),
        executor.select().from(menuModifierOptions).where(eq(menuModifierOptions.tenantId, tenantId)),
        executor.select().from(menuModifierOptionOverrides).where(eq(menuModifierOptionOverrides.tenantId, tenantId)),
        executor.select().from(categoryModifierPools).where(eq(categoryModifierPools.tenantId, tenantId)),
        executor.select().from(categoryModifierPoolOptions).where(eq(categoryModifierPoolOptions.tenantId, tenantId)),
        executor.select().from(categoryModifierPoolCategories).where(eq(categoryModifierPoolCategories.tenantId, tenantId)),
        executor.select().from(categories).where(eq(categories.tenantId, tenantId)),
        executor.select({ orderId: deliveryOrders.orderId, eta: deliveryOrders.eta }).from(deliveryOrders).where(eq(deliveryOrders.tenantId, tenantId)),
      ]));

    const publicStaff: Staff[] = staffRows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role as Staff["role"],
    }));

    const mappedTables: Table[] = tableRows
      .map((row) => ({
        id: row.id,
        number: row.number,
        status: row.status as Table["status"],
        currentOrderId: row.currentOrderId ?? undefined,
      }))
      .sort((a, b) => {
        const aNum = Number(a.number);
        const bNum = Number(b.number);
        const aIsNum = Number.isFinite(aNum);
        const bIsNum = Number.isFinite(bNum);

        if (aIsNum && bIsNum) {
          return aNum - bNum;
        }

        return a.number.localeCompare(b.number, "it", { numeric: true, sensitivity: "base" });
      });

    const mappedInventory = this.mapInventoryRows(inventoryRows);

    const ingredientNameById = new Map(inventoryRows.map((row) => [row.id, row.name]));
    const ingredientUnitById = new Map(inventoryRows.map((row) => [row.id, row.unit]));
    const prepNameById = new Map(prepRows.map((row) => [row.id, row.name]));
    const prepUnitById = new Map(prepRows.map((row) => [row.id, row.outputUnit]));
    const bomNameById = new Map(mappedBomItems.map((item) => [item.id, item.name]));

    const ingredientsByMenuId = new Map<string, string[]>();
    for (const component of canonicalMenuComponents) {
      if (component.componentType !== "ingredient") continue;
      const existing = ingredientsByMenuId.get(component.menuItemId) ?? [];
      existing.push(component.componentId);
      ingredientsByMenuId.set(component.menuItemId, existing);
    }

    const recipeByMenuId = new Map<string, Array<{ componentType: "ingredient" | "bom" | "prep"; componentId: string; componentName: string; quantity: number; unit: string }>>();
    for (const component of canonicalMenuComponents) {
      const existing = recipeByMenuId.get(component.menuItemId) ?? [];
      const name = component.componentType === "ingredient"
        ? ingredientNameById.get(component.componentId) ?? component.componentId
        : component.componentType === "prep"
          ? prepNameById.get(component.componentId) ?? component.componentId
          : bomNameById.get(component.componentId) ?? component.componentId;
      const unit = component.componentType === "ingredient"
        ? ingredientUnitById.get(component.componentId) ?? ""
        : component.componentType === "prep"
          ? prepUnitById.get(component.componentId) ?? ""
          : mappedBomItems.find((item) => item.id === component.componentId)?.outputUnit ?? "";
      existing.push({
        componentType: component.componentType as "ingredient" | "bom" | "prep",
        componentId: component.componentId,
        componentName: name,
        quantity: toNumeric(component.quantity),
        unit,
      });
      recipeByMenuId.set(component.menuItemId, existing);
    }

    const overridesByOptionId = new Map<string, Array<{ ingredientId: string; action: "add" | "remove" | "replace" }>>();
    for (const override of modifierOptionOverrideRows) {
      const existing = overridesByOptionId.get(override.optionId) ?? [];
      existing.push({ ingredientId: override.ingredientId, action: override.action as "add" | "remove" | "replace" });
      overridesByOptionId.set(override.optionId, existing);
    }

    const optionsByGroupId = new Map<string, Array<{ id: string; name: string; inventoryItemId?: string; componentType: "ingredient" | "prep" | "bom"; componentId?: string; quantity: number; unit: "mg" | "g" | "kg" | "ml" | "L" | "pz"; priceDelta: number; isDefault: boolean; isActive: boolean; sortOrder: number; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }>>();
    for (const opt of modifierOptionRows) {
      const existing = optionsByGroupId.get(opt.groupId) ?? [];
      existing.push({
        id: opt.id,
        name: opt.name,
        inventoryItemId: opt.inventoryItemId ?? undefined,
        componentType: (opt.componentType as "ingredient" | "prep" | "bom") ?? "ingredient",
        componentId: opt.componentId ?? undefined,
        quantity: Number(opt.quantity ?? 1),
        unit: (opt.unit as "mg" | "g" | "kg" | "ml" | "L" | "pz") ?? "pz",
        priceDelta: Number(opt.priceDelta),
        isDefault: Boolean(opt.isDefault),
        isActive: Boolean(opt.isActive),
        sortOrder: opt.sortOrder ?? 0,
        ingredientOverrides: overridesByOptionId.get(opt.id) ?? [],
      });
      optionsByGroupId.set(opt.groupId, existing);
    }

    const modifierGroupsByMenuId = new Map<string, Array<{ id: string; name: string; required: boolean; minSelections: number; maxSelections: number; sortOrder: number; options: Array<{ id: string; name: string; inventoryItemId?: string; componentType: "ingredient" | "prep" | "bom"; componentId?: string; quantity: number; unit: "mg" | "g" | "kg" | "ml" | "L" | "pz"; priceDelta: number; isDefault: boolean; isActive: boolean; sortOrder: number; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }> }>>();
    for (const group of modifierGroupRows) {
      const existing = modifierGroupsByMenuId.get(group.menuItemId) ?? [];
      existing.push({
        id: group.id,
        name: group.name,
        required: Boolean(group.required),
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder ?? 0,
        options: optionsByGroupId.get(group.id) ?? [],
      });
      modifierGroupsByMenuId.set(group.menuItemId, existing);
    }

    const inventoryNameById = new Map(inventoryRows.map((row) => [row.id, row.name]));

    const catPoolOptionsByPoolId = new Map<string, Array<{ id: string; name: string; componentType: "ingredient" | "prep" | "bom"; componentId?: string; quantity: number; unit: string; priceDelta: number; isDefault: boolean; isActive: boolean; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }>>();
    for (const opt of catPoolOptionRows) {
      const existing = catPoolOptionsByPoolId.get(opt.poolId) ?? [];
      const optionName = opt.name ?? (opt.inventoryItemId ? inventoryNameById.get(opt.inventoryItemId) : undefined) ?? opt.componentId ?? opt.inventoryItemId ?? '';
      existing.push({
        id: opt.id,
        name: optionName,
        componentType: (opt.componentType as "ingredient" | "prep" | "bom") ?? "ingredient",
        componentId: opt.componentId ?? opt.inventoryItemId ?? undefined,
        quantity: Number(opt.quantity ?? 1),
        unit: opt.unit ?? "pz",
        priceDelta: Number(opt.priceDelta),
        isDefault: false,
        isActive: true,
        ingredientOverrides: opt.inventoryItemId ? [{ ingredientId: opt.inventoryItemId, action: "add" as const }] : [],
      });
      catPoolOptionsByPoolId.set(opt.poolId, existing);
    }

    const catPoolCategoriesByPoolId = new Map<string, string[]>();
    for (const cat of catPoolCategoryRows) {
      const existing = catPoolCategoriesByPoolId.get(cat.poolId) ?? [];
      existing.push(cat.categoryId);
      catPoolCategoriesByPoolId.set(cat.poolId, existing);
    }

    const catPoolGroupsByCategoryId = new Map<string, Array<{ id: string; name: string; required: boolean; minSelections: number; maxSelections: number; options: Array<{ id: string; name: string; componentType: "ingredient" | "prep" | "bom"; componentId?: string; priceDelta: number; isDefault: boolean; isActive: boolean; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }> }>>();
    for (const pool of catPoolRows) {
      const poolCategoryIds = catPoolCategoriesByPoolId.get(pool.id) ?? (pool.categoryId ? [pool.categoryId] : []);
      const poolGroup = {
        id: pool.id,
        name: pool.name,
        required: false,
        minSelections: 0,
        maxSelections: 99,
        options: catPoolOptionsByPoolId.get(pool.id) ?? [],
      };
      for (const catId of poolCategoryIds) {
        const existing = catPoolGroupsByCategoryId.get(catId) ?? [];
        existing.push(poolGroup);
        catPoolGroupsByCategoryId.set(catId, existing);
      }
    }

    const mappedMenu: MenuItem[] = menuRows
      .map((row) => {
        const categoryPoolModifiers = row.categoryId ? (catPoolGroupsByCategoryId.get(row.categoryId) ?? []) : [];
        return {
          id: row.id,
          name: row.name,
          price: Number(row.price),
          category: row.category,
          categoryId: row.categoryId ?? undefined,
          printAreas: parsePrintAreas(row.printAreas),
          isJolly: row.isJolly === 1,
          ingredients: ingredientsByMenuId.get(row.id) ?? [],
          recipe: recipeByMenuId.get(row.id) ?? [],
          modifiers: [],
          modifierGroups: modifierGroupsByMenuId.get(row.id) ?? [],
        };
      })
      .filter((item) => {
        const row = menuRows.find((menu) => menu.id === item.id);
        return row?.isActive === 1;
      });

    const itemsByOrderId = new Map<string, Order["items"]>();
    for (const item of orderItemRows) {
      const existing = itemsByOrderId.get(item.orderId) ?? [];
      existing.push({
        id: item.menuItemId,
        orderItemId: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        ingredientOverrides: parseIngredientOverrides(item.ingredientOverrides),
        selectedModifiers: parseSelectedModifiers(item.selectedModifiers),
      });
      itemsByOrderId.set(item.orderId, existing);
    }

    const deliveryEtaByOrderId = new Map<string, Date>();
    for (const row of deliveryOrderRows) {
      if (row.eta) deliveryEtaByOrderId.set(row.orderId, row.eta);
    }

    const mappedOrders: Order[] = orderRows.map((row) => {
      const pickupEta = row.pickupEta;
      const deliveryEta = deliveryEtaByOrderId.get(row.id);
      const scheduledFor = (pickupEta ?? deliveryEta)?.toISOString();

      return orderSchema.parse({
        id: row.id,
        orderType: orderTypeSchema.parse(row.orderType as OrderType),
        table: row.tableNumber ?? undefined,
        ticketNumber: row.ticketNumber ?? undefined,
        customerName: row.customerName ?? undefined,
        customerId: row.customerId ?? undefined,
        customerPhone: row.customerPhone ?? undefined,
        scheduledFor,
        items: itemsByOrderId.get(row.id) ?? [],
        total: Number(row.total),
        status: row.status,
        timestamp: row.timestamp.toISOString(),
        staffId: row.staffId,
      });
    });

    const mappedCategories: Category[] = categoryRows.map((row) => this.mapCategoryRow(row));

    const categoryModifierPoolsResult: CategoryModifierPool[] = [];
    const catPoolOptionsByPoolIdForResponse = new Map<string, CategoryModifierPool["options"]>();
    for (const opt of catPoolOptionRows) {
      const existing = catPoolOptionsByPoolIdForResponse.get(opt.poolId) ?? [];
      existing.push({
        id: opt.id,
        name: opt.name ?? undefined,
        inventoryItemId: opt.inventoryItemId ?? undefined,
        componentType: (opt.componentType as "ingredient" | "prep" | "bom") ?? "ingredient",
        componentId: opt.componentId ?? opt.inventoryItemId ?? undefined,
        quantity: Number(opt.quantity ?? 1),
        unit: opt.unit ?? "pz",
        priceDelta: Number(opt.priceDelta),
        sortOrder: opt.sortOrder ?? 0,
      });
      catPoolOptionsByPoolIdForResponse.set(opt.poolId, existing);
    }
    for (const pool of catPoolRows) {
      const categoryIds = catPoolCategoriesByPoolId.get(pool.id) ?? [];
      categoryModifierPoolsResult.push({
        id: pool.id,
        categoryId: pool.categoryId ?? undefined,
        categoryIds,
        name: pool.name,
        sortOrder: pool.sortOrder ?? 0,
        options: catPoolOptionsByPoolIdForResponse.get(pool.id) ?? [],
      });
    }

    return appDataSchema.parse({
      staff: publicStaff,
      tables: mappedTables,
      inventory: mappedInventory,
      bomItems: mappedBomItems,
      menu: mappedMenu,
      orders: mappedOrders,
      categories: mappedCategories,
      categoryModifierPools: categoryModifierPoolsResult,
    });
  }

  async getPublicMenu(tenantSlug: string): Promise<PublicMenuResponse> {
    const [tenantRows] = await Promise.all([
      db.select().from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1),
    ]);

    const tenant = tenantRows[0];
    if (!tenant) {
      throw new Error("Tenant not found for public menu");
    }

    const enabledModules = await this.staffRepo.getEnabledModulesForTenant(tenant.id);
    if (!enabledModules.includes("public_menu")) {
      throw new Error("Public menu module is disabled for this tenant");
    }

    const [categoryRows, menuRows, componentRows, moduleConfigRows, takeawayConfigRows] = await Promise.all([
      db
        .select()
        .from(categories)
        .where(and(eq(categories.tenantId, tenant.id), eq(categories.isActive, 1))),
      db
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.tenantId, tenant.id), eq(menuItems.isActive, 1))),
      db.select().from(menuItemComponents).where(eq(menuItemComponents.tenantId, tenant.id)),
      db
        .select()
        .from(tenantModuleConfigs)
        .where(and(eq(tenantModuleConfigs.tenantId, tenant.id), eq(tenantModuleConfigs.moduleKey, "public_menu")))
        .limit(1),
      db
        .select()
        .from(tenantModuleConfigs)
        .where(and(eq(tenantModuleConfigs.tenantId, tenant.id), eq(tenantModuleConfigs.moduleKey, "public_takeaway")))
        .limit(1),
    ]);

    const moduleConfigRaw = moduleConfigRows[0]?.config;
    let moduleConfig: unknown = {};
    if (moduleConfigRaw) {
      try {
        moduleConfig = JSON.parse(moduleConfigRaw);
      } catch {
        moduleConfig = {};
      }
    }

    const menuConfig = publicMenuModuleConfigSchema.parse(moduleConfig);
    const branding = publicMenuBrandingSchema.parse(menuConfig);

    const takeawayConfigRaw = takeawayConfigRows[0]?.config;
    let takeawayConfig: {
      minOrderAmount?: number;
      maxItems?: number;
      pickupEtaRequired?: boolean;
      allowNotes?: boolean;
    } = {};
    if (takeawayConfigRaw) {
      try {
        takeawayConfig = JSON.parse(takeawayConfigRaw) as typeof takeawayConfig;
      } catch {
        takeawayConfig = {};
      }
    }

    const ingredientsByMenuId = new Map<string, string[]>();
    const bomByMenuId = new Map<string, string[]>();
    for (const row of componentRows) {
      if (row.componentType === "ingredient") {
        const existing = ingredientsByMenuId.get(row.menuItemId) ?? [];
        existing.push(row.componentId);
        ingredientsByMenuId.set(row.menuItemId, existing);
      } else if (row.componentType === "bom") {
        const existing = bomByMenuId.get(row.menuItemId) ?? [];
        existing.push(row.componentId);
        bomByMenuId.set(row.menuItemId, existing);
      }
    }

    const hiddenCategories = new Set(menuConfig.hiddenCategoryIds);
    const featuredItems = new Set(menuConfig.featuredItemIds);
    const soldOutItems = new Set(menuConfig.soldOutItemIds);

    const visibleCategories = categoryRows
      .filter((row) => !hiddenCategories.has(row.id))
      .sort((a, b) => {
        const ai = menuConfig.categoryOrder.indexOf(a.id);
        const bi = menuConfig.categoryOrder.indexOf(b.id);
        const av = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
        const bv = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
        return av - bv;
      });

    const visibleCategoryIds = new Set(visibleCategories.map((row) => row.id));

    const publicItems = menuRows
      .filter((row) => !row.categoryId || visibleCategoryIds.has(row.categoryId))
      .map((row) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        categoryId: row.categoryId ?? undefined,
        category: row.category,
        ingredients: ingredientsByMenuId.get(row.id) ?? [],
        bomIds: bomByMenuId.get(row.id) ?? [],
        printAreas: parsePrintAreas(row.printAreas),
        isFeatured: featuredItems.has(row.id),
        isSoldOut: soldOutItems.has(row.id),
      }))
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name));

    return publicMenuResponseSchema.parse({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
      branding,
      capabilities: {
        takeawayOrder:
          enabledModules.includes("public_takeaway") &&
          enabledModules.includes("public_menu") &&
          enabledModules.includes("kitchen"),
        groupOrder:
          enabledModules.includes("public_group_order") &&
          enabledModules.includes("public_menu") &&
          enabledModules.includes("kitchen"),
        takeawayConfig: {
          minOrderAmount: typeof takeawayConfig.minOrderAmount === "number" ? takeawayConfig.minOrderAmount : 0,
          maxItems: typeof takeawayConfig.maxItems === "number" ? takeawayConfig.maxItems : 20,
          pickupEtaRequired: takeawayConfig.pickupEtaRequired === true,
          allowNotes: takeawayConfig.allowNotes !== false,
        },
      },
      categories: visibleCategories.map((row) => ({
        id: row.id,
        name: row.name,
        printAreas: parsePrintAreas(row.printAreas),
      })),
      items: publicItems,
      generatedAt: new Date().toISOString(),
    });
  }

  private async buildGroupOrderSessionState(params: {
    tenantId: string;
    sessionId: string;
    joinCode: string;
  }): Promise<GroupOrderSession> {
    const { tenantId, sessionId, joinCode } = params;
    const [sessionRows, participantRows, itemRows] = await Promise.all([
      db
        .select()
        .from(groupOrderSessions)
        .where(and(eq(groupOrderSessions.tenantId, tenantId), eq(groupOrderSessions.id, sessionId)))
        .limit(1),
      db
        .select()
        .from(groupOrderParticipants)
        .where(and(eq(groupOrderParticipants.tenantId, tenantId), eq(groupOrderParticipants.sessionId, sessionId))),
      db
        .select()
        .from(groupOrderCartItems)
        .where(and(eq(groupOrderCartItems.tenantId, tenantId), eq(groupOrderCartItems.sessionId, sessionId))),
    ]);
    const sessionRow = sessionRows[0];
    if (!sessionRow) {
      throw new Error("Group order session not found");
    }

    const participants: GroupOrderParticipant[] = participantRows.map((row) =>
      groupOrderParticipantSchema.parse({
        id: row.id,
        sessionId: row.sessionId,
        displayName: row.displayName,
        role: row.role,
        isOnline: !row.disconnectedAt,
        joinedAt: row.joinedAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
      }),
    );

    const items: GroupOrderCartItem[] = itemRows.map((row) =>
      groupOrderCartItemSchema.parse({
        id: `${row.sessionId}:${row.menuItemId}`,
        sessionId: row.sessionId,
        menuItemId: row.menuItemId,
        name: row.name,
        price: Number(row.price),
        quantity: row.quantity,
        category: row.category,
        ingredients: JSON.parse(row.ingredientsJson) as string[],
        updatedByParticipantId: row.updatedByParticipantId ?? undefined,
        updatedAt: row.updatedAt.toISOString(),
      }),
    );

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return groupOrderSessionSchema.parse({
      id: sessionRow.id,
      tenantId: sessionRow.tenantId,
      tenantSlug: sessionRow.tenantSlug,
      joinCode,
      status: sessionRow.status,
      version: sessionRow.version,
      masterParticipantId: sessionRow.masterParticipantId,
      submittedOrderId: sessionRow.submittedOrderId ?? undefined,
      expiresAt: sessionRow.expiresAt.toISOString(),
      participants,
      items,
      total,
      createdAt: sessionRow.createdAt.toISOString(),
      updatedAt: sessionRow.updatedAt.toISOString(),
    });
  }

  async createPublicGroupOrderSession(
    tenantSlug: string,
    payload: GroupOrderCreateSessionRequest,
  ): Promise<GroupOrderCreateSessionResponse> {
    const parsed = groupOrderCreateSessionRequestSchema.parse(payload);
    const tenant = await this.staffRepo.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new Error("Tenant not found for public group order");
    }
    await this.assertPublicGroupOrderEnabled(tenant.id);
    const joinCode = crypto.randomBytes(6).toString("hex");
    const participantToken = crypto.randomBytes(24).toString("hex");
    const now = new Date();
    const sessionId = `gos_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const masterParticipantId = `gop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60_000);

    await withTenantTx(async (tx) => {
      await tx.insert(groupOrderSessions).values({
        id: sessionId,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        joinCodeHash: this.hashGroupOrderJoinCode(joinCode),
        status: "open",
        version: 0,
        masterParticipantId,
        submittedOrderId: null,
        submitIdempotencyKeyHash: null,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(groupOrderParticipants).values({
        id: masterParticipantId,
        tenantId: tenant.id,
        sessionId,
        displayName: parsed.displayName.trim(),
        role: "master",
        participantTokenHash: this.hashGroupOrderParticipantToken(participantToken),
        joinedAt: now,
        lastSeenAt: now,
        disconnectedAt: null,
      });
    });

    const session = await this.buildGroupOrderSessionState({ tenantId: tenant.id, sessionId, joinCode });
    const participant = session.participants.find((entry) => entry.id === masterParticipantId);
    if (!participant) {
      throw new Error("Group order participant not found");
    }
    await this.logTenantAudit({
      tenantId: tenant.id,
      actor: `group_order:${participant.id}`,
      event: "group_order_session_created",
      payload: { sessionId, joinCode },
    });

    return groupOrderCreateSessionResponseSchema.parse({
      session,
      participant,
      participantToken,
      joinUrl: `/${tenant.slug}/group-order/${joinCode}`,
    });
  }

  async joinPublicGroupOrderSession(
    tenantSlug: string,
    joinCode: string,
    payload: GroupOrderJoinSessionRequest,
  ): Promise<GroupOrderJoinSessionResponse> {
    const parsed = groupOrderJoinSessionRequestSchema.parse(payload);
    const tenant = await this.staffRepo.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new Error("Tenant not found for public group order");
    }
    await this.assertPublicGroupOrderEnabled(tenant.id);
    const normalizedCode = joinCode.trim().toLowerCase();
    const joinCodeHash = this.hashGroupOrderJoinCode(normalizedCode);

    const sessionRows = await db
      .select()
      .from(groupOrderSessions)
      .where(and(eq(groupOrderSessions.tenantId, tenant.id), eq(groupOrderSessions.joinCodeHash, joinCodeHash)))
      .limit(1);
    const sessionRow = sessionRows[0];
    if (!sessionRow || sessionRow.expiresAt.getTime() <= Date.now() || sessionRow.status !== "open") {
      throw new Error("Group order session not found or expired");
    }

    const participantId = `gop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const participantToken = crypto.randomBytes(24).toString("hex");
    const now = new Date();
    await db.insert(groupOrderParticipants).values({
      id: participantId,
      tenantId: tenant.id,
      sessionId: sessionRow.id,
      displayName: parsed.displayName.trim(),
      role: "guest",
      participantTokenHash: this.hashGroupOrderParticipantToken(participantToken),
      joinedAt: now,
      lastSeenAt: now,
      disconnectedAt: null,
    });

    const session = await this.buildGroupOrderSessionState({ tenantId: tenant.id, sessionId: sessionRow.id, joinCode: normalizedCode });
    const participant = session.participants.find((entry) => entry.id === participantId);
    if (!participant) {
      throw new Error("Group order participant not found");
    }
    await this.logTenantAudit({
      tenantId: tenant.id,
      actor: `group_order:${participant.id}`,
      event: "group_order_session_joined",
      payload: { sessionId: sessionRow.id, joinCode: normalizedCode },
    });
    return groupOrderJoinSessionResponseSchema.parse({ session, participant, participantToken });
  }

  async patchPublicGroupOrderCart(
    tenantSlug: string,
    sessionId: string,
    joinCode: string,
    participantToken: string,
    payload: GroupOrderPatchCartRequest,
  ): Promise<GroupOrderPatchCartResponse> {
    const parsed = groupOrderPatchCartRequestSchema.parse(payload);
    const tenant = await this.staffRepo.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new Error("Tenant not found for public group order");
    }
    await this.assertPublicGroupOrderEnabled(tenant.id);

    const sessionRows = await db
      .select()
      .from(groupOrderSessions)
      .where(and(eq(groupOrderSessions.tenantId, tenant.id), eq(groupOrderSessions.id, sessionId)))
      .limit(1);
    const session = sessionRows[0];
    if (!session || session.joinCodeHash !== this.hashGroupOrderJoinCode(joinCode.trim().toLowerCase())) {
      throw new Error("Group order session not found");
    }
    if (session.status !== "open" || session.expiresAt.getTime() <= Date.now()) {
      throw new Error("Group order session locked or expired");
    }
    if (session.version !== parsed.expectedVersion) {
      const canonical = await this.buildGroupOrderSessionState({ tenantId: tenant.id, sessionId, joinCode });
      return groupOrderPatchCartResponseSchema.parse({ session: canonical, reconciled: true });
    }

    const participantRows = await db
      .select()
      .from(groupOrderParticipants)
      .where(
        and(
          eq(groupOrderParticipants.tenantId, tenant.id),
          eq(groupOrderParticipants.sessionId, sessionId),
          eq(groupOrderParticipants.participantTokenHash, this.hashGroupOrderParticipantToken(participantToken.trim())),
        ),
      )
      .limit(1);
    const participant = participantRows[0];
    if (!participant) {
      throw new Error("Group order participant not authorized");
    }

    const menu = await this.getPublicMenu(tenant.slug);
    const menuById = new Map(menu.items.map((item) => [item.id, item]));
    const now = new Date();
    await withTenantTx(async (tx) => {
      for (const item of parsed.items) {
        const menuItem = menuById.get(item.menuItemId);
        if (!menuItem || menuItem.isSoldOut) {
          continue;
        }

        if (item.quantity <= 0) {
          await tx
            .delete(groupOrderCartItems)
            .where(
              and(
                eq(groupOrderCartItems.tenantId, tenant.id),
                eq(groupOrderCartItems.sessionId, sessionId),
                eq(groupOrderCartItems.menuItemId, item.menuItemId),
              ),
            );
          continue;
        }

        await tx
          .insert(groupOrderCartItems)
          .values({
            tenantId: tenant.id,
            sessionId,
            menuItemId: menuItem.id,
            name: menuItem.name,
            price: String(menuItem.price),
            quantity: item.quantity,
            category: menuItem.category,
            ingredientsJson: JSON.stringify(menuItem.ingredients),
            updatedByParticipantId: participant.id,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [groupOrderCartItems.tenantId, groupOrderCartItems.sessionId, groupOrderCartItems.menuItemId],
            set: {
              quantity: item.quantity,
              updatedByParticipantId: participant.id,
              updatedAt: now,
            },
          });
      }

      await tx
        .update(groupOrderParticipants)
        .set({ lastSeenAt: now, disconnectedAt: null })
        .where(and(eq(groupOrderParticipants.tenantId, tenant.id), eq(groupOrderParticipants.id, participant.id)));

      await tx
        .update(groupOrderSessions)
        .set({ version: session.version + 1, updatedAt: now })
        .where(and(eq(groupOrderSessions.tenantId, tenant.id), eq(groupOrderSessions.id, sessionId)));
    });

    const updated = await this.buildGroupOrderSessionState({ tenantId: tenant.id, sessionId, joinCode });
    await this.logTenantAudit({
      tenantId: tenant.id,
      actor: `group_order:${participant.id}`,
      event: "group_order_cart_updated",
      payload: { sessionId, version: updated.version },
    });
    return groupOrderPatchCartResponseSchema.parse({ session: updated, reconciled: false });
  }

  async submitPublicGroupOrder(
    tenantSlug: string,
    sessionId: string,
    joinCode: string,
    participantToken: string,
    payload: GroupOrderSubmitRequest,
  ): Promise<GroupOrderSubmitResponse> {
    const parsed = groupOrderSubmitRequestSchema.parse(payload);
    const tenant = await this.staffRepo.getTenantBySlug(tenantSlug);
    if (!tenant) {
      throw new Error("Tenant not found for public group order");
    }
    await this.assertPublicGroupOrderEnabled(tenant.id);

    const sessionRows = await db
      .select()
      .from(groupOrderSessions)
      .where(and(eq(groupOrderSessions.tenantId, tenant.id), eq(groupOrderSessions.id, sessionId)))
      .limit(1);
    const session = sessionRows[0];
    if (!session || session.joinCodeHash !== this.hashGroupOrderJoinCode(joinCode.trim().toLowerCase())) {
      throw new Error("Group order session not found");
    }

    const participantRows = await db
      .select()
      .from(groupOrderParticipants)
      .where(
        and(
          eq(groupOrderParticipants.tenantId, tenant.id),
          eq(groupOrderParticipants.sessionId, sessionId),
          eq(groupOrderParticipants.participantTokenHash, this.hashGroupOrderParticipantToken(participantToken.trim())),
        ),
      )
      .limit(1);
    const participant = participantRows[0];
    if (!participant || participant.id !== session.masterParticipantId) {
      throw new Error("Only master can submit group order");
    }
    if (session.status === "submitted" && session.submittedOrderId) {
      const existingOrder = await this.getOrderById(session.submittedOrderId);
      if (!existingOrder) {
        throw new Error("Group order submitted but order missing");
      }
      const mapped = await this.buildGroupOrderSessionState({ tenantId: tenant.id, sessionId, joinCode });
      return groupOrderSubmitResponseSchema.parse({ session: mapped, order: existingOrder });
    }
    if (session.status !== "open" || session.version !== parsed.expectedVersion) {
      throw new Error("Group order submit conflict");
    }

    const itemRows = await db
      .select()
      .from(groupOrderCartItems)
      .where(and(eq(groupOrderCartItems.tenantId, tenant.id), eq(groupOrderCartItems.sessionId, sessionId)));
    if (itemRows.length === 0) {
      throw new Error("Group order cart is empty");
    }

    const idempotencyHash = parsed.idempotencyKey ? this.hashGroupOrderSubmitIdempotencyKey(parsed.idempotencyKey) : null;
    if (idempotencyHash && session.submitIdempotencyKeyHash && session.submitIdempotencyKeyHash === idempotencyHash && session.submittedOrderId) {
      const existingOrder = await this.getOrderById(session.submittedOrderId);
      if (!existingOrder) {
        throw new Error("Group order submitted but order missing");
      }
      const mapped = await this.buildGroupOrderSessionState({ tenantId: tenant.id, sessionId, joinCode });
      return groupOrderSubmitResponseSchema.parse({ session: mapped, order: existingOrder });
    }

    const total = itemRows.reduce((sum, row) => sum + Number(row.price) * row.quantity, 0);
    const staffId = await this.resolveSelfOrderStaffId(tenant.id);
    const created = await this.createOrder({
      orderType: "takeaway",
      items: itemRows.map((row) => ({
        id: row.menuItemId,
        name: row.name,
        price: Number(row.price),
        quantity: row.quantity,
      })),
      total,
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone,
      pickupEta: parsed.pickupEta,
      staffId,
    });

    await db
      .update(groupOrderSessions)
      .set({
        status: "submitted",
        submittedOrderId: created.order.id,
        submitIdempotencyKeyHash: idempotencyHash,
        version: session.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(groupOrderSessions.tenantId, tenant.id), eq(groupOrderSessions.id, sessionId)));

    const mapped = await this.buildGroupOrderSessionState({ tenantId: tenant.id, sessionId, joinCode });
    await this.logTenantAudit({
      tenantId: tenant.id,
      actor: `group_order:${participant.id}`,
      event: "group_order_submitted",
      payload: { sessionId, orderId: created.order.id },
    });
    return groupOrderSubmitResponseSchema.parse({ session: mapped, order: created.order });
  }

  async createPublicTakeawayOrder(
    tenantSlug: string,
    payload: PublicTakeawayCreateRequest,
    consumerUserId?: string,
  ): Promise<PublicTakeawayCreateResponse> {
    const parsed = publicTakeawayCreateRequestSchema.parse(payload);

    const tenantRows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    const tenant = tenantRows[0];
    if (!tenant) {
      throw new Error("Tenant not found for public takeaway");
    }

    await this.assertPublicTakeawayEnabled(tenant.id);

    const takeawayConfigRows = await db
      .select()
      .from(tenantModuleConfigs)
      .where(and(eq(tenantModuleConfigs.tenantId, tenant.id), eq(tenantModuleConfigs.moduleKey, "public_takeaway")))
      .limit(1);
    const configRaw = takeawayConfigRows[0]?.config;
    let config: {
      minOrderAmount?: number;
      maxItems?: number;
      pickupEtaRequired?: boolean;
      allowNotes?: boolean;
    } = {};
    if (configRaw) {
      try {
        config = JSON.parse(configRaw) as typeof config;
      } catch {
        config = {};
      }
    }

    if (typeof config.minOrderAmount === "number" && parsed.total < config.minOrderAmount) {
      throw new Error(`Takeaway minimum order is ${config.minOrderAmount.toFixed(2)}`);
    }

    if (typeof config.maxItems === "number") {
      const itemCount = parsed.items.reduce((sum, item) => sum + item.quantity, 0);
      if (itemCount > config.maxItems) {
        throw new Error(`Takeaway max items exceeded (${config.maxItems})`);
      }
    }

    if (config.pickupEtaRequired && !parsed.pickupEta) {
      throw new Error("Takeaway pickup ETA is required");
    }

    if (config.allowNotes === false && parsed.notes) {
      throw new Error("Takeaway notes are disabled for this tenant");
    }

    const staffId = await this.resolveSelfOrderStaffId(tenant.id);
    const created = await this.createOrder({
      orderType: "takeaway",
      items: parsed.items,
      total: parsed.total,
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone,
      pickupEta: parsed.pickupEta,
      staffId,
    });

    if (consumerUserId) {
      await this.consumerRepo.linkConsumerToOrder(tenant.id, created.order.id, consumerUserId);
    }

    const trackingToken = crypto.randomBytes(24).toString("hex");
    const trackingHash = this.hashTakeawayTrackingToken(trackingToken);
    const expiresAt = new Date(Date.now() + this.takeawayTrackingTtlMinutes * 60_000);

    await db.insert(publicTakeawayTrackingSessions).values({
      id: `pubtrk_${created.order.id}`,
      tenantId: tenant.id,
      orderId: created.order.id,
      tokenHash: trackingHash,
      expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    });

    return publicTakeawayCreateResponseSchema.parse({
      order: created.order,
      trackingToken,
      trackingUrl: `/api/public/${tenant.slug}/takeaway/orders/${created.order.id}/track?token=${trackingToken}`,
    });
  }

  async getPublicTakeawayTracking(
    tenantSlug: string,
    orderId: string,
    trackingToken: string,
  ): Promise<PublicTakeawayTrackingResponse> {
    const tenantRows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    const tenant = tenantRows[0];
    if (!tenant) {
      throw new Error("Tenant not found for takeaway tracking");
    }

    await this.assertPublicTakeawayEnabled(tenant.id);

    const sessionId = `pubtrk_${orderId}`;
    const trackingHash = this.hashTakeawayTrackingToken(trackingToken);
    const sessionRows = await db
      .select()
      .from(publicTakeawayTrackingSessions)
      .where(
        and(
          eq(publicTakeawayTrackingSessions.tenantId, tenant.id),
          eq(publicTakeawayTrackingSessions.id, sessionId),
          eq(publicTakeawayTrackingSessions.orderId, orderId),
          eq(publicTakeawayTrackingSessions.tokenHash, trackingHash),
          isNull(publicTakeawayTrackingSessions.revokedAt),
        ),
      )
      .limit(1);
    const session = sessionRows[0];
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new Error("Takeaway tracking token invalid or expired");
    }

    const orderRows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenant.id), eq(orders.id, orderId), eq(orders.orderType, "takeaway")))
      .limit(1);
    const row = orderRows[0];
    if (!row) {
      throw new Error("Takeaway order not found");
    }

    const itemsRows = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.tenantId, tenant.id), eq(orderItems.orderId, orderId)));

    const order = orderSchema.parse({
      id: row.id,
      orderType: row.orderType,
      table: row.tableNumber ?? undefined,
      ticketNumber: row.ticketNumber ?? undefined,
      customerName: row.customerName ?? undefined,
      customerId: row.customerId ?? undefined,
      items: itemsRows.map((item) => ({
        id: item.menuItemId,
        orderItemId: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        ingredientOverrides: parseIngredientOverrides(item.ingredientOverrides),
        selectedModifiers: parseSelectedModifiers(item.selectedModifiers),
      })),
      total: Number(row.total),
      status: row.status,
      timestamp: row.timestamp.toISOString(),
      staffId: row.staffId,
    });

    return publicTakeawayTrackingResponseSchema.parse({ order });
  }

  async trackPublicFunnelEvent(tenantSlug: string, payload: PublicFunnelEventRequest): Promise<void> {
    const tenantRows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    const tenant = tenantRows[0];
    if (!tenant) {
      throw new Error("Tenant not found for public funnel tracking");
    }

    await db.insert(tenantAuditLogs).values({
      id: `tal_${crypto.randomUUID()}`,
      tenantId: tenant.id,
      actor: "public",
      event: payload.event,
      payload: JSON.stringify(payload.details ?? {}),
      createdAt: new Date(),
    });
  }

  async rotateSelfOrderSessionForTable(tableId: string): Promise<SelfOrderSessionRotateResponse | null> {
    const tenantId = getTenantIdOrDefault();
    await this.assertSelfOrderPublicEnabled(tenantId);

    const tableRows = await db
      .select()
      .from(tables)
      .where(and(eq(tables.tenantId, tenantId), eq(tables.id, tableId)))
      .limit(1);
    const table = tableRows[0];
    if (!table) {
      return null;
    }

    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = this.hashSelfOrderToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.selfOrderTokenTtlMinutes * 60_000);

    await db.transaction(async (tx) => {
      await tx
        .update(selfOrderSessions)
        .set({ isActive: 0, updatedAt: now })
        .where(and(eq(selfOrderSessions.tenantId, tenantId), eq(selfOrderSessions.tableId, tableId), eq(selfOrderSessions.isActive, 1)));

      await tx.insert(selfOrderSessions).values({
        id: `sos_${crypto.randomUUID()}`,
        tenantId,
        tableId,
        tokenHash,
        expiresAt,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
      });
    });

    const tenantRows = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const tenantSlug = tenantRows[0]?.slug ?? tenantId;
    const publicUrl = `/${tenantSlug}/self-order/${token}`;
    return selfOrderSessionRotateResponseSchema.parse({
      tableId: table.id,
      tableNumber: table.number,
      token,
      expiresAt: expiresAt.toISOString(),
      publicUrl,
    });
  }

  async resolveSelfOrderSessionByToken(token: string, tenantSlug: string): Promise<SelfOrderResolveResponse> {
    const tokenHash = this.hashSelfOrderToken(token);
    const tenantRows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    const tenant = tenantRows[0];
    if (!tenant) {
      throw new Error("Tenant not found for self order");
    }

    await this.assertSelfOrderPublicEnabled(tenant.id);

    const now = new Date();
    const sessionRows = await db
      .select()
      .from(selfOrderSessions)
      .where(
        and(
          eq(selfOrderSessions.tenantId, tenant.id),
          eq(selfOrderSessions.tokenHash, tokenHash),
          eq(selfOrderSessions.isActive, 1),
          gt(selfOrderSessions.expiresAt, now),
        ),
      )
      .limit(1);
    const session = sessionRows[0];
    if (!session) {
      throw new Error("Self order session not found or expired");
    }

    const tableRows = await db
      .select()
      .from(tables)
      .where(and(eq(tables.tenantId, tenant.id), eq(tables.id, session.tableId)))
      .limit(1);
    const table = tableRows[0];
    if (!table) {
      throw new Error("Table not found for self order session");
    }

    const menu = await this.getPublicMenu(tenantSlug);
    return selfOrderResolveResponseSchema.parse({
      session: {
        tableId: table.id,
        tableNumber: table.number,
        expiresAt: session.expiresAt.toISOString(),
      },
      menu,
    });
  }

  async createSelfOrder(
    tenantSlug: string,
    payload: SelfOrderCreateRequest,
    consumerUserId?: string,
  ): Promise<SelfOrderCreateResponse> {
    const parsed = selfOrderCreateRequestSchema.parse(payload);

    const tenantRows = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    const tenant = tenantRows[0];
    if (!tenant) {
      throw new Error("Tenant not found for self order");
    }

    await this.assertSelfOrderPublicEnabled(tenant.id);

    const tokenHash = this.hashSelfOrderToken(parsed.token);
    const now = new Date();
    const sessionRows = await db
      .select()
      .from(selfOrderSessions)
      .where(
        and(
          eq(selfOrderSessions.tenantId, tenant.id),
          eq(selfOrderSessions.tokenHash, tokenHash),
          eq(selfOrderSessions.isActive, 1),
          gt(selfOrderSessions.expiresAt, now),
        ),
      )
      .limit(1);
    const session = sessionRows[0];
    if (!session) {
      throw new Error("Self order session not found or expired");
    }

    const tableRows = await db
      .select()
      .from(tables)
      .where(and(eq(tables.tenantId, tenant.id), eq(tables.id, session.tableId)))
      .limit(1);
    const table = tableRows[0];
    if (!table) {
      throw new Error("Table not found for self order session");
    }

    const selfOrderStaffId = await this.resolveSelfOrderStaffId(tenant.id);

    const tableKey = table.number;
    const order = await this.createOrder({
      orderType: "dine_in",
      table: tableKey,
      items: parsed.items,
      total: parsed.total,
      customerName: parsed.customerName,
      customerPhone: parsed.customerPhone,
      staffId: selfOrderStaffId,
    });

    if (consumerUserId) {
      await this.consumerRepo.linkConsumerToOrder(tenant.id, order.order.id, consumerUserId);
    }

    return selfOrderCreateResponseSchema.parse({
      order: order.order,
      sessionExpiresAt: session.expiresAt.toISOString(),
    });
  }


  async listInventoryAudit(inventoryId: string, limit = 50, offset = 0): Promise<{
    items: Array<{
      id: string;
      tenantId: string;
      inventoryId: string;
      field: string;
      oldValue: string | null;
      newValue: string | null;
      changedBy: string | null;
      createdAt: string;
    }>;
    total: number;
  }> {
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [
      eq(inventoryAudit.tenantId, tenantId),
      eq(inventoryAudit.inventoryId, inventoryId),
    ];

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryAudit)
      .where(and(...conditions));
    const total = countResult[0]?.count ?? 0;

    const rows = await db
      .select()
      .from(inventoryAudit)
      .where(and(...conditions))
      .orderBy(desc(inventoryAudit.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        inventoryId: r.inventoryId,
        field: r.field,
        oldValue: r.oldValue,
        newValue: r.newValue,
        changedBy: r.changedBy,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  }


  async createOrder(payload: CreateOrderRequest): Promise<{ order: Order; inventory: Ingredient[] }> {
    const parsed = createOrderRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const orderType: OrderType = parsed.orderType ?? "dine_in";

    if (orderType === "dine_in" && !parsed.table) {
      throw new Error("Dine-in orders require table");
    }

    let customerRecord: typeof customers.$inferSelect | null = null;
    if (orderType === "takeaway" || orderType === "delivery") {
      if (!parsed.customerId && !parsed.customerName) {
        throw new Error("Takeaway/delivery orders require customer selection or customer name");
      }

      if (parsed.customerId) {
        const rows = await db
          .select()
          .from(customers)
          .where(and(eq(customers.tenantId, tenantId), eq(customers.id, parsed.customerId)))
          .limit(1);
        customerRecord = rows[0] ?? null;
        if (!customerRecord) {
          throw new Error("Customer not found");
        }
      } else if (parsed.customerName) {
        customerRecord = await this.customerRepo.createOrReuseCustomer({
          fullName: parsed.customerName,
          ...(parsed.customerPhone ? { phone: parsed.customerPhone } : {}),
        });
      }
    }

    const ticketNumber =
      orderType === "takeaway"
        ? `TA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`
        : undefined;

    const order: Order = orderSchema.parse({
      ...parsed,
      id: crypto.randomUUID(),
      orderType,
      table: orderType === "dine_in" ? parsed.table : undefined,
      ticketNumber,
      customerName: customerRecord?.fullName ?? parsed.customerName,
      customerId: customerRecord?.id ?? parsed.customerId,
      customerPhone: customerRecord?.phone ?? parsed.customerPhone,
      scheduledFor: parsed.pickupEta,
      status: "pending",
      timestamp: new Date().toISOString(),
    });

    const updatedInventory = await withTenantTx(async (tx) => {
      await tx.insert(orders).values({
        id: order.id,
        tenantId,
        orderType: order.orderType,
        tableNumber: order.table ?? null,
        ticketNumber: order.ticketNumber ?? null,
        customerName: order.customerName ?? null,
        customerId: order.customerId ?? null,
        customerPhone: parsed.customerPhone ?? null,
        pickupEta: parsed.pickupEta ? new Date(parsed.pickupEta) : null,
        total: String(order.total),
        status: order.status,
        timestamp: new Date(order.timestamp),
        staffId: order.staffId,
      });

      const insertedOrderItems: Array<{ id: number; menuItemId: string }> = [];
      for (const item of order.items) {
        const [insertedItem] = await tx.insert(orderItems).values({
          tenantId,
          orderId: order.id,
          menuItemId: item.id,
          name: item.name,
          price: String(item.price),
          quantity: item.quantity,
          ingredientOverrides: JSON.stringify(item.ingredientOverrides ?? []),
          notes: item.notes ?? null,
          selectedModifiers: JSON.stringify(item.selectedModifiers ?? []),
        }).returning({ id: orderItems.id, menuItemId: orderItems.menuItemId });
        if (!insertedItem) throw new Error("Failed to persist order item");
        insertedOrderItems.push(insertedItem);
      }

      if (order.orderType === "dine_in" && order.table) {
        await tx
          .update(tables)
          .set({ status: "occupied" })
          .where(and(eq(tables.tenantId, tenantId), eq(tables.number, order.table)));
      }

      const menuIds = [...new Set(order.items.map((item) => item.id))];
      const orderedMenuRows =
        menuIds.length > 0
          ? await tx
              .select({ id: menuItems.id, name: menuItems.name, isActive: menuItems.isActive })
              .from(menuItems)
              .where(and(eq(menuItems.tenantId, tenantId), inArray(menuItems.id, menuIds)))
          : [];

      const menuNameById = new Map(orderedMenuRows.map((row) => [row.id, row.name]));

      if (orderedMenuRows.length !== menuIds.length) {
        const foundIds = new Set(orderedMenuRows.map((row) => row.id));
        const missingId = menuIds.find((id) => !foundIds.has(id));
        const itemName = order.items.find((i) => i.id === missingId)?.name ?? missingId ?? "unknown";
        throw new Error(`Menu item "${itemName}" (${missingId ?? "unknown"}) not found in catalog`);
      }

      const inactiveMenuItem = orderedMenuRows.find((row) => row.isActive !== 1);
      if (inactiveMenuItem) {
        throw new Error(`Menu item "${inactiveMenuItem.name}" (${inactiveMenuItem.id}) is not active`);
      }

      const canonicalComponents =
        menuIds.length > 0
          ? await tx
              .select()
              .from(menuItemComponents)
              .where(and(eq(menuItemComponents.tenantId, tenantId), inArray(menuItemComponents.menuItemId, menuIds)))
          : [];

      // Load modifier options with inventoryItemId for selectedModifiers deduction
      const modifierOptionIds = new Set<string>();
      for (const item of order.items) {
        for (const mod of item.selectedModifiers ?? []) {
          modifierOptionIds.add(mod.optionId);
        }
      }

      let modifierOptionsByOptionId = new Map<string, { inventoryItemId: string | null; componentType: "ingredient" | "prep" | "bom"; componentId: string | null; quantity: number; unit: string }>();
      if (modifierOptionIds.size > 0) {
        const modOptionRows = await tx
          .select({ id: menuModifierOptions.id, inventoryItemId: menuModifierOptions.inventoryItemId, componentType: menuModifierOptions.componentType, componentId: menuModifierOptions.componentId, quantity: menuModifierOptions.quantity, unit: menuModifierOptions.unit })
          .from(menuModifierOptions)
          .where(
            and(
              eq(menuModifierOptions.tenantId, tenantId),
              inArray(menuModifierOptions.id, [...modifierOptionIds]),
            ),
          );
        modifierOptionsByOptionId = new Map(
          modOptionRows.map((row) => [row.id, { inventoryItemId: row.inventoryItemId, componentType: (row.componentType as "ingredient" | "prep" | "bom") ?? "ingredient", componentId: row.componentId, quantity: Number(row.quantity ?? 1), unit: (row.unit as string) ?? "pz" }]),
        );
      }

      // Load category pool options with canonical component reference.
      let poolOptionsByOptionId = new Map<string, { inventoryItemId: string | null; componentType: "ingredient" | "prep" | "bom"; componentId: string | null; quantity: number; unit: string }>();
      if (modifierOptionIds.size > 0) {
        const poolOptionRows = await tx
          .select({ id: categoryModifierPoolOptions.id, inventoryItemId: categoryModifierPoolOptions.inventoryItemId, componentType: categoryModifierPoolOptions.componentType, componentId: categoryModifierPoolOptions.componentId, quantity: categoryModifierPoolOptions.quantity, unit: categoryModifierPoolOptions.unit })
          .from(categoryModifierPoolOptions)
          .where(
            and(
              eq(categoryModifierPoolOptions.tenantId, tenantId),
              inArray(categoryModifierPoolOptions.id, [...modifierOptionIds]),
            ),
          );
        poolOptionsByOptionId = new Map(
          poolOptionRows.map((row) => [row.id, { inventoryItemId: row.inventoryItemId, componentType: (row.componentType as "ingredient" | "prep" | "bom") ?? "ingredient", componentId: row.componentId, quantity: Number(row.quantity ?? 1), unit: row.unit ?? "pz" }]),
        );
      }

      const overridesByOptionId = new Map<string, Array<{ ingredientId: string; action: string }>>();
      if (modifierOptionIds.size > 0) {
        const overrideRows = await tx
          .select()
          .from(menuModifierOptionOverrides)
          .where(
            and(
              eq(menuModifierOptionOverrides.tenantId, tenantId),
              inArray(menuModifierOptionOverrides.optionId, [...modifierOptionIds]),
            ),
          );
        for (const row of overrideRows) {
          const existing = overridesByOptionId.get(row.optionId) ?? [];
          existing.push({ ingredientId: row.ingredientId, action: row.action });
          overridesByOptionId.set(row.optionId, existing);
        }
      }

      const enabledModules = await this.getEnabledModulesRows(tenantId);
      const enforceRecipe = enabledModules.includes("inventory") && !enabledModules.includes("simple_catalog");

      const modifierBomIds = [
        ...[...modifierOptionsByOptionId.values()].filter((option) => option.componentType === "bom").map((option) => option.componentId),
        ...[...poolOptionsByOptionId.values()].filter((option) => option.componentType === "bom").map((option) => option.componentId),
      ];
      const bomIds = [...new Set(canonicalComponents
        .filter((component) => component.componentType === "bom")
        .map((component) => component.componentId)
        .concat(modifierBomIds.filter((id): id is string => Boolean(id))))];
      let bomRows: BomRow[] = [];
      let bomComponentRows: BomComponentRow[] = [];

      if (bomIds.length > 0) {
        // Fetch BOMs and components, then recursively fetch any nested BOMs
        const visitedBomIds = new Set<string>();
        const pendingBomIds = [...bomIds];

        while (pendingBomIds.length > 0) {
          const batch = pendingBomIds.splice(0);
          for (const id of batch) visitedBomIds.add(id);

          const [rows, componentRows] = await Promise.all([
            tx.select().from(bomItems).where(and(eq(bomItems.tenantId, tenantId), inArray(bomItems.id, batch))),
            tx.select().from(bomComponents).where(and(eq(bomComponents.tenantId, tenantId), inArray(bomComponents.bomId, batch))),
          ]);

          bomRows.push(...rows);
          bomComponentRows.push(...componentRows);

          // Discover nested BOM references
          for (const comp of componentRows) {
            if (comp.componentType === "bom" && !visitedBomIds.has(comp.componentId)) {
              pendingBomIds.push(comp.componentId);
            }
          }
        }
      }

      const canonicalIngredientsByMenuId = new Map<string, Array<{ ingredientId: string; quantity: number }>>();
      const canonicalPrepsByMenuId = new Map<string, Array<{ prepItemId: string; quantity: number }>>();
      const canonicalBomsByMenuId = new Map<string, Array<{ bomId: string; quantity: number }>>();
      for (const component of canonicalComponents) {
        if (component.componentType === "ingredient") {
          const existing = canonicalIngredientsByMenuId.get(component.menuItemId) ?? [];
          existing.push({ ingredientId: component.componentId, quantity: Number(component.quantity) });
          canonicalIngredientsByMenuId.set(component.menuItemId, existing);
        } else if (component.componentType === "prep") {
          const existing = canonicalPrepsByMenuId.get(component.menuItemId) ?? [];
          existing.push({ prepItemId: component.componentId, quantity: Number(component.quantity) });
          canonicalPrepsByMenuId.set(component.menuItemId, existing);
        } else if (component.componentType === "bom") {
          const existing = canonicalBomsByMenuId.get(component.menuItemId) ?? [];
          existing.push({ bomId: component.componentId, quantity: Number(component.quantity) });
          canonicalBomsByMenuId.set(component.menuItemId, existing);
        }
      }

      const consumptionByIngredient = new Map<string, number>();
      const consumptionByPrep = new Map<string, number>();
      const bomById = new Map<string, BomRow>(bomRows.map((row) => [row.id, row]));
      const bomComponentsById = new Map<string, BomComponentRow[]>();
      for (const component of bomComponentRows) {
        const existing = bomComponentsById.get(component.bomId) ?? [];
        existing.push(component);
        bomComponentsById.set(component.bomId, existing);
      }
      const modifierPrepRows = await tx
        .select({ id: prepItems.id, outputUnit: prepItems.outputUnit })
        .from(prepItems)
        .where(eq(prepItems.tenantId, tenantId));
      const modifierPrepUnitById = new Map(modifierPrepRows.map((row) => [row.id, row.outputUnit]));
      const inventoryRowsForValidation = await tx.select().from(inventory).where(eq(inventory.tenantId, tenantId));
      const inventoryNameById = new Map(inventoryRowsForValidation.map((row) => [row.id, row.name]));
      const inventoryUnitById = new Map(inventoryRowsForValidation.map((row) => [row.id, row.unit as string]));
      const untrackedIngredientIds = new Set(
        inventoryRowsForValidation.filter((row) => row.isStockTracked === 0).map((row) => row.id),
      );

      const conversionRows = await tx
        .select()
        .from(inventoryUnitConversions)
        .where(eq(inventoryUnitConversions.tenantId, tenantId));
      const conversionsByInventoryId = new Map<string, Array<{ fromUnit: string; toUnit: string; factor: number }>>();
      for (const row of conversionRows) {
        const existing = conversionsByInventoryId.get(row.inventoryId) ?? [];
        existing.push({ fromUnit: row.fromUnit, toUnit: row.toUnit, factor: Number(row.factor) });
        conversionsByInventoryId.set(row.inventoryId, existing);
      }

      for (const item of order.items) {
        const baseIngredients = canonicalIngredientsByMenuId.get(item.id) ?? [];
        const removedIngredientIds = new Set(
          (item.ingredientOverrides ?? []).filter((entry) => entry.action === "remove").map((entry) => entry.ingredientId),
        );
        const addedIngredientIds = (item.ingredientOverrides ?? [])
          .filter((entry) => entry.action === "add")
          .map((entry) => entry.ingredientId);

        for (const ingredientId of addedIngredientIds) {
          // Added pool options can reference a prep (componentId) or an
          // inventory ingredient. Route prep adds to the prep consumption map
          // (one unit in the prep's own output unit); ingredient adds resolve
          // the custom pz→unit conversion so we never scale raw kg per add.
          if (modifierPrepUnitById.has(ingredientId)) {
            const current = consumptionByPrep.get(ingredientId) ?? 0;
            consumptionByPrep.set(ingredientId, current + 1 * item.quantity);
            continue;
          }
          if (!inventoryNameById.has(ingredientId)) {
            const menuName = menuNameById.get(item.id) ?? item.name;
            throw new Error(`Ingredient ${ingredientId} not found in inventory (added to "${menuName}")`);
          }
          const ingredientUnit = inventoryUnitById.get(ingredientId) ?? "kg";
          const conversions = conversionsByInventoryId.get(ingredientId) ?? [];
          const conv = conversions.find((c) => c.fromUnit === "pz" && c.toUnit === ingredientUnit);
          const addQty = conv ? 1 * conv.factor : 1;
          const current = consumptionByIngredient.get(ingredientId) ?? 0;
          consumptionByIngredient.set(ingredientId, current + addQty * item.quantity);
        }

        for (const { ingredientId, quantity } of baseIngredients) {
          if (removedIngredientIds.has(ingredientId)) {
            continue;
          }
          const current = consumptionByIngredient.get(ingredientId) ?? 0;
          consumptionByIngredient.set(ingredientId, current + quantity * item.quantity);
        }

        for (const mod of item.selectedModifiers ?? []) {
          const modOption = modifierOptionsByOptionId.get(mod.optionId);
          const poolOption = poolOptionsByOptionId.get(mod.optionId);
          const componentType = modOption?.componentType ?? poolOption?.componentType ?? "ingredient";
          const componentId = modOption?.componentId ?? poolOption?.componentId ?? modOption?.inventoryItemId ?? poolOption?.inventoryItemId;
          const modQuantity = modOption?.quantity ?? poolOption?.quantity ?? 1;
          const modUnit = modOption?.unit ?? poolOption?.unit ?? "pz";

          if (componentId && componentType === "ingredient") {
            const ingredientUnit = inventoryUnitById.get(componentId) ?? "kg";
            let consumedQty: number;
            if (modUnit === ingredientUnit) {
              consumedQty = modQuantity;
            } else {
              const conversions = conversionsByInventoryId.get(componentId) ?? [];
              const conv = conversions.find((c) => c.fromUnit === modUnit && c.toUnit === ingredientUnit);
              consumedQty = conv ? modQuantity * conv.factor : modQuantity;
            }
            const current = consumptionByIngredient.get(componentId) ?? 0;
            consumptionByIngredient.set(componentId, current + consumedQty * item.quantity);
          } else if (componentId && componentType === "prep") {
            if (!removedIngredientIds.has(componentId)) {
              const prepUnit = modifierPrepUnitById.get(componentId) ?? modUnit;
              const consumedQty = convertUnit(modQuantity, modUnit, prepUnit) ?? modQuantity;
              const current = consumptionByPrep.get(componentId) ?? 0;
              consumptionByPrep.set(componentId, current + consumedQty * item.quantity);
            }
          } else if (componentId && componentType === "bom") {
            const bomUnit = bomById.get(componentId)?.outputUnit ?? modUnit;
            const consumedQty = convertUnit(modQuantity, modUnit, bomUnit) ?? modQuantity;
            const exploded = this.explodeBomRequirements({
              bomId: componentId,
              multiplier: consumedQty * item.quantity,
              bomById,
              componentsByBomId: bomComponentsById,
            });
            for (const [ingredientId, qty] of exploded.ingredients) {
              consumptionByIngredient.set(ingredientId, (consumptionByIngredient.get(ingredientId) ?? 0) + qty);
            }
            for (const [prepId, qty] of exploded.preps) {
              if (removedIngredientIds.has(prepId)) continue;
              consumptionByPrep.set(prepId, (consumptionByPrep.get(prepId) ?? 0) + qty);
            }
          }

          const overrides = overridesByOptionId.get(mod.optionId) ?? [];
          for (const override of overrides) {
            if (override.action === "add") {
              const current = consumptionByIngredient.get(override.ingredientId) ?? 0;
              consumptionByIngredient.set(override.ingredientId, current + 1 * item.quantity);
            } else if (override.action === "remove") {
              consumptionByIngredient.delete(override.ingredientId);
              consumptionByPrep.delete(override.ingredientId);
            }
          }
        }

        const prepReqs = canonicalPrepsByMenuId.get(item.id) ?? [];
        for (const req of prepReqs) {
          if (removedIngredientIds.has(req.prepItemId)) continue;
          const current = consumptionByPrep.get(req.prepItemId) ?? 0;
          consumptionByPrep.set(req.prepItemId, current + req.quantity * item.quantity);
        }
      }

      const bomByMenuId = new Map<string, Array<{ bomId: string; quantity: number }>>();
      for (const requirement of canonicalComponents) {
        if (requirement.componentType !== "bom") continue;
        const existing = bomByMenuId.get(requirement.menuItemId) ?? [];
        existing.push({ bomId: requirement.componentId, quantity: toNumeric(requirement.quantity) });
        bomByMenuId.set(requirement.menuItemId, existing);
      }

      for (const item of order.items) {
        const removedIngredientIds = new Set(
          (item.ingredientOverrides ?? []).filter((entry) => entry.action === "remove").map((entry) => entry.ingredientId),
        );
        const requirements = bomByMenuId.get(item.id) ?? [];
        for (const requirement of requirements) {
          const exploded = this.explodeBomRequirements({
            bomId: requirement.bomId,
            multiplier: requirement.quantity * item.quantity,
            bomById,
            componentsByBomId: bomComponentsById,
          });

          for (const [ingredientId, qty] of exploded.ingredients) {
            consumptionByIngredient.set(ingredientId, (consumptionByIngredient.get(ingredientId) ?? 0) + qty);
          }
          for (const [prepId, qty] of exploded.preps) {
            if (removedIngredientIds.has(prepId)) continue;
            consumptionByPrep.set(prepId, (consumptionByPrep.get(prepId) ?? 0) + qty);
          }
        }
      }

      const menuNamesByIngredientId = new Map<string, Set<string>>();
      const menuNamesByPrepId = new Map<string, Set<string>>();
      for (const item of order.items) {
        const menuName = menuNameById.get(item.id) ?? item.name;
        const baseIngredients = canonicalIngredientsByMenuId.get(item.id) ?? [];
        for (const { ingredientId } of baseIngredients) {
          const existing = menuNamesByIngredientId.get(ingredientId) ?? new Set();
          existing.add(menuName);
          menuNamesByIngredientId.set(ingredientId, existing);
        }
        const requirements = bomByMenuId.get(item.id) ?? [];
        for (const requirement of requirements) {
          const exploded = this.explodeBomRequirements({
            bomId: requirement.bomId,
            multiplier: requirement.quantity * item.quantity,
            bomById,
            componentsByBomId: bomComponentsById,
          });
          for (const ingredientId of exploded.ingredients.keys()) {
            const existing = menuNamesByIngredientId.get(ingredientId) ?? new Set();
            existing.add(menuName);
            menuNamesByIngredientId.set(ingredientId, existing);
          }
          for (const prepId of exploded.preps.keys()) {
            const existing = menuNamesByPrepId.get(prepId) ?? new Set();
            existing.add(menuName);
            menuNamesByPrepId.set(prepId, existing);
          }
        }
        const prepReqs = canonicalPrepsByMenuId.get(item.id) ?? [];
        for (const req of prepReqs) {
          const existing = menuNamesByPrepId.get(req.prepItemId) ?? new Set();
          existing.add(menuName);
          menuNamesByPrepId.set(req.prepItemId, existing);
        }
      }

      const ingredientIds = [...consumptionByIngredient.keys()];
      if (ingredientIds.length > 0) {
        const inventoryRows = await tx
          .select()
          .from(inventory)
          .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, ingredientIds)))
          .for("update");

        const inventoryMap = new Map(inventoryRows.map((r) => [r.id, r]));

        for (const [ingredientId, consumed] of consumptionByIngredient) {
          if (untrackedIngredientIds.has(ingredientId)) continue;
          const row = inventoryMap.get(ingredientId);
          const ingredientName = row?.name ?? ingredientId;
          const usedBy = [...(menuNamesByIngredientId.get(ingredientId) ?? [])].join(", ");
          const suffix = usedBy ? ` (used by: ${usedBy})` : "";
          if (row && row.isActive !== 1) {
            throw new Error(`Ingredient "${ingredientName}" is not active${suffix}`);
          }
          const currentQty = Number(row?.quantity ?? 0);
          if (currentQty < consumed) {
            throw new Error(
              `Insufficient stock for "${ingredientName}": required ${consumed.toFixed(3)}, available ${currentQty.toFixed(3)}${suffix}`,
            );
          }
        }

        const inventoryUpdates: Array<{ ingredientId: string; newQty: number; currentQty: number; consumed: number }> = [];
        for (const [ingredientId, consumed] of consumptionByIngredient) {
          if (untrackedIngredientIds.has(ingredientId)) continue;
          const row = inventoryMap.get(ingredientId)!;
          const currentQty = Number(row.quantity);
          const newQty = currentQty - consumed;
          inventoryUpdates.push({ ingredientId, newQty, currentQty, consumed });
        }

        if (inventoryUpdates.length > 0) {
          await Promise.all(inventoryUpdates.map((u) =>
            tx.update(inventory)
              .set({ quantity: String(u.newQty) })
              .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, u.ingredientId)))
          ));

          await tx.insert(stockMovements).values(inventoryUpdates.map((u) => ({
            id: crypto.randomUUID(),
            tenantId,
            ingredientId: u.ingredientId,
            prepItemId: null,
            orderId: order.id,
            movementType: "order_deduction" as const,
            quantity: String(-u.consumed),
            previousQuantity: String(u.currentQty),
            newQuantity: String(u.newQty),
            notes: `Order ${order.id}`,
            staffId: order.staffId ?? null,
          })));
        }
      }

      const canonicalPrepIds = [...new Set(canonicalComponents
        .filter((component) => component.componentType === "prep")
        .map((component) => component.componentId))];
      const canonicalPrepRows = canonicalPrepIds.length > 0
        ? await tx.select({ id: prepItems.id, outputUnit: prepItems.outputUnit })
            .from(prepItems)
            .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, canonicalPrepIds)))
        : [];
      const canonicalPrepUnitById = new Map(canonicalPrepRows.map((row) => [row.id, row.outputUnit]));
      const canonicalBomUnitById = new Map(bomRows.map((row) => [row.id, row.outputUnit]));

      const canonicalImpactRows = insertedOrderItems.flatMap((insertedItem, itemIndex) => {
        const source = canonicalComponents.filter((component) => component.menuItemId === insertedItem.menuItemId);
        // Keep the returned row paired with its original input position. Using
        // find(menuItemId) is incorrect when an order contains the same menu
        // item on more than one line with different quantities.
        const itemQuantity = order.items[itemIndex]?.quantity ?? 0;
        return source.map((component) => ({
          id: crypto.randomUUID(),
          tenantId,
          orderId: order.id,
          orderItemId: insertedItem.id,
          componentType: component.componentType,
          componentId: component.componentId,
          quantity: String(Number(component.quantity) * itemQuantity),
          unit: component.componentType === "ingredient"
            ? (inventoryRowsForValidation.find((row) => row.id === component.componentId)?.unit ?? "")
            : component.componentType === "prep"
              ? (canonicalPrepUnitById.get(component.componentId) ?? "")
              : (canonicalBomUnitById.get(component.componentId) ?? ""),
        }));
      }).filter((impact) => Number(impact.quantity) > 0 && impact.unit.length > 0
        && !(impact.componentType === "ingredient" && untrackedIngredientIds.has(impact.componentId)));
      if (canonicalImpactRows.length > 0) {
        await tx.insert(orderStockImpacts).values(canonicalImpactRows);
      }

      const prepIds = [...consumptionByPrep.keys()];
      if (prepIds.length > 0) {
        const prepRows = await tx
          .select()
          .from(prepItems)
          .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, prepIds)))
          .for("update");

        const prepMap = new Map(prepRows.map((r) => [r.id, r]));

        for (const [prepId, consumed] of consumptionByPrep) {
          const row = prepMap.get(prepId);
          const prepName = row?.name ?? prepId;
          const usedBy = [...(menuNamesByPrepId.get(prepId) ?? [])].join(", ");
          const suffix = usedBy ? ` (used by: ${usedBy})` : "";
          const currentQty = Number(row?.stockQuantity ?? 0);
          if (currentQty < consumed) {
            throw new Error(
              `Insufficient prep item "${prepName}": required ${consumed.toFixed(3)}, available ${currentQty.toFixed(3)}${suffix}`,
            );
          }
        }

        const prepUpdates: Array<{ prepId: string; newQty: number; currentQty: number; consumed: number }> = [];
        for (const [prepId, consumed] of consumptionByPrep) {
          const row = prepMap.get(prepId)!;
          const currentQty = Number(row.stockQuantity);
          const newQty = currentQty - consumed;
          prepUpdates.push({ prepId, newQty, currentQty, consumed });
        }

        if (prepUpdates.length > 0) {
          await Promise.all(prepUpdates.map((u) =>
            tx.update(prepItems)
              .set({ stockQuantity: String(u.newQty) })
              .where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, u.prepId)))
          ));

          await tx.insert(stockMovements).values(prepUpdates.map((u) => ({
            id: crypto.randomUUID(),
            tenantId,
            ingredientId: null,
            prepItemId: u.prepId,
            orderId: order.id,
            movementType: "prep_consumption" as const,
            quantity: String(-u.consumed),
            previousQuantity: String(u.currentQty),
            newQuantity: String(u.newQty),
            notes: `Order ${order.id}`,
            staffId: order.staffId ?? null,
          })));
        }
      }

      const inventoryRows = await tx.select().from(inventory).where(eq(inventory.tenantId, tenantId));

      if (order.orderType === "takeaway" && order.customerId) {
        await tx
          .update(customers)
          .set({
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(customers.tenantId, tenantId), eq(customers.id, order.customerId)));
      }

      return inventoryRows.map((row) => ({
        id: row.id,
        name: row.name,
        quantity: Number(row.quantity),
        unit: row.unit,
        minThreshold: Number(row.minThreshold),
        categoryId: row.categoryId ?? undefined,
        unitCost: Number(row.unitCost ?? 0),
        salePrice: row.salePrice != null ? Number(row.salePrice) : null,
        isActive: row.isActive === 1,
        isStockTracked: row.isStockTracked == null || row.isStockTracked === 1,
      }));
    });

    await this.createPrintJobsForOrder(order);

    return { order, inventory: updatedInventory };
  }

  async updateOrderItemQuantity(orderId: string, orderItemId: number, quantity: number): Promise<Order | null> {
    const tenantId = getTenantIdOrDefault();

    await withTenantTx(async (tx) => {
      const orderRows = await tx
        .select({ id: orders.id, status: orders.status, staffId: orders.staffId, total: orders.total })
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)))
        .limit(1)
        .for("update");
      const order = orderRows[0];
      if (!order) return;
      if (order.status === "paid" || order.status === "cancelled") {
        throw new Error(`Cannot change quantity for a ${order.status} order`);
      }

      const itemRows = await tx
        .select({ id: orderItems.id, menuItemId: orderItems.menuItemId, quantity: orderItems.quantity, price: orderItems.price })
        .from(orderItems)
        .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, orderId), eq(orderItems.id, orderItemId)))
        .for("update");
      const item = itemRows[0];
      if (!item) return;

      const impacts = await tx
        .select()
        .from(orderStockImpacts)
        .where(and(
          eq(orderStockImpacts.tenantId, tenantId),
          eq(orderStockImpacts.orderId, orderId),
          eq(orderStockImpacts.orderItemId, orderItemId),
        ))
        .for("update");

      if (impacts.length === 0) {
        throw new Error("Quantity editing is available only for menu items with persisted canonical stock impacts");
      }

      const deltaByComponent = new Map<string, { componentType: string; componentId: string; delta: number; unit: string }>();
      for (const impact of impacts) {
        const oldQuantity = Number(impact.quantity);
        const unitQuantity = oldQuantity / item.quantity;
        const nextQuantity = unitQuantity * quantity;
        const key = `${impact.componentType}:${impact.componentId}`;
        const existing = deltaByComponent.get(key);
        if (existing) {
          existing.delta += nextQuantity - oldQuantity;
        } else {
          deltaByComponent.set(key, {
            componentType: impact.componentType,
            componentId: impact.componentId,
            delta: nextQuantity - oldQuantity,
            unit: impact.unit,
          });
        }
      }

      const ingredientDeltas = [...deltaByComponent.values()].filter((entry) => entry.componentType === "ingredient" && entry.delta !== 0);
      const prepDeltas = [...deltaByComponent.values()].filter((entry) => entry.componentType === "prep" && entry.delta !== 0);

      if (ingredientDeltas.length > 0) {
        const rows = await tx
          .select()
          .from(inventory)
          .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, ingredientDeltas.map((entry) => entry.componentId))))
          .for("update");
        const rowsById = new Map(rows.map((row) => [row.id, row]));
        for (const entry of ingredientDeltas) {
          const row = rowsById.get(entry.componentId);
          if (!row) throw new Error(`Ingredient ${entry.componentId} not found`);
          if (row.isActive !== 1) throw new Error(`Ingredient "${row.name}" is not active`);
          const currentQuantity = Number(row.quantity);
          const nextQuantity = currentQuantity - entry.delta;
          if (nextQuantity < 0) {
            throw new Error(`Insufficient stock for ingredient "${row.name}"`);
          }
          await tx.update(inventory)
            .set({ quantity: String(nextQuantity) })
            .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, row.id)));
          await tx.insert(stockMovements).values({
            id: crypto.randomUUID(),
            tenantId,
            ingredientId: row.id,
            prepItemId: null,
            orderId,
            movementType: entry.delta > 0 ? "order_deduction" : "order_reversal",
            quantity: String(-entry.delta),
            previousQuantity: String(currentQuantity),
            newQuantity: String(nextQuantity),
            notes: `Order item quantity updated: ${orderId}`,
            staffId: order.staffId ?? null,
          });
        }
      }

      if (prepDeltas.length > 0) {
        const rows = await tx
          .select()
          .from(prepItems)
          .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, prepDeltas.map((entry) => entry.componentId))))
          .for("update");
        const rowsById = new Map(rows.map((row) => [row.id, row]));
        for (const entry of prepDeltas) {
          const row = rowsById.get(entry.componentId);
          if (!row) throw new Error(`Prep item ${entry.componentId} not found`);
          const currentQuantity = Number(row.stockQuantity);
          const nextQuantity = currentQuantity - entry.delta;
          if (nextQuantity < 0) {
            throw new Error(`Insufficient stock for prep "${row.name}"`);
          }
          await tx.update(prepItems)
            .set({ stockQuantity: String(nextQuantity) })
            .where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, row.id)));
          await tx.insert(stockMovements).values({
            id: crypto.randomUUID(),
            tenantId,
            ingredientId: null,
            prepItemId: row.id,
            orderId,
            movementType: entry.delta > 0 ? "prep_consumption" : "prep_restoration",
            quantity: String(-entry.delta),
            previousQuantity: String(currentQuantity),
            newQuantity: String(nextQuantity),
            notes: `Order item quantity updated: ${orderId}`,
            staffId: order.staffId ?? null,
          });
        }
      }

      if (quantity === 0) {
        await tx
          .delete(orderItems)
          .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, orderId), eq(orderItems.id, orderItemId)));
      } else {
        await tx
          .update(orderItems)
          .set({ quantity })
          .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, orderId), eq(orderItems.id, orderItemId)));
      }

      await tx
        .update(orders)
        .set({ total: String(Number(order.total) + (quantity - item.quantity) * Number(item.price)) })
        .where(and(eq(orders.tenantId, tenantId), eq(orders.id, orderId)));

      if (impacts.length > 0 && quantity > 0) {
        await tx
          .delete(orderStockImpacts)
          .where(and(
            eq(orderStockImpacts.tenantId, tenantId),
            eq(orderStockImpacts.orderId, orderId),
            eq(orderStockImpacts.orderItemId, orderItemId),
          ));

        const replacementImpacts = impacts
          .map((impact) => ({
            id: crypto.randomUUID(),
            tenantId,
            orderId,
            orderItemId,
            componentType: impact.componentType,
            componentId: impact.componentId,
            quantity: String((Number(impact.quantity) / item.quantity) * quantity),
            unit: impact.unit,
          }))
          .filter((impact) => Number(impact.quantity) > 0);
        if (replacementImpacts.length > 0) {
          await tx.insert(orderStockImpacts).values(replacementImpacts);
        }
      }
    });

    return this.getOrderById(orderId);
  }

  async updateOrder(id: string, payload: UpdateOrderRequest): Promise<Order | null> {
    const tenantId = getTenantIdOrDefault();
    const parsed = updateOrderRequestSchema.parse(payload);
    if (!parsed.status) {
      return this.getOrderById(id);
    }
    if (parsed.status === "paid") {
      throw new Error("Order status 'paid' can be set only through checkout/split payment flows");
    }

    const currentRows = await db
      .select({ status: orders.status })
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
      .limit(1);
    const current = currentRows[0];
    if (!current) {
      return null;
    }
    assertOrderStatusTransition(current.status as OrderStatus, parsed.status);

    const updated = await db
      .update(orders)
      .set({ status: parsed.status })
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
      .returning({ id: orders.id });

    if (updated.length === 0) {
      return null;
    }

    return this.getOrderById(id);
  }

  async voidOrder(id: string, payload: VoidOrderRequest, actorStaffId: string): Promise<VoidOrderResponse | null> {
    const parsed = voidOrderRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    return withTenantTx(async (tx) => {
      const orderRows = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
        .limit(1);
      const order = orderRows[0];
      if (!order) {
        return null;
      }

      if (order.status === "paid") {
        throw new Error("Cannot cancel a paid order");
      }

      if (order.status === "cancelled") {
        throw new Error("Order already cancelled");
      }

      const itemRows = await tx
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, id)));

      const persistedCanonicalImpacts = await tx
        .select()
        .from(orderStockImpacts)
        .where(and(eq(orderStockImpacts.tenantId, tenantId), eq(orderStockImpacts.orderId, id)));
      const canonicalIngredientRestores = new Map<string, number>();
      const canonicalPrepRestores = new Map<string, number>();
      for (const impact of persistedCanonicalImpacts) {
        if (impact.componentType === "ingredient") {
          canonicalIngredientRestores.set(impact.componentId, (canonicalIngredientRestores.get(impact.componentId) ?? 0) + Number(impact.quantity));
        } else if (impact.componentType === "prep") {
          canonicalPrepRestores.set(impact.componentId, (canonicalPrepRestores.get(impact.componentId) ?? 0) + Number(impact.quantity));
        }
      }

      if (canonicalIngredientRestores.size > 0) {
        const rows = await tx.select().from(inventory)
          .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, [...canonicalIngredientRestores.keys()])))
          .for("update");
        const rowsById = new Map(rows.map((row) => [row.id, row]));
        for (const [ingredientId, delta] of canonicalIngredientRestores) {
          const row = rowsById.get(ingredientId);
          if (!row) continue;
          const previousQty = Number(row.quantity);
          const restoredQty = previousQty + delta;
          await tx.update(inventory)
            .set({ quantity: String(restoredQty) })
            .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, ingredientId)));
          await tx.insert(stockMovements).values({
            id: crypto.randomUUID(),
            tenantId,
            ingredientId,
            prepItemId: null,
            orderId: id,
            movementType: "order_reversal",
            quantity: String(delta),
            previousQuantity: String(previousQty),
            newQuantity: String(restoredQty),
            notes: `Order cancelled: ${parsed.reason}`,
            staffId: actorStaffId,
          });
        }
      }

      if (canonicalPrepRestores.size > 0) {
        const rows = await tx.select().from(prepItems)
          .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, [...canonicalPrepRestores.keys()])))
          .for("update");
        const rowsById = new Map(rows.map((row) => [row.id, row]));
        for (const [prepId, delta] of canonicalPrepRestores) {
          const row = rowsById.get(prepId);
          if (!row) continue;
          const previousQty = Number(row.stockQuantity);
          const restoredQty = previousQty + delta;
          await tx.update(prepItems)
            .set({ stockQuantity: String(restoredQty) })
            .where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, prepId)));
          await tx.insert(stockMovements).values({
            id: crypto.randomUUID(),
            tenantId,
            ingredientId: null,
            prepItemId: prepId,
            orderId: id,
            movementType: "prep_restoration",
            quantity: String(delta),
            previousQuantity: String(previousQty),
            newQuantity: String(restoredQty),
            notes: `Order cancelled: ${parsed.reason}`,
            staffId: actorStaffId,
          });
        }
      }

      await tx
        .update(orders)
        .set({
          status: "cancelled",
          cancelReason: parsed.reason,
          cancelledByStaffId: actorStaffId,
        })
        .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)));

      const cancelled = orderSchema.parse({
        id: order.id,
        orderType: orderTypeSchema.parse(order.orderType as OrderType),
        table: order.tableNumber ?? undefined,
        ticketNumber: order.ticketNumber ?? undefined,
        customerName: order.customerName ?? undefined,
        customerId: order.customerId ?? undefined,
        items: itemRows.map((item) => ({
          id: item.menuItemId,
          orderItemId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: item.quantity,
          ingredientOverrides: parseIngredientOverrides(item.ingredientOverrides),
          selectedModifiers: parseSelectedModifiers(item.selectedModifiers),
        })),
        total: Number(order.total),
        status: "cancelled",
        timestamp: order.timestamp.toISOString(),
        staffId: order.staffId,
      });

      return voidOrderResponseSchema.parse({
        success: true,
        order: cancelled,
      });
    });
  }

  async getOrderByIdPublic(id: string): Promise<Order | null> {
    return this.getOrderById(id);
  }

  async listOrderHistory(filters: OrderHistoryFilters): Promise<Order[]> {
    const parsed = orderHistoryFiltersSchema.parse(filters);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [];

    conditions.push(eq(orders.tenantId, tenantId));

    if (parsed.from) {
      conditions.push(gte(orders.timestamp, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(orders.timestamp, new Date(parsed.to)));
    }
    if (parsed.status) {
      conditions.push(eq(orders.status, parsed.status));
    }
    if (parsed.orderType) {
      conditions.push(eq(orders.orderType, parsed.orderType));
    }
    if (parsed.staffId) {
      conditions.push(eq(orders.staffId, parsed.staffId));
    }
    if (parsed.table) {
      conditions.push(eq(orders.tableNumber, parsed.table));
    }
    if (parsed.customerId) {
      conditions.push(eq(orders.customerId, parsed.customerId));
    }

    const baseQuery = db
      .select()
      .from(orders)
      .orderBy(desc(orders.timestamp))
      .limit(parsed.limit ?? 200);

    const rows = conditions.length > 0 ? await baseQuery.where(and(...conditions)) : await baseQuery;
    const orderIds = rows.map((row) => row.id);
    const itemRows =
      orderIds.length > 0
        ? await db
            .select()
            .from(orderItems)
            .where(and(eq(orderItems.tenantId, tenantId), inArray(orderItems.orderId, orderIds)))
        : [];
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
        selectedModifiers: parseSelectedModifiers(item.selectedModifiers),
      });
      itemsByOrderId.set(item.orderId, existing);
    }

    return orderHistoryListResponseSchema.parse(
      rows.map((row) => ({
        id: row.id,
        orderType: orderTypeSchema.parse(row.orderType as OrderType),
        table: row.tableNumber ?? undefined,
        ticketNumber: row.ticketNumber ?? undefined,
        customerName: row.customerName ?? undefined,
        customerId: row.customerId ?? undefined,
        items: itemsByOrderId.get(row.id) ?? [],
        total: Number(row.total),
        status: row.status,
        timestamp: row.timestamp.toISOString(),
        staffId: row.staffId,
      })),
    );
  }

  async getCategoryById(id: string): Promise<Category | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapCategoryRow(rows[0]);
  }

  private async getOrderById(id: string): Promise<Order | null> {
    const tenantId = getTenantIdOrDefault();
    const [orderRow] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.id, id)))
      .limit(1);
    if (!orderRow) {
      return null;
    }

    const itemRows = await db
      .select()
      .from(orderItems)
      .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, id)));
    return orderSchema.parse({
      id: orderRow.id,
      orderType: orderTypeSchema.parse(orderRow.orderType as OrderType),
      table: orderRow.tableNumber ?? undefined,
      ticketNumber: orderRow.ticketNumber ?? undefined,
      customerName: orderRow.customerName ?? undefined,
      customerId: orderRow.customerId ?? undefined,
      items: itemRows.map((item) => ({
        id: item.menuItemId,
        orderItemId: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: item.quantity,
        ingredientOverrides: parseIngredientOverrides(item.ingredientOverrides),
        selectedModifiers: parseSelectedModifiers(item.selectedModifiers),
      })),
      total: Number(orderRow.total),
      status: orderRow.status,
      timestamp: orderRow.timestamp.toISOString(),
      staffId: orderRow.staffId,
    });
  }

  async getReorderSuggestions(): Promise<Array<{
    ingredientId: string;
    name: string;
    sku: string | null;
    currentQty: number;
    minThreshold: number;
    unit: string;
    deficit: number;
    preferredSupplierName?: string;
    lastUnitCost?: number;
  }>> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select({
        id: inventory.id,
        name: inventory.name,
        sku: inventory.sku,
        quantity: inventory.quantity,
        minThreshold: inventory.minThreshold,
        unit: inventory.unit,
        unitCost: inventory.unitCost,
        supplierName: suppliers.name,
      })
      .from(inventory)
      .leftJoin(supplierIngredients, and(
        eq(supplierIngredients.ingredientId, inventory.id),
        eq(supplierIngredients.isPreferred, 1),
      ))
      .leftJoin(suppliers, eq(suppliers.id, supplierIngredients.supplierId))
      .where(and(
        eq(inventory.tenantId, tenantId),
        eq(inventory.isActive, 1),
        lte(inventory.quantity, inventory.minThreshold),
      ));

    return rows.map((r) => ({
      ingredientId: r.id,
      name: r.name,
      sku: r.sku,
      currentQty: Number(r.quantity),
      minThreshold: Number(r.minThreshold),
      unit: r.unit,
      deficit: Number(r.minThreshold) - Number(r.quantity),
      preferredSupplierName: r.supplierName ?? undefined,
      lastUnitCost: r.unitCost != null ? Number(r.unitCost) : undefined,
    }));
  }

  async testPrintFromBridge(bridgeId: string, area: PrintArea, message?: string): Promise<{ jobId: string; bridgeId: string; area: PrintArea; orderId: string }> {
    const tenantId = this.currentTenantId();

    // Validate the bridge exists and has claimed this area.
    const bridgeRow = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)),
    });
    if (!bridgeRow) throw new Error(`Bridge ${bridgeId} not found`);

    // Build ESC/POS receipt for a "test stampa" using the existing EscPosBuilder.
    const now = new Date();
    const ep = new EscPosBuilder();
    ep.init();
    ep.align("center").doubleSize(true).bold(true).line("*** GUSTOPOS ***").doubleSize(false).bold(false);
    ep.line("TEST STAMPA").line();
    ep.line(`Bridge: ${bridgeRow.name}${bridgeRow.host ? ` @ ${bridgeRow.host}` : ""}`);
    ep.line(`Area: ${area.toUpperCase()}`);
    if (message) ep.line(`Note: ${message}`);
    ep.line(`Quando: ${now.toLocaleString("it-IT")}`);
    ep.line(`Job ID: (assegnato dopo claim)`);
    ep.line();
    ep.line("Se leggi questo messaggio,");
    ep.line("la pipeline Phase B funziona:");
    ep.line("API -> claim bridge -> payload ESC/POS");
    ep.line("-> QZ Tray sul bridge PC.");
    ep.line();
    ep.cut();

    const jobId = `pj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const orderId = `TEST_${Date.now().toString(36)}`;

    await withTenantTx(async (tx) => {
      await tx.insert(printJobs).values({
        id: jobId,
        tenantId,
        orderId,
        area,
        bridgeId,
        protocol: "escpos",
        status: "pending",
        // Persist the encoded ESC/POS bytes built above. The previous
        // diagnostic string was not printable data, although the job could
        // still be acknowledged as completed by the transport.
        payload: ep.build(),
        error: null,
        createdAt: now,
        updatedAt: now,
        dispatchedAt: null,
      });
    });

    return { jobId, bridgeId, area, orderId };
  }

  constructor(
    @Inject(StaffRepository) private readonly staffRepo: StaffRepository,
    @Inject(ShiftsRepository) private readonly shiftsRepo: ShiftsRepository,
    @Inject(SuppliersRepository) private readonly suppliersRepo: SuppliersRepository,
    @Inject(InventoryRepository) private readonly inventoryRepo: InventoryRepository,
    @Inject(TablesRepository) private readonly tablesRepo: TablesRepository,
    @Inject(ConsumerRepository) private readonly consumerRepo: ConsumerRepository,
    @Inject(CustomerRepository) private readonly customerRepo: CustomerRepository,
    @Inject(PaymentsRepository) private readonly paymentsRepo: PaymentsRepository,
    @Inject(PrintJobsRepository) private readonly printJobsRepo: PrintJobsRepository,
  ) {}
}
