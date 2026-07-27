import { z } from "zod";
import {
  appDataSchema,
  bomCreateRequestSchema,
  bomItemSchema,
  bomUpdateRequestSchema,
  bomUpsertComponentsRequestSchema,
  bomAddComponentRequestSchema,
  bomRemoveComponentRequestSchema,
  createOrderRequestSchema,
  ingredientCreateRequestSchema,
  ingredientUpdateRequestSchema,
  uiSettingsSchema,
  updateUiSettingsRequestSchema,
  closeTableRequestSchema,
  closeTableResponseSchema,
  tableCreateRequestSchema,
  tableUpdateRequestSchema,
  tableBulkCreateRequestSchema,
  categoriesListResponseSchema,
  categoryCreateRequestSchema,
  categoryUpdateRequestSchema,
  menuItemAdminListResponseSchema,
  menuItemAdminSchema,
  menuItemCreateRequestSchema,
  menuItemReplaceRecipeRequestSchema,
  menuItemAddRecipeComponentRequestSchema,
  menuItemRemoveRecipeComponentRequestSchema,
  menuItemSchema,
  menuItemUpdateRequestSchema,
  orderSchema,
  paymentFiltersSchema,
  refundPaymentRequestSchema,
  refundPaymentResponseSchema,
  paymentsListResponseSchema,
  customerSchema,
  customerListResponseSchema,
  customerCreateRequestSchema,
  customerAddressCreateRequestSchema,
  customerAddressUpdateRequestSchema,
  customersQuerySchema,
  orderHistoryFiltersSchema,
  orderHistoryListResponseSchema,
  customerAnalyticsSchema,
  customerAnalyticsRequestSchema,
  operationalSummaryQuerySchema,
  reservationsSummarySchema,
  deliverySummarySchema,
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
  consumerAccountsConfigSchema,
  consumerAuthResponseSchema,
  consumerLoginRequestSchema,
  consumerOrderHistoryResponseSchema,
  consumerRefreshRequestSchema,
  consumerRefreshResponseSchema,
  consumerRegisterRequestSchema,
  consumerUserSchema,
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
  splitBillRequestSchema,
  splitBillResponseSchema,
  paySelectedItemsRequestSchema,
  paySelectedItemsResponseSchema,
  markShareAsPaidRequestSchema,
  markShareAsPaidResponseSchema,
  transferTableRequestSchema,
  transferTableResponseSchema,
  reservationCreateRequestSchema,
  reservationNoShowRequestSchema,
  reservationListResponseSchema,
  reservationSchema,
  reservationsQuerySchema,
  reservationStatusSchema,
  reservationUpdateRequestSchema,
  deliveryOrderSchema,
  deliveryOrdersListResponseSchema,
  deliveryOrdersQuerySchema,
  deliveryStatusSchema,
  deliveryStatusUpdateRequestSchema,
  deliveryUpsertRequestSchema,
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
  shiftSchema,
  shiftCreateRequestSchema,
  shiftStatusSchema,
  shiftUpdateRequestSchema,
  shiftsQuerySchema,
  timeEntrySchema,
  timeEntrySourceSchema,
  timeEntryStatusSchema,
  clockInRequestSchema,
  clockOutRequestSchema,
  timeReportQuerySchema,
  timeReportResponseSchema,
  fiscalClosureSchema,
  fiscalCloseRequestSchema,
  fiscalExportSchema,
  fiscalExportCreateRequestSchema,
  fiscalExportStatusSchema,
  fiscalExportsQuerySchema,
  voidOrderRequestSchema,
  voidOrderResponseSchema,
  staffAdminListResponseSchema,
  staffCreateRequestSchema,
  staffResetPinRequestSchema,
  staffUpdateRequestSchema,
  updateOrderRequestSchema,
  type AppData,
  type BomCreateRequest,
  type BomItem,
  type BomUpdateRequest,
  type BomUpsertComponentsRequest,
  type CreateOrderRequest,
  type IngredientCreateRequest,
  type IngredientUpdateRequest,
  type PrepItem,
  type PrepItemUpdateRequest,
  type PrintBridgeOnboardingSecret,
  type PrintBridgeOnboardingSecretCreateCode6DigitResponse,
  type PrintBridgeOnboardingSecretCreateResponse,
  type PreparePrepItemResponse,
  type UnitConversion,
  type UnitConversionCreateRequest,
  type CloseTableRequest,
  type CloseTableResponse,
  type TableCreateRequest,
  type TableUpdateRequest,
  type TableBulkCreateRequest,
  type Ingredient,
  type Category,
  type CategoryCreateRequest,
  type CategoryUpdateRequest,
  type CategoryModifierPool,
  type CategoryModifierPoolCreateRequest,
  type CategoryModifierPoolUpdateRequest,
  type CustomersQuery,
  type Customer,
  type CustomerCreateRequest,
  type CustomerAddressCreateRequest,
  type CustomerAddressUpdateRequest,
  type ConsumerLoginRequest,
  type ConsumerAccountsConfig,
  type ConsumerOrderHistoryResponse,
  type ConsumerRegisterRequest,
  type ConsumerUser,
  type OrderHistoryFilters,
  type CustomerAnalytics,
  type CustomerAnalyticsRequest,
  type OperationalSummaryQuery,
  type ReservationsSummary,
  type DeliverySummary,
  type MenuItem,
  type MenuItemAdmin,
  type MenuItemCreateRequest,
  type MenuItemReplaceRecipeRequest,
  type MenuItemUpdateRequest,
  type Order,
  type OrderStatus,
  type PaymentStatus,
  type PaymentFilters,
  type RefundPaymentRequest,
  type RefundPaymentResponse,
  type PaymentsListResponse,
  type SplitBillRequest,
  type SplitBillResponse,
  type PaySelectedItemsRequest,
  type PaySelectedItemsResponse,
  type MarkShareAsPaidRequest,
  type MarkShareAsPaidResponse,
  type StaffAdmin,
  type StaffCreateRequest,
  type StaffResetPinRequest,
  type Staff,
  type StaffUpdateRequest,
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
  type TransferTableRequest,
  type TransferTableResponse,
  type Reservation,
  type ReservationCreateRequest,
  type ReservationNoShowRequest,
  type ReservationsQuery,
  type ReservationStatus,
  type ReservationUpdateRequest,
  type DeliveryOrder,
  type DeliveryOrdersQuery,
  type DeliveryStatus,
  type DeliveryStatusUpdateRequest,
  type DeliveryUpsertRequest,
  type Supplier,
  type SupplierCreateRequest,
  type SupplierUpdateRequest,
  type SuppliersQuery,
  type PurchaseOrder,
  type PurchaseOrderCreateRequest,
  type PurchaseOrderStatus,
  type PurchaseOrderStatusUpdateRequest,
  type PurchaseOrdersQuery,
  type GoodsReceipt,
  type GoodsReceiptCreateRequest,
  type Shift,
  type ShiftCreateRequest,
  type ShiftUpdateRequest,
  type ShiftStatus,
  type ShiftsQuery,
  type TimeEntry,
  type TimeEntryStatus,
  type ClockInRequest,
  type ClockOutRequest,
  type TimeReportQuery,
  type TimeReportResponse,
  type FiscalClosure,
  type FiscalCloseRequest,
  type FiscalExport,
  type FiscalExportCreateRequest,
  type FiscalExportsQuery,
  type PurchaseOrderItem,
  type VoidOrderRequest,
  type VoidOrderResponse,
  type UpdateOrderRequest,
  type LoyaltyBalance,
  type LoyaltyTransaction,
  defaultUiSettings,
} from "@gustopos/shared";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, ne, or, SQL, sql, lt} from "drizzle-orm";
import { Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import { db, withTenantTx } from "../db/client";
import { getTenantIdOrDefault } from "../tenant/tenant-context.store";
import { hashPin, isHashedPin, verifyPin } from "../auth/pin-hash";
import { assertOrderStatusTransition } from "../orders/order-status-policy";
import {
  authSessions,
  bomComponents,
  bomItems,
  inventory,
  menuItemIngredients,
  menuItemBomRequirements,
  menuItemPrepRequirements,
  menuItems,
  menuModifierGroups,
  menuModifierOptions,
  menuModifierOptionOverrides,
  orderItems,
  orders,
  payments,
  paymentItems,
  appSettings,
  categories,
  customers,
  customerAddresses,
  consumerOrderLinks,
  consumerSessions,
  consumerUsers,
  printJobs,
  reservations,
  deliveryOrders,
  suppliers,
  supplierIngredients,
  purchaseOrders,
  purchaseOrderItems,
  goodsReceipts,
  goodsReceiptItems,
  staffShifts,
  timeEntries,
  fiscalClosures,
  fiscalExports,
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
  loyaltyPoints,
  loyaltyTransactions,
  stockMovements,
  inventoryAudit,
  categoryModifierPools,
  categoryModifierPoolOptions,
  categoryModifierPoolCategories,
  menuItemModifiers,
  prepItems,
  inventoryUnitConversions,
  printBridges,
  printBridgeOnboardingSecrets,
} from "../db/schema";

interface StoredSession {
  id: string;
  tenantId: string;
  staffId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

interface StoredConsumerSession {
  id: string;
  tenantId: string;
  consumerUserId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

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

const purchaseOrderTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["partial_received", "received", "cancelled"],
  partial_received: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

function parsePrintAreas(raw: string | null | undefined): PrintArea[] {
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

function parseSelectedModifiers(raw: string | null | undefined): Array<{ groupId: string; optionId: string }> {
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

function parseIngredientOverrides(raw: string | null | undefined): Array<{ ingredientId: string; action: "add" | "remove" }> {
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

// --- ESC/POS binary builder ---

const ACCENT_MAP: Record<string, string> = {
  "\u00E0": "a", "\u00E8": "e", "\u00E9": "e", "\u00EC": "i",
  "\u00F2": "o", "\u00F3": "o", "\u00F9": "u", "\u00FC": "u",
  "\u00E1": "a", "\u00E2": "a", "\u00E4": "a",
  "\u00E7": "c", "\u00F1": "n",
};

function sanitizeForCp437(text: string): string {
  return text.replace(/[\u00C0-\u024F]/g, (ch) => ACCENT_MAP[ch] ?? ch).replace(/\u20AC/g, "EUR");
}

function escPosEncode(text: string): Uint8Array {
  return new TextEncoder().encode(sanitizeForCp437(text));
}

class EscPosBuilder {
  private buf: number[] = [];

  init() {
    this.raw(0x1B, 0x40);
    return this;
  }

  bold(on: boolean) {
    this.raw(0x1B, 0x45, on ? 0x01 : 0x00);
    return this;
  }

  align(mode: "left" | "center" | "right") {
    const n = mode === "left" ? 0 : mode === "center" ? 1 : 2;
    this.raw(0x1B, 0x61, n);
    return this;
  }

  doubleWidth(on: boolean) {
    this.raw(0x1D, 0x21, on ? 0x10 : 0x00);
    return this;
  }

  doubleSize(on: boolean) {
    this.raw(0x1D, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  text(t: string) {
    const bytes = escPosEncode(t);
    for (const b of bytes) this.buf.push(b);
    return this;
  }

  line(t?: string) {
    if (t !== undefined) this.text(t);
    this.raw(0x0A);
    return this;
  }

  cut() {
    this.raw(0x1D, 0x56, 0x00);
    return this;
  }

  raw(...bytes: number[]) {
    this.buf.push(...bytes);
    return this;
  }

  build(): string {
    return Buffer.from(new Uint8Array(this.buf)).toString("base64");
  }
}

function padRight(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + " ".repeat(width - s.length);
}

function padLeft(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return " ".repeat(width - s.length) + s;
}

const RECEIPT_WIDTH = 42;

function encodeEscPosText(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
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

    if (settings.printing.logoMode === "bitmap" && settings.printing.logoBitmap) {
      ep.raw(0x1B, 0x33, 0x0A);
      ep.line(`LOGO_BITMAP:${settings.printing.logoWidth}:${settings.printing.logoThreshold}`);
      ep.raw(0x1B, 0x32);
    }

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
        ep.bold(true).line(label).bold(false);
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
            .select({ id: inventory.id, name: inventory.name, isContainer: inventory.isContainer })
            .from(inventory)
            .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, [...allIngredientIds])))
        : [];
    const inventoryNameById = new Map(ingredientRows.map((row) => [row.id, row.name]));
    const inventoryIsContainerById = new Map(ingredientRows.map((row) => [row.id, row.isContainer ?? 0]));

    const allOptionIds = new Set<string>();
    for (const item of order.items) {
      for (const mod of item.selectedModifiers ?? []) {
        allOptionIds.add(mod.optionId);
      }
    }

    let groupNameByGroupId = new Map<string, string>();
    const allGroupIds = new Set<string>();
    for (const item of order.items) {
      for (const mod of item.selectedModifiers ?? []) {
        allGroupIds.add(mod.groupId);
      }
    }
    if (allGroupIds.size > 0) {
      const groupRows = await db
        .select({ id: menuModifierGroups.id, name: menuModifierGroups.name })
        .from(menuModifierGroups)
        .where(and(eq(menuModifierGroups.tenantId, tenantId), inArray(menuModifierGroups.id, [...allGroupIds])));
      groupNameByGroupId = new Map(groupRows.map((row) => [row.id, row.name]));
    }

    let optionNameByOptionId = new Map<string, string>();
    let priceDeltaByOptionId = new Map<string, number>();
    let inventoryItemIdByOptionId = new Map<string, string>();
    let bomIdByOptionId = new Map<string, string>();
    let modifierOptionsByOptionId = new Map<string, { inventoryItemId: string | null; bomId: string | null }>();
    if (allOptionIds.size > 0) {
      const optionRows = await db
        .select({ id: menuModifierOptions.id, name: menuModifierOptions.name, priceDelta: menuModifierOptions.priceDelta, inventoryItemId: menuModifierOptions.inventoryItemId, bomId: menuModifierOptions.bomId })
        .from(menuModifierOptions)
        .where(and(eq(menuModifierOptions.tenantId, tenantId), inArray(menuModifierOptions.id, [...allOptionIds])));
      for (const row of optionRows) {
        optionNameByOptionId.set(row.id, row.name);
        priceDeltaByOptionId.set(row.id, Number(row.priceDelta));
        modifierOptionsByOptionId.set(row.id, { inventoryItemId: row.inventoryItemId, bomId: row.bomId });
        if (row.inventoryItemId) {
          inventoryItemIdByOptionId.set(row.id, row.inventoryItemId);
        }
        if (row.bomId) {
          bomIdByOptionId.set(row.id, row.bomId);
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
        .select({ id: inventory.id, name: inventory.name, isContainer: inventory.isContainer })
        .from(inventory)
        .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, poolInventoryIds)));
      for (const row of poolInvRows) {
        inventoryNameById.set(row.id, row.name);
        inventoryIsContainerById.set(row.id, row.isContainer ?? 0);
      }
    }

    // Remove non-container pool option inventory mappings
    for (const [optId, invId] of inventoryItemIdByOptionId) {
      if ((inventoryIsContainerById.get(invId) ?? 0) === 0) {
        inventoryItemIdByOptionId.delete(optId);
      }
    }

    const areaByMenuId = await this.resolvePrintAreasForMenuIds(menuIds);
    const itemsByArea = new Map<PrintArea, Array<{
      name: string; quantity: number; price: number; notes: string;
      modifiers: string[]; modifierOptionIds: string[]; overrides: string[];
    }>>();
    const inventoryCountByArea = new Map<PrintArea, Record<string, number>>();

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

        for (const mod of item.selectedModifiers ?? []) {
          const invId = inventoryItemIdByOptionId.get(mod.optionId);
          if (!invId) continue;
          const isContainer = inventoryIsContainerById.get(invId) ?? 0;
          if (!isContainer) continue;
          const invName = inventoryNameById.get(invId) ?? invId;
          const counts = inventoryCountByArea.get(area) ?? {};
          counts[invName] = (counts[invName] ?? 0) + item.quantity;
          inventoryCountByArea.set(area, counts);
        }

        // Count modifier options that are containers
        for (const mod of item.selectedModifiers ?? []) {
          const modOption = modifierOptionsByOptionId.get(mod.optionId);
          if (!modOption?.inventoryItemId) continue;

          const isContainer = inventoryIsContainerById.get(modOption.inventoryItemId) ?? 0;
          if (!isContainer) continue;

          const invName = inventoryNameById.get(modOption.inventoryItemId) ?? modOption.inventoryItemId;
          const counts = inventoryCountByArea.get(area) ?? {};
          counts[invName] = (counts[invName] ?? 0) + item.quantity;
          inventoryCountByArea.set(area, counts);
        }

        for (const entry of item.ingredientOverrides ?? []) {
          if (entry.action !== "add") continue;
          const isContainer = inventoryIsContainerById.get(entry.ingredientId) ?? 0;
          if (!isContainer) continue;
          const invName = inventoryNameById.get(entry.ingredientId) ?? entry.ingredientId;
          const counts = inventoryCountByArea.get(area) ?? {};
          counts[invName] = (counts[invName] ?? 0) + item.quantity;
          inventoryCountByArea.set(area, counts);
        }
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
          kitchenSummary: area === "kitchen" ? (inventoryCountByArea.get(area) ?? null) : null,
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

  async getBootstrapData(enabledModules: string[]): Promise<{
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
      this.listStaffPublic(),
      this.getUiSettings(),
      kitchenEnabled ? this.listStaffAdmin() : Promise.resolve([]),
      analyticsEnabled ? this.listPayments({ limit: 200 }) : Promise.resolve([]),
      printingEnabled ? this.listPrintJobs({ limit: 100 }) : Promise.resolve([]),
      inventoryEnabled ? this.listInventoryItems() : Promise.resolve([]),
      inventoryEnabled ? this.listBomItems() : Promise.resolve([]),
      inventoryEnabled ? this.listPrepItems() : Promise.resolve([]),
      inventoryEnabled
        ? this.listCategories()
        : simpleCatalogOnly
          ? this.listCategories()
          : Promise.resolve([]),
      customersEnabled ? this.listCustomers({ limit: 100 }) : Promise.resolve([]),
      analyticsEnabled ? this.listOrderHistory({ limit: 200 }) : Promise.resolve([]),
      analyticsEnabled ? this.getCustomerAnalytics({}) : Promise.resolve(null),
    ]);

    const menuItemsAdmin = inventoryEnabled
      ? await this.listMenuItemsAdmin()
      : simpleCatalogOnly
        ? await this.listMenuItemsAdmin()
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

  private async mapBomItems(): Promise<BomItem[]> {
    const tenantId = getTenantIdOrDefault();
    const [bomRows, componentRows] = await Promise.all([
      db.select().from(bomItems).where(eq(bomItems.tenantId, tenantId)),
      db.select().from(bomComponents).where(eq(bomComponents.tenantId, tenantId)),
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
        unit: row.unit,
        yieldQuantity: Number(row.yieldQuantity),
        isActive: row.isActive === 1,
        categoryId: row.categoryId ?? undefined,
        isContainer: row.isContainer ?? 0,
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

  private mapInventoryRows(rows: { id: string; name: string; quantity: unknown; unit: string; minThreshold: unknown; categoryId: string | null; unitCost: unknown; salePrice: string | null; isActive: number; isContainer: number; supplierName?: string | null; brandName?: string | null; sku?: string | null }[]): Ingredient[] {
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
      isContainer: row.isContainer ?? 0,
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

  private mapCustomerRow(params: {
    row: typeof customers.$inferSelect;
    totalOrders: number;
    totalSpent: number;
    addresses?: Array<typeof customerAddresses.$inferSelect>;
  }): Customer {
    const { row, totalOrders, totalSpent, addresses } = params;
    return customerSchema.parse({
      id: row.id,
      fullName: row.fullName,
      phone: row.phone ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : undefined,
      totalOrders,
      totalSpent,
      addresses: addresses?.map((a) => ({
        id: a.id,
        label: a.label,
        address: a.address,
        isDefault: a.isDefault === 1,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    });
  }

  private async mapMenuItemsAdmin(): Promise<MenuItemAdmin[]> {
    const tenantId = getTenantIdOrDefault();
    const [menuRows, ingredientRows, bomRows, prepRows, inventoryRows, bomItemRows, prepItemRows, modifierGroupRows, modifierOptionRows, overrideRows, menuItemModifierRows] = await Promise.all([
      db.select().from(menuItems).where(eq(menuItems.tenantId, tenantId)),
      db.select().from(menuItemIngredients).where(eq(menuItemIngredients.tenantId, tenantId)),
      db.select().from(menuItemBomRequirements).where(eq(menuItemBomRequirements.tenantId, tenantId)),
      db.select().from(menuItemPrepRequirements).where(eq(menuItemPrepRequirements.tenantId, tenantId)),
      db.select().from(inventory).where(eq(inventory.tenantId, tenantId)),
      db.select().from(bomItems).where(eq(bomItems.tenantId, tenantId)),
      db.select().from(prepItems).where(eq(prepItems.tenantId, tenantId)),
      db.select().from(menuModifierGroups).where(eq(menuModifierGroups.tenantId, tenantId)),
      db.select().from(menuModifierOptions).where(eq(menuModifierOptions.tenantId, tenantId)),
      db.select().from(menuModifierOptionOverrides).where(eq(menuModifierOptionOverrides.tenantId, tenantId)),
      db.select().from(menuItemModifiers).where(eq(menuItemModifiers.tenantId, tenantId)),
    ]);

    const ingredientNameById = new Map(inventoryRows.map((row) => [row.id, row.name]));
    const bomNameById = new Map(bomItemRows.map((row) => [row.id, row.name]));
    const prepNameById = new Map(prepItemRows.map((row) => [row.id, row.name]));
    const prepUnitById = new Map(prepItemRows.map((row) => [row.id, row.unit]));

    const recipeByMenuId = new Map<string, MenuItemAdmin["recipe"]>();

    for (const ingredient of ingredientRows) {
      const existing = recipeByMenuId.get(ingredient.menuItemId) ?? [];
      existing.push({
        componentType: "ingredient",
        componentId: ingredient.ingredientId,
        componentName: ingredientNameById.get(ingredient.ingredientId) ?? ingredient.ingredientId,
        quantity: toNumeric(ingredient.quantity),
        unit: ingredient.unit,
      });
      recipeByMenuId.set(ingredient.menuItemId, existing);
    }

    for (const bom of bomRows) {
      const existing = recipeByMenuId.get(bom.menuItemId) ?? [];
      existing.push({
        componentType: "bom",
        componentId: bom.bomId,
        componentName: bomNameById.get(bom.bomId) ?? bom.bomId,
        quantity: toNumeric(bom.quantity),
        unit: bom.unit,
      });
      recipeByMenuId.set(bom.menuItemId, existing);
    }

    for (const prep of prepRows) {
      const existing = recipeByMenuId.get(prep.menuItemId) ?? [];
      existing.push({
        componentType: "prep",
        componentId: prep.prepItemId,
        componentName: prepNameById.get(prep.prepItemId) ?? prep.prepItemId,
        quantity: toNumeric(prep.quantity),
        unit: prepUnitById.get(prep.prepItemId) ?? "",
      });
      recipeByMenuId.set(prep.menuItemId, existing);
    }

    const overridesByOptionId = new Map<string, Array<{ ingredientId: string; action: "add" | "remove" | "replace" }>>();
    for (const override of overrideRows) {
      const existing = overridesByOptionId.get(override.optionId) ?? [];
      existing.push({ ingredientId: override.ingredientId, action: override.action as "add" | "remove" | "replace" });
      overridesByOptionId.set(override.optionId, existing);
    }

    const optionsByGroupId = new Map<string, Array<{ id: string; name: string; inventoryItemId?: string; bomId?: string; priceDelta: number; isDefault: boolean; isActive: boolean; sortOrder: number; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }>>();
    for (const opt of modifierOptionRows) {
      const existing = optionsByGroupId.get(opt.groupId) ?? [];
      existing.push({
        id: opt.id,
        name: opt.name,
        inventoryItemId: opt.inventoryItemId ?? undefined,
        bomId: opt.bomId ?? undefined,
        priceDelta: Number(opt.priceDelta),
        isDefault: Boolean(opt.isDefault),
        isActive: Boolean(opt.isActive),
        sortOrder: opt.sortOrder ?? 0,
        ingredientOverrides: overridesByOptionId.get(opt.id) ?? [],
      });
      optionsByGroupId.set(opt.groupId, existing);
    }

    const modifierGroupsByMenuId = new Map<string, Array<{ id: string; name: string; required: boolean; minSelections: number; maxSelections: number; sortOrder: number; options: Array<{ id: string; name: string; priceDelta: number; isDefault: boolean; isActive: boolean; sortOrder: number; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }> }>>();
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

    const adminInventoryById = new Map(inventoryRows.map((row) => [row.id, row]));
    const adminModifiersByMenuId = new Map<string, Array<{ id: string; inventoryItemId: string; name: string; priceDelta: number; effectivePrice: number }>>();
    for (const mod of menuItemModifierRows) {
      const existing = adminModifiersByMenuId.get(mod.menuItemId) ?? [];
      const invItem = adminInventoryById.get(mod.inventoryItemId);
      const priceDelta = Number(mod.priceDelta);
      const effectivePrice = priceDelta || (invItem?.salePrice != null ? Number(invItem.salePrice) : 0);
      existing.push({
        id: mod.id,
        inventoryItemId: mod.inventoryItemId,
        name: invItem?.name ?? mod.inventoryItemId,
        priceDelta,
        effectivePrice,
      });
      adminModifiersByMenuId.set(mod.menuItemId, existing);
    }

    return menuItemAdminListResponseSchema.parse(
      menuRows.map((row) =>
        menuItemAdminSchema.parse({
          id: row.id,
          name: row.name,
          price: Number(row.price),
          category: row.category,
          categoryId: row.categoryId ?? undefined,
          defaultContainerId: row.defaultContainerId ?? null,
          printAreas: parsePrintAreas(row.printAreas),
          isActive: row.isActive === 1,
          recipe: recipeByMenuId.get(row.id) ?? [],
          modifiers: adminModifiersByMenuId.get(row.id) ?? [],
          modifierGroups: modifierGroupsByMenuId.get(row.id) ?? [],
        }),
      ),
    );
  }

  async getPublicData(): Promise<AppData> {
    const tenantId = getTenantIdOrDefault();
    const [staffRows, tableRows, inventoryRows, menuRows, ingredientLinks, menuBomLinks, orderRows, orderItemRows, mappedBomItems, modifierGroupRows, modifierOptionRows, modifierOptionOverrideRows, catPoolRows, catPoolOptionRows, catPoolCategoryRows, menuItemModifierRows, categoryRows, deliveryOrderRows] =
      await Promise.all([
        db.select().from(staff).where(eq(staff.tenantId, tenantId)),
        db.select().from(tables).where(eq(tables.tenantId, tenantId)),
        db.select().from(inventory).where(eq(inventory.tenantId, tenantId)),
        db.select().from(menuItems).where(eq(menuItems.tenantId, tenantId)),
        db.select().from(menuItemIngredients).where(eq(menuItemIngredients.tenantId, tenantId)),
        db.select().from(menuItemBomRequirements).where(eq(menuItemBomRequirements.tenantId, tenantId)),
        db.select().from(orders).where(and(eq(orders.tenantId, tenantId), ne(orders.status, "paid"), ne(orders.status, "cancelled"))),
        db.select().from(orderItems).where(eq(orderItems.tenantId, tenantId)),
        this.mapBomItems(),
        db.select().from(menuModifierGroups).where(eq(menuModifierGroups.tenantId, tenantId)),
        db.select().from(menuModifierOptions).where(eq(menuModifierOptions.tenantId, tenantId)),
        db.select().from(menuModifierOptionOverrides).where(eq(menuModifierOptionOverrides.tenantId, tenantId)),
        db.select().from(categoryModifierPools).where(eq(categoryModifierPools.tenantId, tenantId)),
        db.select().from(categoryModifierPoolOptions).where(eq(categoryModifierPoolOptions.tenantId, tenantId)),
        db.select().from(categoryModifierPoolCategories).where(eq(categoryModifierPoolCategories.tenantId, tenantId)),
        db.select().from(menuItemModifiers).where(eq(menuItemModifiers.tenantId, tenantId)),
        db.select().from(categories).where(eq(categories.tenantId, tenantId)),
        db.select({ orderId: deliveryOrders.orderId, eta: deliveryOrders.eta }).from(deliveryOrders).where(eq(deliveryOrders.tenantId, tenantId)),
      ]);

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
    const bomNameById = new Map(mappedBomItems.map((item) => [item.id, item.name]));

    const ingredientsByMenuId = new Map<string, string[]>();
    for (const link of ingredientLinks) {
      const existing = ingredientsByMenuId.get(link.menuItemId) ?? [];
      existing.push(link.ingredientId);
      ingredientsByMenuId.set(link.menuItemId, existing);
    }

    const bomLinksByMenuId = new Map<string, string[]>();
    for (const link of menuBomLinks) {
      const existing = bomLinksByMenuId.get(link.menuItemId) ?? [];
      existing.push(link.bomId);
      bomLinksByMenuId.set(link.menuItemId, existing);
    }

    const recipeByMenuId = new Map<string, Array<{ componentType: "ingredient" | "bom"; componentId: string; componentName: string; quantity: number; unit: string }>>();
    for (const link of ingredientLinks) {
      const existing = recipeByMenuId.get(link.menuItemId) ?? [];
      existing.push({
        componentType: "ingredient",
        componentId: link.ingredientId,
        componentName: ingredientNameById.get(link.ingredientId) ?? link.ingredientId,
        quantity: toNumeric(link.quantity),
        unit: link.unit,
      });
      recipeByMenuId.set(link.menuItemId, existing);
    }
    for (const link of menuBomLinks) {
      const existing = recipeByMenuId.get(link.menuItemId) ?? [];
      existing.push({
        componentType: "bom",
        componentId: link.bomId,
        componentName: bomNameById.get(link.bomId) ?? link.bomId,
        quantity: toNumeric(link.quantity),
        unit: link.unit,
      });
      recipeByMenuId.set(link.menuItemId, existing);
    }

    const overridesByOptionId = new Map<string, Array<{ ingredientId: string; action: "add" | "remove" | "replace" }>>();
    for (const override of modifierOptionOverrideRows) {
      const existing = overridesByOptionId.get(override.optionId) ?? [];
      existing.push({ ingredientId: override.ingredientId, action: override.action as "add" | "remove" | "replace" });
      overridesByOptionId.set(override.optionId, existing);
    }

    const optionsByGroupId = new Map<string, Array<{ id: string; name: string; inventoryItemId?: string; bomId?: string; priceDelta: number; isDefault: boolean; isActive: boolean; sortOrder: number; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }>>();
    for (const opt of modifierOptionRows) {
      const existing = optionsByGroupId.get(opt.groupId) ?? [];
      existing.push({
        id: opt.id,
        name: opt.name,
        inventoryItemId: opt.inventoryItemId ?? undefined,
        bomId: opt.bomId ?? undefined,
        priceDelta: Number(opt.priceDelta),
        isDefault: Boolean(opt.isDefault),
        isActive: Boolean(opt.isActive),
        sortOrder: opt.sortOrder ?? 0,
        ingredientOverrides: overridesByOptionId.get(opt.id) ?? [],
      });
      optionsByGroupId.set(opt.groupId, existing);
    }

    const modifierGroupsByMenuId = new Map<string, Array<{ id: string; name: string; required: boolean; minSelections: number; maxSelections: number; sortOrder: number; options: Array<{ id: string; name: string; inventoryItemId?: string; priceDelta: number; isDefault: boolean; isActive: boolean; sortOrder: number; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }> }>>();
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

    const catPoolOptionsByPoolId = new Map<string, Array<{ id: string; name: string; priceDelta: number; isDefault: boolean; isActive: boolean; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }>>();
    for (const opt of catPoolOptionRows) {
      const existing = catPoolOptionsByPoolId.get(opt.poolId) ?? [];
      const optionName = opt.name ?? (opt.inventoryItemId ? inventoryNameById.get(opt.inventoryItemId) : undefined) ?? opt.inventoryItemId ?? '';
      existing.push({
        id: opt.id,
        name: optionName,
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

    const catPoolGroupsByCategoryId = new Map<string, Array<{ id: string; name: string; required: boolean; minSelections: number; maxSelections: number; options: Array<{ id: string; name: string; priceDelta: number; isDefault: boolean; isActive: boolean; ingredientOverrides: Array<{ ingredientId: string; action: "add" | "remove" | "replace" }> }> }>>();
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

    const inventoryById = new Map(inventoryRows.map((row) => [row.id, row]));

    const modifiersByMenuId = new Map<string, Array<{ id: string; inventoryItemId: string; name: string; priceDelta: number; effectivePrice: number }>>();
    for (const mod of menuItemModifierRows) {
      const existing = modifiersByMenuId.get(mod.menuItemId) ?? [];
      const invItem = inventoryById.get(mod.inventoryItemId);
      const priceDelta = Number(mod.priceDelta);
      const effectivePrice = priceDelta || (invItem?.salePrice != null ? Number(invItem.salePrice) : 0);
      existing.push({
        id: mod.id,
        inventoryItemId: mod.inventoryItemId,
        name: invItem?.name ?? mod.inventoryItemId,
        priceDelta,
        effectivePrice,
      });
      modifiersByMenuId.set(mod.menuItemId, existing);
    }

    const mappedMenu: MenuItem[] = menuRows
      .map((row) => {
        const itemModifiers = modifiersByMenuId.get(row.id) ?? [];
        const categoryPoolModifiers = row.categoryId ? (catPoolGroupsByCategoryId.get(row.categoryId) ?? []) : [];
        return {
          id: row.id,
          name: row.name,
          price: Number(row.price),
          category: row.category,
          categoryId: row.categoryId ?? undefined,
          printAreas: parsePrintAreas(row.printAreas),
          ingredients: ingredientsByMenuId.get(row.id) ?? [],
          recipe: recipeByMenuId.get(row.id) ?? [],
          modifiers: itemModifiers,
          modifierGroups: modifierGroupsByMenuId.get(row.id) ?? [],
        };
      })
      .filter((item) => {
        const row = menuRows.find((menu) => menu.id === item.id);
        const hasIngredientRecipe = (ingredientsByMenuId.get(item.id)?.length ?? 0) > 0;
        const hasBomRecipe = (bomLinksByMenuId.get(item.id)?.length ?? 0) > 0;
        const hasModifierGroupsWithInventory = (modifierGroupsByMenuId.get(item.id) ?? []).some((group) =>
          group.options.some((opt) => opt.inventoryItemId),
        );
        return row?.isActive === 1 && (hasIngredientRecipe || hasBomRecipe || hasModifierGroupsWithInventory);
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

    const enabledModules = await this.getEnabledModulesForTenant(tenant.id);
    if (!enabledModules.includes("public_menu")) {
      throw new Error("Public menu module is disabled for this tenant");
    }

    const [categoryRows, menuRows, ingredientRows, bomRows, moduleConfigRows, takeawayConfigRows] = await Promise.all([
      db
        .select()
        .from(categories)
        .where(and(eq(categories.tenantId, tenant.id), eq(categories.isActive, 1))),
      db
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.tenantId, tenant.id), eq(menuItems.isActive, 1))),
      db.select().from(menuItemIngredients).where(eq(menuItemIngredients.tenantId, tenant.id)),
      db.select().from(menuItemBomRequirements).where(eq(menuItemBomRequirements.tenantId, tenant.id)),
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
    for (const row of ingredientRows) {
      const existing = ingredientsByMenuId.get(row.menuItemId) ?? [];
      existing.push(row.ingredientId);
      ingredientsByMenuId.set(row.menuItemId, existing);
    }

    const bomByMenuId = new Map<string, string[]>();
    for (const row of bomRows) {
      const existing = bomByMenuId.get(row.menuItemId) ?? [];
      existing.push(row.bomId);
      bomByMenuId.set(row.menuItemId, existing);
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
    const tenant = await this.getTenantBySlug(tenantSlug);
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
    const tenant = await this.getTenantBySlug(tenantSlug);
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
    const tenant = await this.getTenantBySlug(tenantSlug);
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
    const tenant = await this.getTenantBySlug(tenantSlug);
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
      await this.linkConsumerToOrder(tenant.id, created.order.id, consumerUserId);
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
      await this.linkConsumerToOrder(tenant.id, order.order.id, consumerUserId);
    }

    return selfOrderCreateResponseSchema.parse({
      order: order.order,
      sessionExpiresAt: session.expiresAt.toISOString(),
    });
  }

  async listBomItems(): Promise<BomItem[]> {
    return this.mapBomItems();
  }

  async listPrepItems(): Promise<PrepItem[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select({
        id: prepItems.id,
        tenantId: prepItems.tenantId,
        ingredientId: prepItems.ingredientId,
        name: prepItems.name,
        quantityPerUnit: prepItems.quantityPerUnit,
        unit: prepItems.unit,
        stockQuantity: prepItems.stockQuantity,
        createdAt: prepItems.createdAt,
      })
      .from(prepItems)
      .where(eq(prepItems.tenantId, tenantId))
      .orderBy(prepItems.name);

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      ingredientId: row.ingredientId,
      name: row.name,
      quantityPerUnit: Number(row.quantityPerUnit),
      unit: row.unit,
      stockQuantity: Number(row.stockQuantity),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createPrepItem(payload: { ingredientId: string; name: string; quantityPerUnit: number; unit: string }): Promise<PrepItem> {
    const tenantId = getTenantIdOrDefault();
    const id = `prep_${Date.now().toString(36)}`;
    await db.insert(prepItems).values({
      id,
      tenantId,
      ingredientId: payload.ingredientId,
      name: payload.name,
      quantityPerUnit: String(payload.quantityPerUnit),
      unit: payload.unit,
    });
    return (await this.listPrepItems()).find((p) => p.id === id)!;
  }

  async updatePrepItem(id: string, payload: PrepItemUpdateRequest): Promise<PrepItem> {
    const tenantId = getTenantIdOrDefault();
    const existing = await db.query.prepItems.findFirst({
      where: and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)),
    });
    if (!existing) throw new Error(`Prep item ${id} not found`);
    const updates: Record<string, any> = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.quantityPerUnit !== undefined) updates.quantityPerUnit = String(payload.quantityPerUnit);
    if (payload.unit !== undefined) updates.unit = payload.unit;
    if (Object.keys(updates).length > 0) {
      await db.update(prepItems).set(updates).where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)));
    }
    return (await this.listPrepItems()).find((p) => p.id === id)!;
  }

  async deletePrepItem(id: string): Promise<void> {
    const tenantId = getTenantIdOrDefault();
    await db.delete(prepItems).where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)));
  }

  async preparePrepItem(id: string, quantity: number): Promise<PreparePrepItemResponse> {
    return db.transaction(async (tx) => {
      const tenantId = getTenantIdOrDefault();
      const prep = await tx.query.prepItems.findFirst({
        where: and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)),
      });
      if (!prep) throw new Error(`Prep item ${id} not found`);
      const ing = await tx.query.inventory.findFirst({
        where: and(eq(inventory.tenantId, tenantId), eq(inventory.id, prep.ingredientId)),
      });
      if (!ing) throw new Error(`Ingredient ${prep.ingredientId} not found`);
      const rawNeeded = Number(prep.quantityPerUnit) * quantity;
      const prevIngQty = Number(ing.quantity);
      if (prevIngQty < rawNeeded) {
        throw new Error(`Insufficient ${ing.name}: need ${rawNeeded} ${ing.unit}, have ${prevIngQty}`);
      }
      const newIngQty = prevIngQty - rawNeeded;
      await tx.update(inventory).set({ quantity: String(newIngQty) }).where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, ing.id)));
      await tx.insert(stockMovements).values({
        id: crypto.randomUUID(),
        tenantId,
        ingredientId: ing.id,
        orderId: null,
        movementType: "manual_adjustment",
        quantity: String(-rawNeeded),
        previousQuantity: String(prevIngQty),
        newQuantity: String(newIngQty),
        notes: `Prepared ${quantity} ${prep.name}`,
        staffId: null,
      });
      const prevStock = Number(prep.stockQuantity);
      const newStock = prevStock + quantity;
      await tx.update(prepItems).set({ stockQuantity: String(newStock) }).where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, id)));
      return {
        name: prep.name,
        prepItemId: prep.id,
        previousStock: prevStock,
        newStock,
        ingredientsDeducted: [{ id: ing.id, name: ing.name, quantity: rawNeeded, unit: ing.unit }],
      }; /* CASCADE2_PREP_PREPITEM_RETURN_DONE */
    });
  }

  async listUnitConversions(inventoryId: string): Promise<UnitConversion[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(inventoryUnitConversions)
      .where(and(eq(inventoryUnitConversions.tenantId, tenantId), eq(inventoryUnitConversions.inventoryId, inventoryId)));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      inventoryId: r.inventoryId,
      fromUnit: r.fromUnit,
      toUnit: r.toUnit,
      factor: Number(r.factor),
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createUnitConversion(inventoryId: string, payload: UnitConversionCreateRequest): Promise<UnitConversion> {
    const tenantId = getTenantIdOrDefault();
    const id = `uc_${Date.now().toString(36)}`;
    await db.insert(inventoryUnitConversions).values({
      id,
      tenantId,
      inventoryId,
      fromUnit: payload.fromUnit,
      toUnit: payload.toUnit,
      factor: String(payload.factor),
    });
    return (await this.listUnitConversions(inventoryId)).find((c) => c.id === id)!;
  }

  async listInventoryItems(): Promise<Ingredient[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select({
        id: inventory.id,
        name: inventory.name,
        sku: inventory.sku,
        quantity: inventory.quantity,
        unit: inventory.unit,
        minThreshold: inventory.minThreshold,
        categoryId: inventory.categoryId,
        unitCost: inventory.unitCost,
        salePrice: inventory.salePrice,
        isActive: inventory.isActive,
        isContainer: inventory.isContainer,
        supplierName: sql<string | null>`"suppliers"."name"`.as('supplierName'),
        brandName: sql<string | null>`"supplier_ingredients"."brand_name"`.as('brandName'),
      })
      .from(inventory)
      .leftJoin(
        supplierIngredients,
        and(
          eq(supplierIngredients.ingredientId, inventory.id),
          eq(supplierIngredients.tenantId, tenantId),
          eq(supplierIngredients.isPreferred, 1),
        ),
      )
      .leftJoin(suppliers, eq(suppliers.id, supplierIngredients.supplierId))
      .where(eq(inventory.tenantId, tenantId));
    return this.mapInventoryRows(rows);
  }

  async createInventoryItem(payload: IngredientCreateRequest): Promise<Ingredient> {
    const parsed = ingredientCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const id = `i_${Date.now().toString(36)}`;

    const inserted = await db
      .insert(inventory)
      .values({
        id,
        tenantId,
        name: parsed.name,
        sku: parsed.sku ?? null,
        quantity: String(parsed.quantity),
        unit: parsed.unit,
        minThreshold: String(parsed.minThreshold),
        categoryId: parsed.categoryId ?? null,
        unitCost: String(parsed.unitCost ?? 0),
        salePrice: parsed.salePrice != null ? String(parsed.salePrice) : null,
        isContainer: parsed.isContainer ? 1 : 0,
        isActive: 1,
      })
      .returning();

    const created = inserted[0];
    return {
      id: created.id,
      name: created.name,
      sku: created.sku ?? null,
      quantity: Number(created.quantity),
      unit: created.unit,
      minThreshold: Number(created.minThreshold),
      categoryId: created.categoryId ?? undefined,
      unitCost: Number(created.unitCost ?? 0),
      salePrice: created.salePrice != null ? Number(created.salePrice) : null,
      isActive: created.isActive === 1,
      isContainer: created.isContainer ?? 0,
    };
  }

  async updateInventoryItem(id: string, payload: IngredientUpdateRequest): Promise<Ingredient | null> {
    const parsed = ingredientUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    // Capture old values for audit trail
    const existing = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
      .limit(1);
    const oldRow = existing[0] ?? null;

    const updated = await db
      .update(inventory)
      .set({
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...(parsed.sku !== undefined ? { sku: parsed.sku } : {}),
        ...(parsed.quantity !== undefined ? { quantity: String(parsed.quantity) } : {}),
        ...(parsed.unit !== undefined ? { unit: parsed.unit } : {}),
        ...(parsed.minThreshold !== undefined ? { minThreshold: String(parsed.minThreshold) } : {}),
        ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
        ...(parsed.unitCost !== undefined ? { unitCost: String(parsed.unitCost) } : {}),
        ...(parsed.salePrice !== undefined ? { salePrice: parsed.salePrice != null ? String(parsed.salePrice) : null } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
        ...(parsed.isContainer !== undefined ? { isContainer: parsed.isContainer ? 1 : 0 } : {}),
      })
      .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    // Audit trail: log changes
    if (oldRow) {
      const row = updated[0];
      const auditableFields = [
        { field: "name", oldVal: oldRow.name, newVal: row.name },
        { field: "quantity", oldVal: oldRow.quantity, newVal: row.quantity },
        { field: "unit", oldVal: oldRow.unit, newVal: row.unit },
        { field: "minThreshold", oldVal: oldRow.minThreshold, newVal: row.minThreshold },
        { field: "unitCost", oldVal: oldRow.unitCost ?? "0", newVal: row.unitCost ?? "0" },
        { field: "salePrice", oldVal: oldRow.salePrice ?? null, newVal: row.salePrice ?? null },
        { field: "categoryId", oldVal: oldRow.categoryId ?? null, newVal: row.categoryId ?? null },
        { field: "isActive", oldVal: String(oldRow.isActive), newVal: String(row.isActive) },
        { field: "isContainer", oldVal: String(oldRow.isContainer ?? 0), newVal: String(row.isContainer ?? 0) },
        { field: "sku", oldVal: oldRow.sku ?? null, newVal: row.sku ?? null },
      ];
      const changes = auditableFields.filter((f) => f.oldVal !== f.newVal);
      if (changes.length > 0) {
        await db.insert(inventoryAudit).values(changes.map((c) => ({
          id: crypto.randomUUID(),
          tenantId,
          inventoryId: id,
          field: c.field,
          oldValue: c.oldVal,
          newValue: c.newVal,
          changedBy: null,
          createdAt: new Date(),
        })));
      }
    }

    const row = updated[0];
    return {
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
      isContainer: row.isContainer ?? 0,
    };
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const existing = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
      .limit(1);
    if (existing.length === 0) {
      return false;
    }

    const menuUsage = await db
      .select({ menuItemId: menuItemIngredients.menuItemId })
      .from(menuItemIngredients)
      .where(and(eq(menuItemIngredients.tenantId, tenantId), eq(menuItemIngredients.ingredientId, id)))
      .limit(1);
    if (menuUsage.length > 0) {
      throw new Error("Cannot delete ingredient linked to a menu recipe");
    }

    const bomUsage = await db
      .select({ bomId: bomComponents.bomId })
      .from(bomComponents)
      .where(
        and(
          eq(bomComponents.tenantId, tenantId),
          eq(bomComponents.componentType, "ingredient"),
          eq(bomComponents.componentId, id),
        ),
      )
      .limit(1);
    if (bomUsage.length > 0) {
      throw new Error("Cannot delete ingredient linked to a BoM");
    }

    await db
      .delete(inventory)
      .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)));
    return true;
  }

  async adjustInventoryItem(
    id: string,
    deltaQuantity: number,
    notes?: string,
    staffId?: string,
  ): Promise<Ingredient> {
    const tenantId = getTenantIdOrDefault();

    return withTenantTx(async (tx) => {
      const rows = await tx
        .select()
        .from(inventory)
        .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new Error("Ingredient not found");
      }

      const previousQty = Number(row.quantity);
      const newQty = previousQty + deltaQuantity;
      if (newQty < 0) {
        throw new Error(`Stock cannot go below zero (current: ${previousQty}, adjustment: ${deltaQuantity})`);
      }

      await tx
        .update(inventory)
        .set({ quantity: String(newQty) })
        .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)));

      await tx.insert(stockMovements).values({
        id: crypto.randomUUID(),
        tenantId,
        ingredientId: id,
        orderId: null,
        movementType: "manual_adjustment",
        quantity: String(deltaQuantity),
        previousQuantity: String(previousQty),
        newQuantity: String(newQty),
        notes: notes ?? `Manual adjustment: ${deltaQuantity > 0 ? "+" : ""}${deltaQuantity}`,
        staffId: staffId ?? null,
      });

      const updated = await tx
        .select()
        .from(inventory)
        .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, id)))
        .limit(1);
      const r = updated[0];
      return {
        id: r.id,
        name: r.name,
        quantity: Number(r.quantity),
        unit: r.unit,
        minThreshold: Number(r.minThreshold),
        categoryId: r.categoryId ?? undefined,
        unitCost: Number(r.unitCost ?? 0),
        salePrice: r.salePrice != null ? Number(r.salePrice) : null,
        isActive: r.isActive === 1,
        isContainer: r.isContainer ?? 0,
      };
    });
  }

  async listStockMovements(filters?: {
    ingredientId?: string;
    orderId?: string;
    movementType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Array<{
    id: string;
    tenantId: string;
    ingredientId: string | null;
    prepItemId: string | null;
    orderId: string | null;
    movementType: string;
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    notes: string | null;
    staffId: string | null;
    createdAt: string;
  }>; total: number }> {
    const tenantId = getTenantIdOrDefault();
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    const conditions: SQL[] = [eq(stockMovements.tenantId, tenantId)];
    if (filters?.ingredientId) conditions.push(eq(stockMovements.ingredientId, filters.ingredientId));
    if (filters?.orderId) conditions.push(eq(stockMovements.orderId, filters.orderId));
    if (filters?.movementType) conditions.push(eq(stockMovements.movementType, filters.movementType));

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(stockMovements)
      .where(and(...conditions));
    const total = countResult[0]?.count ?? 0;

    const rows = await db
      .select()
      .from(stockMovements)
      .where(and(...conditions))
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        ingredientId: r.ingredientId,
        prepItemId: r.prepItemId,
        orderId: r.orderId,
        movementType: r.movementType,
        quantity: Number(r.quantity),
        previousQuantity: Number(r.previousQuantity),
        newQuantity: Number(r.newQuantity),
        notes: r.notes,
        staffId: r.staffId,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
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

  // --- Shadow BoM helpers ---

  private shadowBomName(menuItemId: string): string {
    return `__shadow__${menuItemId}`;
  }

  private async findShadowBoMId(menuItemId: string): Promise<string | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select({ id: bomItems.id })
      .from(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.name, this.shadowBomName(menuItemId))))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  private async syncShadowBoM(
    tx: typeof db,
    tenantId: string,
    menuItemId: string,
    recipe: Array<{ componentType: string; componentId: string; quantity: number; unit: string }>,
    categoryId?: string | null,
  ): Promise<void> {
    const shadowName = this.shadowBomName(menuItemId);
    let bomId = await this.findShadowBoMId(menuItemId);

    if (!bomId) {
      bomId = `bom_shadow_${Date.now().toString(36)}`;
      await tx.insert(bomItems).values({
        id: bomId,
        tenantId,
        name: shadowName,
        unit: 'pz',
        yieldQuantity: '1',
        categoryId: categoryId ?? null,
        isActive: 1,
        isContainer: 0,
      });
      await tx.insert(menuItemBomRequirements).values({
        tenantId,
        menuItemId,
        bomId,
        quantity: '1',
        unit: 'pz',
      });
    }

    await tx
      .delete(bomComponents)
      .where(and(eq(bomComponents.tenantId, tenantId), eq(bomComponents.bomId, bomId)));

    if (recipe.length > 0) {
      await tx.insert(bomComponents).values(
        recipe.map((c) => ({
          tenantId,
          bomId: bomId!,
          componentType: c.componentType,
          componentId: c.componentId,
          quantity: String(c.quantity),
          unit: c.unit,
        })),
      );
    }
  }

  private async deleteShadowBoM(menuItemId: string): Promise<void> {
    const tenantId = getTenantIdOrDefault();
    const bomId = await this.findShadowBoMId(menuItemId);
    if (!bomId) return;
    await db
      .delete(bomComponents)
      .where(and(eq(bomComponents.tenantId, tenantId), eq(bomComponents.bomId, bomId)));
    await db
      .delete(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, bomId)));
  }

  async createBomItem(payload: BomCreateRequest): Promise<BomItem> {
    const parsed = bomCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const bomId = `bom_${Date.now().toString(36)}`;

    await withTenantTx(async (tx) => {
      await tx.insert(bomItems).values({
        id: bomId,
        tenantId,
        name: parsed.name,
        unit: parsed.unit,
        yieldQuantity: String(parsed.yieldQuantity),
        categoryId: parsed.categoryId ?? null,
        isContainer: parsed.isContainer ? 1 : 0,
        isActive: 1,
      });

      if (parsed.components.length > 0) {
        await tx.insert(bomComponents).values(
          parsed.components.map((component) => ({
            tenantId,
            bomId,
            componentType: component.componentType,
            componentId: component.componentId,
            quantity: String(component.quantity),
            unit: component.unit,
          })),
        );
      }
    });

    const created = (await this.mapBomItems()).find((item) => item.id === bomId);
    if (!created) {
      throw new Error("Failed to create BoM item");
    }

    return created;
  }

  async updateBomItem(id: string, payload: BomUpdateRequest): Promise<BomItem | null> {
    const parsed = bomUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const existing = await db
      .select({ id: bomItems.id, name: bomItems.name })
      .from(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
      .limit(1);
    if (existing.length === 0) return null;
    if (existing[0].name.startsWith('__shadow__')) {
      throw new Error("Cannot modify auto-generated shadow BoM");
    }

    const updated = await db
      .update(bomItems)
      .set({
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.unit ? { unit: parsed.unit } : {}),
        ...(parsed.yieldQuantity ? { yieldQuantity: String(parsed.yieldQuantity) } : {}),
        ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
        ...(parsed.isContainer !== undefined ? { isContainer: parsed.isContainer ? 1 : 0 } : {}),
      })
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
      .returning({ id: bomItems.id });

    if (updated.length === 0) {
      return null;
    }

    return (await this.mapBomItems()).find((item) => item.id === id) ?? null;
  }

  async replaceBomComponents(id: string, payload: BomUpsertComponentsRequest): Promise<BomItem | null> {
    const parsed = bomUpsertComponentsRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const bom = await db
      .select({ id: bomItems.id, name: bomItems.name })
      .from(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
      .limit(1);
    if (bom.length === 0) return null;
    if (bom[0].name.startsWith('__shadow__')) {
      throw new Error("Cannot modify auto-generated shadow BoM");
    }

    await withTenantTx(async (tx) => {
      await tx.delete(bomComponents).where(and(eq(bomComponents.tenantId, tenantId), eq(bomComponents.bomId, id)));

      if (parsed.components.length > 0) {
        await tx.insert(bomComponents).values(
          parsed.components.map((component) => ({
            tenantId,
            bomId: id,
            componentType: component.componentType,
            componentId: component.componentId,
            quantity: String(component.quantity),
            unit: component.unit,
          })),
        );
      }
    });

    return (await this.mapBomItems()).find((item) => item.id === id) ?? null;
  }

  async addBomComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }): Promise<BomItem | null> {
    const parsed = bomAddComponentRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const bom = await db
      .select({ id: bomItems.id, name: bomItems.name })
      .from(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
      .limit(1);
    if (bom.length === 0) {
      return null;
    }
    if (bom[0].name.startsWith('__shadow__')) {
      throw new Error("Cannot modify auto-generated shadow BoM");
    }

    // Validate component exists
    if (parsed.componentType === 'ingredient') {
      const exists = await db
        .select({ id: inventory.id })
        .from(inventory)
        .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, parsed.componentId)))
        .limit(1);
      if (exists.length === 0) throw new Error(`Ingredient ${parsed.componentId} not found`);
    } else {
      const exists = await db
        .select({ id: bomItems.id })
        .from(bomItems)
        .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, parsed.componentId)))
        .limit(1);
      if (exists.length === 0) throw new Error(`BoM ${parsed.componentId} not found`);
    }

    // Check duplicate
    const existing = await db
      .select()
      .from(bomComponents)
      .where(
        and(
          eq(bomComponents.tenantId, tenantId),
          eq(bomComponents.bomId, id),
          eq(bomComponents.componentType, parsed.componentType),
          eq(bomComponents.componentId, parsed.componentId),
        ),
      )
      .limit(1);
    if (existing.length > 0) throw new Error(`Component ${parsed.componentType}:${parsed.componentId} already exists in this BoM`);

    await db.insert(bomComponents).values({
      tenantId,
      bomId: id,
      componentType: parsed.componentType,
      componentId: parsed.componentId,
      quantity: String(parsed.quantity),
      unit: parsed.unit,
    });

    return (await this.mapBomItems()).find((item) => item.id === id) ?? null;
  }

  async removeBomComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string }): Promise<BomItem | null> {
    const parsed = bomRemoveComponentRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const bom = await db
      .select({ id: bomItems.id, name: bomItems.name })
      .from(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
      .limit(1);
    if (bom.length === 0) {
      return null;
    }
    if (bom[0].name.startsWith('__shadow__')) {
      throw new Error("Cannot modify auto-generated shadow BoM");
    }

    await db
      .delete(bomComponents)
      .where(
        and(
          eq(bomComponents.tenantId, tenantId),
          eq(bomComponents.bomId, id),
          eq(bomComponents.componentType, parsed.componentType),
          eq(bomComponents.componentId, parsed.componentId),
        ),
      );

    return (await this.mapBomItems()).find((item) => item.id === id) ?? null;
  }

  async deleteBomItem(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const existing = await db
      .select({ id: bomItems.id, name: bomItems.name })
      .from(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)))
      .limit(1);
    if (existing.length === 0) {
      return false;
    }

    if (existing[0].name.startsWith('__shadow__')) {
      throw new Error("Cannot delete auto-generated shadow BoM");
    }

    const nestedUsage = await db
      .select({ bomId: bomComponents.bomId })
      .from(bomComponents)
      .where(
        and(
          eq(bomComponents.tenantId, tenantId),
          eq(bomComponents.componentType, "bom"),
          eq(bomComponents.componentId, id),
        ),
      )
      .limit(1);
    if (nestedUsage.length > 0) {
      throw new Error("Cannot delete BoM linked to another BoM");
    }

    const menuUsage = await db
      .select({ menuItemId: menuItemBomRequirements.menuItemId })
      .from(menuItemBomRequirements)
      .where(and(eq(menuItemBomRequirements.tenantId, tenantId), eq(menuItemBomRequirements.bomId, id)))
      .limit(1);
    if (menuUsage.length > 0) {
      throw new Error("Cannot delete BoM linked to a menu recipe");
    }

    await db
      .delete(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, id)));
    return true;
  }

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

  async getEnabledModulesForTenant(tenantId: string): Promise<ModuleKey[]> {
    return this.getEnabledModulesRows(tenantId);
  }

  async listStaffAdmin(): Promise<StaffAdmin[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db.select().from(staff).where(eq(staff.tenantId, tenantId));
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
    const id = `s_${Date.now().toString(36)}`;
    const pinHash = await hashPin(parsed.pin);

    const inserted = await db
      .insert(staff)
      .values({
        id,
        tenantId,
        name: parsed.name,
        role: parsed.role,
        pin: pinHash,
        customPermissions: [],
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const row = inserted[0];
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      role: row.role as StaffAdmin["role"],
      isActive: row.isActive === 1,
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

    const updated = await db
      .update(staff)
      .set({
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.role ? { role: parsed.role } : {}),
        ...(parsed.customPermissions !== undefined ? { customPermissions: parsed.customPermissions } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
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
    const parsed = staffResetPinRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const pinHash = await hashPin(parsed.pin);
    const updated = await db
      .update(staff)
      .set({ pin: pinHash, updatedAt: new Date() })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, id)))
      .returning({ id: staff.id });

    return updated.length > 0;
  }

  async setStaffActiveState(id: string, isActive: boolean): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(staff)
      .set({ isActive: isActive ? 1 : 0, updatedAt: new Date() })
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, id)))
      .returning({ id: staff.id });

    return updated.length > 0;
  }

  async findStaffByCredentials(staffId: string, pin: string): Promise<Staff | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId), eq(staff.isActive, 1)))
      .limit(1);

    const found = rows[0];
    if (!found) {
      return null;
    }

    const isValidPin = await verifyPin(pin, found.pin);
    if (!isValidPin) {
      return null;
    }

    if (!isHashedPin(found.pin)) {
      const pinHash = await hashPin(pin);
      await db
        .update(staff)
        .set({ pin: pinHash, updatedAt: new Date() })
        .where(and(eq(staff.tenantId, tenantId), eq(staff.id, found.id)));
    }

    return {
      id: found.id,
      tenantId: found.tenantId,
      name: found.name,
      role: found.role as Staff["role"],
      customPermissions: (found.customPermissions as string[]) ?? [],
    };
  }

  async getStaffById(id: string): Promise<StaffAdmin | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }

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

  async findStaffById(staffId: string): Promise<Staff | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, staffId)))
      .limit(1);
    const found = rows[0];
    if (!found) {
      return null;
    }

    return {
      id: found.id,
      tenantId: found.tenantId,
      name: found.name,
      role: found.role as Staff["role"],
      customPermissions: (found.customPermissions as string[]) ?? [],
    };
  }

  async createAuthSession(payload: {
    id: string;
    tenantId: string;
    staffId: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await withTenantTx(async (tx) => {
      await tx.insert(authSessions).values({
        id: payload.id,
        tenantId: payload.tenantId,
        staffId: payload.staffId,
        refreshTokenHash: payload.refreshTokenHash,
        expiresAt: payload.expiresAt,
        createdAt: new Date(),
        revokedAt: null,
      });
    });
  }

  async findActiveSessionByRefreshHash(refreshTokenHash: string): Promise<StoredSession | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(authSessions)
      .where(and(eq(authSessions.tenantId, tenantId), eq(authSessions.refreshTokenHash, refreshTokenHash)))
      .limit(1);

    const found = rows[0];
    if (!found) {
      return null;
    }

    if (found.revokedAt || found.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return found;
  }

  async findActiveSessionById(sessionId: string, staffId: string, explicitTenantId?: string): Promise<StoredSession | null> {
    const tenantId = explicitTenantId ?? getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(authSessions)
      .where(and(eq(authSessions.tenantId, tenantId), eq(authSessions.id, sessionId), eq(authSessions.staffId, staffId)))
      .limit(1);

    const found = rows[0];
    if (!found) {
      return null;
    }

    if (found.revokedAt || found.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    return found;
  }

  async getPrintJobById(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(printJobs)
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id)))
      .limit(1);
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: printAreaSchema.parse(row.area),
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
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
  ): Promise<void> {
    const tenantId = getTenantIdOrDefault();
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
    const activeSession = await db
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(and(eq(authSessions.tenantId, tenantId), eq(authSessions.id, sessionId), isNull(authSessions.revokedAt)))
      .limit(1);

    if (activeSession.length === 0) {
      return false;
    }

    await this.revokeSessionById(sessionId);
    return true;
  }

  private mapConsumerUserRow(row: typeof consumerUsers.$inferSelect): ConsumerUser {
    return consumerUserSchema.parse({
      id: row.id,
      tenantId: row.tenantId,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      fullName: row.fullName,
      isActive: row.isActive === 1,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async getTenantBySlug(tenantSlug: string): Promise<{ id: string; slug: string } | null> {
    const rows = await db.select({ id: tenants.id, slug: tenants.slug }).from(tenants).where(eq(tenants.slug, tenantSlug)).limit(1);
    return rows[0] ?? null;
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
        updatedAt: now,
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
      revokedAt: null,
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
        createdAt: new Date(),
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
        selectedModifiers: parseSelectedModifiers(item.selectedModifiers),
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
          staffId: row.staffId,
        }),
      })),
    );
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
        customerRecord = await this.createOrReuseCustomer({
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

      await tx.insert(orderItems).values(
        order.items.map((item) => ({
          tenantId,
          orderId: order.id,
          menuItemId: item.id,
          name: item.name,
          price: String(item.price),
          quantity: item.quantity,
          ingredientOverrides: JSON.stringify(item.ingredientOverrides ?? []),
          notes: item.notes ?? null,
          selectedModifiers: JSON.stringify(item.selectedModifiers ?? []),
        })),
      );

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
              .select({ id: menuItems.id, name: menuItems.name, isActive: menuItems.isActive, defaultContainerId: menuItems.defaultContainerId })
              .from(menuItems)
              .where(and(eq(menuItems.tenantId, tenantId), inArray(menuItems.id, menuIds)))
          : [];

      const menuNameById = new Map(orderedMenuRows.map((row) => [row.id, row.name]));
      const menuDefaultContainerById = new Map(orderedMenuRows.map((row) => [row.id, row.defaultContainerId]));

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

      const links =
        menuIds.length > 0
          ? await tx
              .select()
              .from(menuItemIngredients)
              .where(and(eq(menuItemIngredients.tenantId, tenantId), inArray(menuItemIngredients.menuItemId, menuIds)))
          : [];

      const bomRequirements =
        menuIds.length > 0
          ? await tx
              .select()
              .from(menuItemBomRequirements)
              .where(and(eq(menuItemBomRequirements.tenantId, tenantId), inArray(menuItemBomRequirements.menuItemId, menuIds)))
          : [];

      const prepRequirements =
        menuIds.length > 0
          ? await tx
              .select()
              .from(menuItemPrepRequirements)
              .where(and(eq(menuItemPrepRequirements.tenantId, tenantId), inArray(menuItemPrepRequirements.menuItemId, menuIds)))
          : [];

      // Load modifier options with inventoryItemId for selectedModifiers deduction
      const modifierGroupIds = new Set<string>();
      const modifierOptionIds = new Set<string>();
      for (const item of order.items) {
        for (const mod of item.selectedModifiers ?? []) {
          modifierGroupIds.add(mod.groupId);
          modifierOptionIds.add(mod.optionId);
        }
      }

      let modifierOptionsByOptionId = new Map<string, { inventoryItemId: string | null; bomId: string | null }>();
      if (modifierOptionIds.size > 0) {
        const modOptionRows = await tx
          .select({ id: menuModifierOptions.id, inventoryItemId: menuModifierOptions.inventoryItemId, bomId: menuModifierOptions.bomId })
          .from(menuModifierOptions)
          .where(
            and(
              eq(menuModifierOptions.tenantId, tenantId),
              inArray(menuModifierOptions.id, [...modifierOptionIds]),
            ),
          );
        modifierOptionsByOptionId = new Map(
          modOptionRows.map((row) => [row.id, { inventoryItemId: row.inventoryItemId, bomId: row.bomId }]),
        );
      }

      // Load category pool options with inventoryItemId
      let poolOptionsByOptionId = new Map<string, { inventoryItemId: string | null }>();
      if (modifierOptionIds.size > 0) {
        const poolOptionRows = await tx
          .select({ id: categoryModifierPoolOptions.id, inventoryItemId: categoryModifierPoolOptions.inventoryItemId })
          .from(categoryModifierPoolOptions)
          .where(
            and(
              eq(categoryModifierPoolOptions.tenantId, tenantId),
              inArray(categoryModifierPoolOptions.id, [...modifierOptionIds]),
            ),
          );
        poolOptionsByOptionId = new Map(
          poolOptionRows.map((row) => [row.id, { inventoryItemId: row.inventoryItemId }]),
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

      const recipeCountByMenuId = new Map<string, number>();
      for (const link of links) {
        const current = recipeCountByMenuId.get(link.menuItemId) ?? 0;
        recipeCountByMenuId.set(link.menuItemId, current + 1);
      }
      for (const requirement of bomRequirements) {
        const current = recipeCountByMenuId.get(requirement.menuItemId) ?? 0;
        recipeCountByMenuId.set(requirement.menuItemId, current + 1);
      }

      // Check which menu items have modifier options with inventoryItemId (e.g., Heineken 33cl/66cl)
      const menuIdsWithModifierInventory = new Set<string>();
      for (const item of order.items) {
        for (const mod of item.selectedModifiers ?? []) {
          const modOption = modifierOptionsByOptionId.get(mod.optionId);
          const poolOption = poolOptionsByOptionId.get(mod.optionId);
          if (modOption?.inventoryItemId || poolOption?.inventoryItemId) {
            menuIdsWithModifierInventory.add(item.id);
            break;
          }
        }
      }

      const enabledModules = await this.getEnabledModulesRows(tenantId);
      const enforceRecipe = enabledModules.includes("inventory") && !enabledModules.includes("simple_catalog");

      // Allow menu items without recipe if they have modifier options with inventory links
      const menuItemWithoutRecipe = menuIds.find(
        (id) => (recipeCountByMenuId.get(id) ?? 0) === 0 && !menuIdsWithModifierInventory.has(id),
      );
      if (enforceRecipe && menuItemWithoutRecipe) {
        const name = menuNameById.get(menuItemWithoutRecipe) ?? order.items.find((i) => i.id === menuItemWithoutRecipe)?.name;
        throw new Error(`Menu item "${name ?? menuItemWithoutRecipe}" has no recipe configured`);
      }

      const bomIds = [...new Set(bomRequirements.map((row) => row.bomId))];
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

      const linksByMenuId = new Map<string, Array<{ ingredientId: string; quantity: number }>>();
      for (const link of links) {
        const existing = linksByMenuId.get(link.menuItemId) ?? [];
        existing.push({ ingredientId: link.ingredientId, quantity: Number(link.quantity) });
        linksByMenuId.set(link.menuItemId, existing);
      }

      const consumptionByIngredient = new Map<string, number>();
      const consumptionByPrep = new Map<string, number>();
      const inventoryRowsForValidation = await tx.select().from(inventory).where(eq(inventory.tenantId, tenantId));
      const inventoryNameById = new Map(inventoryRowsForValidation.map((row) => [row.id, row.name]));

      const prepByMenuId = new Map<string, Array<{ prepItemId: string; quantity: number }>>();
      for (const req of prepRequirements) {
        const existing = prepByMenuId.get(req.menuItemId) ?? [];
        existing.push({ prepItemId: req.prepItemId, quantity: toNumeric(req.quantity) });
        prepByMenuId.set(req.menuItemId, existing);
      }

      for (const item of order.items) {
        const baseIngredients = linksByMenuId.get(item.id) ?? [];
        const removedIngredientIds = new Set(
          (item.ingredientOverrides ?? []).filter((entry) => entry.action === "remove").map((entry) => entry.ingredientId),
        );
        const addedIngredientIds = (item.ingredientOverrides ?? [])
          .filter((entry) => entry.action === "add")
          .map((entry) => entry.ingredientId);

        for (const ingredientId of addedIngredientIds) {
          if (!inventoryNameById.has(ingredientId)) {
            const menuName = menuNameById.get(item.id) ?? item.name;
            throw new Error(`Ingredient ${ingredientId} not found in inventory (added to "${menuName}")`);
          }
        }

        for (const { ingredientId, quantity } of baseIngredients) {
          if (removedIngredientIds.has(ingredientId)) {
            continue;
          }
          const current = consumptionByIngredient.get(ingredientId) ?? 0;
          consumptionByIngredient.set(ingredientId, current + quantity * item.quantity);
        }
        for (const ingredientId of addedIngredientIds) {
          const current = consumptionByIngredient.get(ingredientId) ?? 0;
          consumptionByIngredient.set(ingredientId, current + 1 * item.quantity);
        }

        for (const mod of item.selectedModifiers ?? []) {
          const modOption = modifierOptionsByOptionId.get(mod.optionId);
          const poolOption = poolOptionsByOptionId.get(mod.optionId);
          const inventoryItemId = modOption?.inventoryItemId ?? poolOption?.inventoryItemId;
          if (inventoryItemId) {
            const current = consumptionByIngredient.get(inventoryItemId) ?? 0;
            consumptionByIngredient.set(inventoryItemId, current + 1 * item.quantity);
          }

          const overrides = overridesByOptionId.get(mod.optionId) ?? [];
          for (const override of overrides) {
            if (override.action === "add") {
              const current = consumptionByIngredient.get(override.ingredientId) ?? 0;
              consumptionByIngredient.set(override.ingredientId, current + 1 * item.quantity);
            } else if (override.action === "remove") {
              consumptionByIngredient.delete(override.ingredientId);
            }
          }
        }

        const prepReqs = prepByMenuId.get(item.id) ?? [];
        for (const req of prepReqs) {
          const current = consumptionByPrep.get(req.prepItemId) ?? 0;
          consumptionByPrep.set(req.prepItemId, current + req.quantity * item.quantity);
        }
      }

      const bomById = new Map<string, BomRow>();
      for (const bom of bomRows) {
        bomById.set(bom.id, bom);
      }

      const bomComponentsById = new Map<string, BomComponentRow[]>();
      for (const component of bomComponentRows) {
        const existing = bomComponentsById.get(component.bomId) ?? [];
        existing.push(component);
        bomComponentsById.set(component.bomId, existing);
      }

      const bomByMenuId = new Map<string, Array<{ bomId: string; quantity: number }>>();
      for (const requirement of bomRequirements) {
        const existing = bomByMenuId.get(requirement.menuItemId) ?? [];
        existing.push({ bomId: requirement.bomId, quantity: toNumeric(requirement.quantity) });
        bomByMenuId.set(requirement.menuItemId, existing);
      }

      for (const item of order.items) {
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
            consumptionByPrep.set(prepId, (consumptionByPrep.get(prepId) ?? 0) + qty);
          }
        }

        for (const mod of item.selectedModifiers ?? []) {
          const modOption = modifierOptionsByOptionId.get(mod.optionId);
          if (modOption?.bomId) {
            const exploded = this.explodeBomRequirements({
              bomId: modOption.bomId,
              multiplier: 1,
              bomById,
              componentsByBomId: bomComponentsById,
            });
            for (const [ingredientId, qty] of exploded.ingredients) {
              consumptionByIngredient.set(ingredientId, (consumptionByIngredient.get(ingredientId) ?? 0) + qty * item.quantity);
            }
            for (const [prepId, qty] of exploded.preps) {
              consumptionByPrep.set(prepId, (consumptionByPrep.get(prepId) ?? 0) + qty * item.quantity);
            }
          }
        }

        // Deduct default container (1 per item sold)
        const defaultContainerId = menuDefaultContainerById.get(item.id);
        if (defaultContainerId) {
          const current = consumptionByIngredient.get(defaultContainerId) ?? 0;
          consumptionByIngredient.set(defaultContainerId, current + 1 * item.quantity);
        }
      }

      const menuNamesByIngredientId = new Map<string, Set<string>>();
      const menuNamesByPrepId = new Map<string, Set<string>>();
      for (const item of order.items) {
        const menuName = menuNameById.get(item.id) ?? item.name;
        const baseIngredients = linksByMenuId.get(item.id) ?? [];
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
        const prepReqs = prepByMenuId.get(item.id) ?? [];
        for (const req of prepReqs) {
          const existing = menuNamesByPrepId.get(req.prepItemId) ?? new Set();
          existing.add(menuName);
          menuNamesByPrepId.set(req.prepItemId, existing);
        }
        const defaultContainerId = menuDefaultContainerById.get(item.id);
        if (defaultContainerId) {
          const existing = menuNamesByIngredientId.get(defaultContainerId) ?? new Set();
          existing.add(menuName);
          menuNamesByIngredientId.set(defaultContainerId, existing);
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
        isContainer: row.isContainer ?? 0,
      }));
    });

    await this.createPrintJobsForOrder(order);

    return { order, inventory: updatedInventory };
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

      // Fetch BoM data needed for explosion (same as createOrder)
      const menuIds = [...new Set(itemRows.map((item) => item.menuItemId))];
      const [bomReqLinks, ingredientLinks, prepReqLinks, menuContainerRows] = menuIds.length > 0
        ? await Promise.all([
            tx.select().from(menuItemBomRequirements)
              .where(and(eq(menuItemBomRequirements.tenantId, tenantId), inArray(menuItemBomRequirements.menuItemId, menuIds))),
            tx.select().from(menuItemIngredients)
              .where(and(eq(menuItemIngredients.tenantId, tenantId), inArray(menuItemIngredients.menuItemId, menuIds))),
            tx.select().from(menuItemPrepRequirements)
              .where(and(eq(menuItemPrepRequirements.tenantId, tenantId), inArray(menuItemPrepRequirements.menuItemId, menuIds))),
            tx.select({ id: menuItems.id, defaultContainerId: menuItems.defaultContainerId })
              .from(menuItems)
              .where(and(eq(menuItems.tenantId, tenantId), inArray(menuItems.id, menuIds))),
          ])
        : [[], [], [], []];

      const menuDefaultContainerById = new Map(menuContainerRows.map((row) => [row.id, row.defaultContainerId]));

      const bomIds = [...new Set(bomReqLinks.map((r) => r.bomId))];
      let bomRowsData: BomRow[] = [];
      let bomComponentRowsData: BomComponentRow[] = [];

      if (bomIds.length > 0) {
        const visitedBomIds = new Set<string>();
        const pendingBomIds = [...bomIds];

        while (pendingBomIds.length > 0) {
          const batch = pendingBomIds.splice(0);
          for (const id of batch) visitedBomIds.add(id);

          const [rows, componentRows] = await Promise.all([
            tx.select().from(bomItems).where(and(eq(bomItems.tenantId, tenantId), inArray(bomItems.id, batch))),
            tx.select().from(bomComponents).where(and(eq(bomComponents.tenantId, tenantId), inArray(bomComponents.bomId, batch))),
          ]);

          bomRowsData.push(...rows);
          bomComponentRowsData.push(...componentRows);

          for (const comp of componentRows) {
            if (comp.componentType === "bom" && !visitedBomIds.has(comp.componentId)) {
              pendingBomIds.push(comp.componentId);
            }
          }
        }
      }

      const bomById = new Map(bomRowsData.map((b) => [b.id, b]));
      const bomComponentsById = new Map<string, typeof bomComponentRowsData>();
      for (const comp of bomComponentRowsData) {
        const existing = bomComponentsById.get(comp.bomId) ?? [];
        existing.push(comp);
        bomComponentsById.set(comp.bomId, existing);
      }

      // Build links by menu ID for direct ingredients (with quantity)
      const ingredientLinksByMenuId = new Map<string, Array<{ ingredientId: string; quantity: number }>>();
      for (const link of ingredientLinks) {
        const existing = ingredientLinksByMenuId.get(link.menuItemId) ?? [];
        existing.push({ ingredientId: link.ingredientId, quantity: Number(link.quantity) });
        ingredientLinksByMenuId.set(link.menuItemId, existing);
      }

      const bomByMenuId = new Map<string, Array<{ bomId: string; quantity: number }>>();
      for (const req of bomReqLinks) {
        const existing = bomByMenuId.get(req.menuItemId) ?? [];
        existing.push({ bomId: req.bomId, quantity: toNumeric(req.quantity) });
        bomByMenuId.set(req.menuItemId, existing);
      }

      const prepByMenuId = new Map<string, Array<{ prepItemId: string; quantity: number }>>();
      for (const req of prepReqLinks) {
        const existing = prepByMenuId.get(req.menuItemId) ?? [];
        existing.push({ prepItemId: req.prepItemId, quantity: toNumeric(req.quantity) });
        prepByMenuId.set(req.menuItemId, existing);
      }

      const restoreByIngredient = new Map<string, number>();
      const restoreByPrep = new Map<string, number>();
      const inventoryIdsToRestore = new Set<string>();
      const prepIdsToRestore = new Set<string>();

      for (const item of itemRows) {
        const removedIngredientIds = new Set(
          parseIngredientOverrides(item.ingredientOverrides)
            .filter((entry) => entry.action === "remove")
            .map((entry) => entry.ingredientId),
        );
        const addedIngredientIds = parseIngredientOverrides(item.ingredientOverrides)
          .filter((entry) => entry.action === "add")
          .map((entry) => entry.ingredientId);

        const baseIngredients = ingredientLinksByMenuId.get(item.menuItemId) ?? [];
        for (const { ingredientId, quantity } of baseIngredients) {
          if (!removedIngredientIds.has(ingredientId)) {
            const delta = quantity * item.quantity;
            restoreByIngredient.set(ingredientId, (restoreByIngredient.get(ingredientId) ?? 0) + delta);
            inventoryIdsToRestore.add(ingredientId);
          }
        }

        for (const addedIngredientId of addedIngredientIds) {
          restoreByIngredient.set(addedIngredientId, (restoreByIngredient.get(addedIngredientId) ?? 0) + 1 * item.quantity);
          inventoryIdsToRestore.add(addedIngredientId);
        }

        const requirements = bomByMenuId.get(item.menuItemId) ?? [];
        for (const requirement of requirements) {
          const exploded = this.explodeBomRequirements({
            bomId: requirement.bomId,
            multiplier: requirement.quantity * item.quantity,
            bomById,
            componentsByBomId: bomComponentsById,
          });

          for (const [ingredientId, qty] of exploded.ingredients) {
            restoreByIngredient.set(ingredientId, (restoreByIngredient.get(ingredientId) ?? 0) + qty);
            inventoryIdsToRestore.add(ingredientId);
          }
          for (const [prepId, qty] of exploded.preps) {
            restoreByPrep.set(prepId, (restoreByPrep.get(prepId) ?? 0) + qty);
            prepIdsToRestore.add(prepId);
          }
        }

        const prepReqs = prepByMenuId.get(item.menuItemId) ?? [];
        for (const req of prepReqs) {
          restoreByPrep.set(req.prepItemId, (restoreByPrep.get(req.prepItemId) ?? 0) + req.quantity * item.quantity);
          prepIdsToRestore.add(req.prepItemId);
        }

        // Restore default container
        const defaultContainerId = menuDefaultContainerById.get(item.menuItemId);
        if (defaultContainerId) {
          restoreByIngredient.set(defaultContainerId, (restoreByIngredient.get(defaultContainerId) ?? 0) + 1 * item.quantity);
          inventoryIdsToRestore.add(defaultContainerId);
        }

        const parsedMods = parseSelectedModifiers(item.selectedModifiers);
        const modOptIds = parsedMods.map((m) => m.optionId);
        if (modOptIds.length > 0) {
          const modOptionRows = await tx
            .select({ id: menuModifierOptions.id, inventoryItemId: menuModifierOptions.inventoryItemId, bomId: menuModifierOptions.bomId })
            .from(menuModifierOptions)
            .where(and(eq(menuModifierOptions.tenantId, tenantId), inArray(menuModifierOptions.id, modOptIds)));
          const modOptMap = new Map(modOptionRows.map((r) => [r.id, r]));

          const poolOptionRows = await tx
            .select({ id: categoryModifierPoolOptions.id, inventoryItemId: categoryModifierPoolOptions.inventoryItemId })
            .from(categoryModifierPoolOptions)
            .where(and(eq(categoryModifierPoolOptions.tenantId, tenantId), inArray(categoryModifierPoolOptions.id, modOptIds)));
          const poolOptMap = new Map(poolOptionRows.map((r) => [r.id, r]));

          const overrideRows = await tx
            .select()
            .from(menuModifierOptionOverrides)
            .where(and(eq(menuModifierOptionOverrides.tenantId, tenantId), inArray(menuModifierOptionOverrides.optionId, modOptIds)));
          const overrideMap = new Map<string, Array<{ ingredientId: string; action: string }>>();
          for (const row of overrideRows) {
            const existing = overrideMap.get(row.optionId) ?? [];
            existing.push({ ingredientId: row.ingredientId, action: row.action });
            overrideMap.set(row.optionId, existing);
          }

          for (const optId of modOptIds) {
            const opt = modOptMap.get(optId);
            const poolOpt = poolOptMap.get(optId);
            const inventoryItemId = opt?.inventoryItemId ?? poolOpt?.inventoryItemId;
            if (inventoryItemId) {
              restoreByIngredient.set(inventoryItemId, (restoreByIngredient.get(inventoryItemId) ?? 0) + 1 * item.quantity);
              inventoryIdsToRestore.add(inventoryItemId);
            }
            if (opt?.bomId) {
              const exploded = this.explodeBomRequirements({
                bomId: opt.bomId,
                multiplier: 1,
                bomById,
                componentsByBomId: bomComponentsById,
              });
              for (const [ingredientId, qty] of exploded.ingredients) {
                restoreByIngredient.set(ingredientId, (restoreByIngredient.get(ingredientId) ?? 0) + qty * item.quantity);
                inventoryIdsToRestore.add(ingredientId);
              }
              for (const [prepId, qty] of exploded.preps) {
                restoreByPrep.set(prepId, (restoreByPrep.get(prepId) ?? 0) + qty * item.quantity);
                prepIdsToRestore.add(prepId);
              }
            }

            const overrides = overrideMap.get(optId) ?? [];
            for (const override of overrides) {
              if (override.action === "add") {
                restoreByIngredient.delete(override.ingredientId);
              } else if (override.action === "remove") {
                const current = restoreByIngredient.get(override.ingredientId) ?? 0;
                restoreByIngredient.set(override.ingredientId, current + 1 * item.quantity);
                inventoryIdsToRestore.add(override.ingredientId);
              }
            }
          }
        }
      }

      if (inventoryIdsToRestore.size > 0) {
        const inventoryRows = await tx
          .select()
          .from(inventory)
          .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, [...inventoryIdsToRestore])));

        const inventoryMap = new Map(inventoryRows.map((r) => [r.id, r]));

        for (const [ingredientId, delta] of restoreByIngredient) {
          const row = inventoryMap.get(ingredientId);
          if (!row) continue;
          const previousQty = Number(row.quantity);
          const restoredQty = previousQty + delta;
          await tx
            .update(inventory)
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

      if (prepIdsToRestore.size > 0) {
        const prepRows = await tx
          .select()
          .from(prepItems)
          .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, [...prepIdsToRestore])));

        const prepMap = new Map(prepRows.map((r) => [r.id, r]));

        for (const [prepId, delta] of restoreByPrep) {
          const row = prepMap.get(prepId);
          if (!row) continue;
          const previousQty = Number(row.stockQuantity);
          const restoredQty = previousQty + delta;
          await tx
            .update(prepItems)
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

  async closeTable(
    tableId: string,
    payload: CloseTableRequest,
    actorStaffId: string,
  ): Promise<CloseTableResponse | null> {
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

  async paySelectedItems(
    tableId: string,
    payload: PaySelectedItemsRequest,
    actorStaffId: string,
  ): Promise<PaySelectedItemsResponse | null> {
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

  async markShareAsPaid(
    tableId: string,
    shareIndex: number,
    payload: MarkShareAsPaidRequest,
    actorStaffId: string,
  ): Promise<MarkShareAsPaidResponse | null> {
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

  async getTablePaymentStatus(tableId: string): Promise<{
    items: Array<{
      orderItemId: number;
      name: string;
      price: number;
      totalQuantity: number;
      paidQuantity: number;
      availableQuantity: number;
      fullyPaid: boolean;
    }>;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    splitShares?: Array<{
      shareIndex: number;
      amount: number;
      method: string;
      gatewayReference: string | null;
      isPaid: boolean;
      paymentId: string;
    }>;
  } | null> {
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

  async listMenuItemsAdmin(): Promise<MenuItemAdmin[]> {
    return this.mapMenuItemsAdmin();
  }

  async createMenuItem(payload: MenuItemCreateRequest): Promise<MenuItemAdmin> {
    const parsed = menuItemCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const recipeKeys = new Set<string>();
    for (const component of parsed.recipe) {
      const key = `${component.componentType}:${component.componentId}`;
      if (recipeKeys.has(key)) {
        throw new Error(`Duplicate recipe component ${key}`);
      }

      if (component.componentId === "ingredient" || component.componentId === "bom") {
        throw new Error(`Invalid recipe component id ${component.componentId}`);
      }
      recipeKeys.add(key);
    }

    const ingredientIds = parsed.recipe.filter((item) => item.componentType === "ingredient").map((item) => item.componentId);
    const bomIds = parsed.recipe.filter((item) => item.componentType === "bom").map((item) => item.componentId);
    const prepIds = parsed.recipe.filter((item) => item.componentType === "prep").map((item) => item.componentId);

    if (ingredientIds.length > 0) {
      const rows = await db
        .select({ id: inventory.id })
        .from(inventory)
        .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, ingredientIds)));
      if (rows.length !== new Set(ingredientIds).size) {
        const found = new Set(rows.map((row) => row.id));
        const missing = ingredientIds.find((id) => !found.has(id));
        throw new Error(`Ingredient ${missing ?? "unknown"} not found`);
      }
    }

    if (bomIds.length > 0) {
      const rows = await db
        .select({ id: bomItems.id })
        .from(bomItems)
        .where(and(eq(bomItems.tenantId, tenantId), inArray(bomItems.id, bomIds)));
      if (rows.length !== new Set(bomIds).size) {
        const found = new Set(rows.map((row) => row.id));
        const missing = bomIds.find((id) => !found.has(id));
        throw new Error(`BoM ${missing ?? "unknown"} not found`);
      }
    }

    if (prepIds.length > 0) {
      const rows = await db
        .select({ id: prepItems.id })
        .from(prepItems)
        .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, prepIds)));
      if (rows.length !== new Set(prepIds).size) {
        const found = new Set(rows.map((row) => row.id));
        const missing = prepIds.find((id) => !found.has(id));
        throw new Error(`Prep item ${missing ?? "unknown"} not found`);
      }
    }

    const menuId = `m_${Date.now().toString(36)}`;
    await withTenantTx(async (tx) => {
      await tx.insert(menuItems).values({
        id: menuId,
        tenantId,
        name: parsed.name,
        price: String(parsed.price),
        category: parsed.category,
        categoryId: parsed.categoryId ?? null,
        printAreas: JSON.stringify(parsed.printAreas),
        isActive: 1,
      });

      const ingredientComponents = parsed.recipe.filter((item) => item.componentType === "ingredient");
      const bomComponentsPayload = parsed.recipe.filter((item) => item.componentType === "bom");
      const prepComponentsPayload = parsed.recipe.filter((item) => item.componentType === "prep");

      if (ingredientComponents.length > 0) {
        await tx.insert(menuItemIngredients).values(
          ingredientComponents.map((component) => ({
            tenantId,
            menuItemId: menuId,
            ingredientId: component.componentId,
            quantity: String(component.quantity),
            unit: component.unit,
          })),
        );
      }

      if (bomComponentsPayload.length > 0) {
        await tx.insert(menuItemBomRequirements).values(
          bomComponentsPayload.map((component) => ({
            tenantId,
            menuItemId: menuId,
            bomId: component.componentId,
            quantity: String(component.quantity),
            unit: component.unit,
          })),
        );
      }

      if (prepComponentsPayload.length > 0) {
        await tx.insert(menuItemPrepRequirements).values(
          prepComponentsPayload.map((component) => ({
            tenantId,
            menuItemId: menuId,
            prepItemId: component.componentId,
            quantity: String(component.quantity),
          })),
        );
      }

      if (parsed.modifiers && parsed.modifiers.length > 0) {
        await tx.insert(menuItemModifiers).values(
          parsed.modifiers.map((mod, idx) => ({
            id: `mim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            tenantId,
            menuItemId: menuId,
            inventoryItemId: mod.inventoryItemId,
            priceDelta: String(mod.priceDelta),
            sortOrder: idx,
          })),
        );
      }

      if (parsed.modifierGroups && parsed.modifierGroups.length > 0) {
        for (let groupIdx = 0; groupIdx < parsed.modifierGroups.length; groupIdx++) {
          const group = parsed.modifierGroups[groupIdx];
          const groupId = group.id || `mg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

          await tx.insert(menuModifierGroups).values({
            id: groupId,
            tenantId,
            menuItemId: menuId,
            name: group.name,
            required: group.required ? 1 : 0,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            sortOrder: groupIdx,
          });

          for (let optIdx = 0; optIdx < group.options.length; optIdx++) {
            const opt = group.options[optIdx];
            const optId = opt.id || `mo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

            await tx.insert(menuModifierOptions).values({
              id: optId,
              tenantId,
              groupId,
              name: opt.name,
              inventoryItemId: opt.inventoryItemId || null,
              priceDelta: String(opt.priceDelta),
              isDefault: opt.isDefault ? 1 : 0,
              isActive: opt.isActive ? 1 : 0,
              sortOrder: optIdx,
            });

            for (const override of opt.ingredientOverrides) {
              await tx.insert(menuModifierOptionOverrides).values({
                id: `moo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
                tenantId,
                optionId: optId,
                ingredientId: override.ingredientId,
                action: override.action,
              });
            }
          }
        }
      }

      await this.syncShadowBoM(tx, tenantId, menuId, parsed.recipe, parsed.categoryId ?? null);
    });

    const created = (await this.mapMenuItemsAdmin()).find((item) => item.id === menuId);
    if (!created) {
      throw new Error("Failed to create menu item");
    }

    return created;
  }

  async updateMenuItem(id: string, payload: MenuItemUpdateRequest): Promise<MenuItemAdmin | null> {
    const parsed = menuItemUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const updated = await db
      .update(menuItems)
      .set({
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.category ? { category: parsed.category } : {}),
        ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
        ...(parsed.defaultContainerId !== undefined ? { defaultContainerId: parsed.defaultContainerId } : {}),
        ...(parsed.printAreas ? { printAreas: JSON.stringify(parsed.printAreas) } : {}),
        ...(parsed.price !== undefined ? { price: String(parsed.price) } : {}),
      })
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .returning({ id: menuItems.id });

    if (updated.length === 0) {
      return null;
    }

    if (parsed.modifiers) {
      await withTenantTx(async (tx) => {
        await tx.delete(menuItemModifiers).where(
          and(eq(menuItemModifiers.tenantId, tenantId), eq(menuItemModifiers.menuItemId, id)),
        );
        for (let idx = 0; idx < parsed.modifiers!.length; idx++) {
          const mod = parsed.modifiers![idx];
          await tx.insert(menuItemModifiers).values({
            id: `mim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            tenantId,
            menuItemId: id,
            inventoryItemId: mod.inventoryItemId,
            priceDelta: String(mod.priceDelta),
            sortOrder: idx,
          });
        }
      });
    }

    if (parsed.modifierGroups !== undefined) {
      await withTenantTx(async (tx) => {
        // Elimina tutti i modifier groups esistenti per questo menu item
        const existingGroups = await tx
          .select({ id: menuModifierGroups.id })
          .from(menuModifierGroups)
          .where(and(eq(menuModifierGroups.tenantId, tenantId), eq(menuModifierGroups.menuItemId, id)));

        for (const group of existingGroups) {
          // Elimina overrides delle opzioni
          const options = await tx
            .select({ id: menuModifierOptions.id })
            .from(menuModifierOptions)
            .where(eq(menuModifierOptions.groupId, group.id));

          for (const opt of options) {
            await tx
              .delete(menuModifierOptionOverrides)
              .where(eq(menuModifierOptionOverrides.optionId, opt.id));
          }

          // Elimina opzioni
          await tx.delete(menuModifierOptions).where(eq(menuModifierOptions.groupId, group.id));
        }

        // Elimina gruppi
        await tx
          .delete(menuModifierGroups)
          .where(and(eq(menuModifierGroups.tenantId, tenantId), eq(menuModifierGroups.menuItemId, id)));

        // Inserisci nuovi gruppi
        for (let groupIdx = 0; groupIdx < parsed.modifierGroups!.length; groupIdx++) {
          const group = parsed.modifierGroups![groupIdx];
          const groupId = group.id || `mg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

          await tx.insert(menuModifierGroups).values({
            id: groupId,
            tenantId,
            menuItemId: id,
            name: group.name,
            required: group.required ? 1 : 0,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            sortOrder: groupIdx,
          });

          // Inserisci opzioni
          for (let optIdx = 0; optIdx < group.options.length; optIdx++) {
            const opt = group.options[optIdx];
            const optId = opt.id || `mo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

            await tx.insert(menuModifierOptions).values({
              id: optId,
              tenantId,
              groupId,
              name: opt.name,
              inventoryItemId: opt.inventoryItemId || null,
              priceDelta: String(opt.priceDelta),
              isDefault: opt.isDefault ? 1 : 0,
              isActive: opt.isActive ? 1 : 0,
              sortOrder: optIdx,
            });

            // Inserisci overrides
            for (const override of opt.ingredientOverrides) {
              await tx.insert(menuModifierOptionOverrides).values({
                id: `moo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
                tenantId,
                optionId: optId,
                ingredientId: override.ingredientId,
                action: override.action,
              });
            }
          }
        }
      });
    }

    return (await this.mapMenuItemsAdmin()).find((item) => item.id === id) ?? null;
  }

  async replaceMenuItemRecipe(id: string, payload: MenuItemReplaceRecipeRequest): Promise<MenuItemAdmin | null> {
    const parsed = menuItemReplaceRecipeRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const exists = await db
      .select({ id: menuItems.id, categoryId: menuItems.categoryId })
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .limit(1);
    if (exists.length === 0) {
      return null;
    }
    const existingCategoryId = exists[0].categoryId;

    const recipeKeys = new Set<string>();
    for (const component of parsed.recipe) {
      const key = `${component.componentType}:${component.componentId}`;
      if (recipeKeys.has(key)) {
        throw new Error(`Duplicate recipe component ${key}`);
      }

      if (component.componentId === "ingredient" || component.componentId === "bom") {
        throw new Error(`Invalid recipe component id ${component.componentId}`);
      }
      recipeKeys.add(key);
    }

    const ingredientIds = parsed.recipe.filter((item) => item.componentType === "ingredient").map((item) => item.componentId);
    const bomIds = parsed.recipe.filter((item) => item.componentType === "bom").map((item) => item.componentId);
    const prepIds = parsed.recipe.filter((item) => item.componentType === "prep").map((item) => item.componentId);

    if (ingredientIds.length > 0) {
      const rows = await db
        .select({ id: inventory.id })
        .from(inventory)
        .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, ingredientIds)));
      if (rows.length !== new Set(ingredientIds).size) {
        const found = new Set(rows.map((row) => row.id));
        const missing = ingredientIds.find((entryId) => !found.has(entryId));
        throw new Error(`Ingredient ${missing ?? "unknown"} not found`);
      }
    }

    if (bomIds.length > 0) {
      const rows = await db
        .select({ id: bomItems.id })
        .from(bomItems)
        .where(and(eq(bomItems.tenantId, tenantId), inArray(bomItems.id, bomIds)));
      if (rows.length !== new Set(bomIds).size) {
        const found = new Set(rows.map((row) => row.id));
        const missing = bomIds.find((entryId) => !found.has(entryId));
        throw new Error(`BoM ${missing ?? "unknown"} not found`);
      }
    }

    if (prepIds.length > 0) {
      const rows = await db
        .select({ id: prepItems.id })
        .from(prepItems)
        .where(and(eq(prepItems.tenantId, tenantId), inArray(prepItems.id, prepIds)));
      if (rows.length !== new Set(prepIds).size) {
        const found = new Set(rows.map((row) => row.id));
        const missing = prepIds.find((entryId) => !found.has(entryId));
        throw new Error(`Prep item ${missing ?? "unknown"} not found`);
      }
    }

    await withTenantTx(async (tx) => {
      await tx
        .delete(menuItemIngredients)
        .where(and(eq(menuItemIngredients.tenantId, tenantId), eq(menuItemIngredients.menuItemId, id)));
      await tx
        .delete(menuItemBomRequirements)
        .where(and(eq(menuItemBomRequirements.tenantId, tenantId), eq(menuItemBomRequirements.menuItemId, id)));
      await tx
        .delete(menuItemPrepRequirements)
        .where(and(eq(menuItemPrepRequirements.tenantId, tenantId), eq(menuItemPrepRequirements.menuItemId, id)));

      const ingredientComponents = parsed.recipe.filter((item) => item.componentType === "ingredient");
      const bomComponentsPayload = parsed.recipe.filter((item) => item.componentType === "bom");
      const prepComponentsPayload = parsed.recipe.filter((item) => item.componentType === "prep");

      if (ingredientComponents.length > 0) {
        await tx.insert(menuItemIngredients).values(
          ingredientComponents.map((component) => ({
            tenantId,
            menuItemId: id,
            ingredientId: component.componentId,
            quantity: String(component.quantity),
            unit: component.unit,
          })),
        );
      }

      if (bomComponentsPayload.length > 0) {
        await tx.insert(menuItemBomRequirements).values(
          bomComponentsPayload.map((component) => ({
            tenantId,
            menuItemId: id,
            bomId: component.componentId,
            quantity: String(component.quantity),
            unit: component.unit,
          })),
        );
      }

      if (prepComponentsPayload.length > 0) {
        await tx.insert(menuItemPrepRequirements).values(
          prepComponentsPayload.map((component) => ({
            tenantId,
            menuItemId: id,
            prepItemId: component.componentId,
            quantity: String(component.quantity),
          })),
        );
      }

      await this.syncShadowBoM(tx, tenantId, id, parsed.recipe, existingCategoryId);
    });

    return (await this.mapMenuItemsAdmin()).find((item) => item.id === id) ?? null;
  }

  async addMenuItemRecipeComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string; quantity: number; unit: string }): Promise<MenuItemAdmin | null> {
    const parsed = menuItemAddRecipeComponentRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const exists = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .limit(1);
    if (exists.length === 0) return null;

    if (parsed.componentType === 'ingredient') {
      const row = await db
        .select({ id: inventory.id })
        .from(inventory)
        .where(and(eq(inventory.tenantId, tenantId), eq(inventory.id, parsed.componentId)))
        .limit(1);
      if (row.length === 0) throw new Error(`Ingredient ${parsed.componentId} not found`);
    } else if (parsed.componentType === 'bom') {
      const row = await db
        .select({ id: bomItems.id })
        .from(bomItems)
        .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.id, parsed.componentId)))
        .limit(1);
      if (row.length === 0) throw new Error(`BoM ${parsed.componentId} not found`);
    } else {
      const row = await db
        .select({ id: prepItems.id })
        .from(prepItems)
        .where(and(eq(prepItems.tenantId, tenantId), eq(prepItems.id, parsed.componentId)))
        .limit(1);
      if (row.length === 0) throw new Error(`Prep item ${parsed.componentId} not found`);
    }

    await withTenantTx(async (tx) => {
      if (parsed.componentType === 'ingredient') {
        const existing = await tx
          .select()
          .from(menuItemIngredients)
          .where(and(eq(menuItemIngredients.tenantId, tenantId), eq(menuItemIngredients.menuItemId, id), eq(menuItemIngredients.ingredientId, parsed.componentId)))
          .limit(1);
        if (existing.length > 0) throw new Error(`Ingredient ${parsed.componentId} already in recipe`);
        await tx.insert(menuItemIngredients).values({ tenantId, menuItemId: id, ingredientId: parsed.componentId, quantity: String(parsed.quantity), unit: parsed.unit });
      } else if (parsed.componentType === 'bom') {
        const existing = await tx
          .select()
          .from(menuItemBomRequirements)
          .where(and(eq(menuItemBomRequirements.tenantId, tenantId), eq(menuItemBomRequirements.menuItemId, id), eq(menuItemBomRequirements.bomId, parsed.componentId)))
          .limit(1);
        if (existing.length > 0) throw new Error(`BoM ${parsed.componentId} already in recipe`);
        await tx.insert(menuItemBomRequirements).values({ tenantId, menuItemId: id, bomId: parsed.componentId, quantity: String(parsed.quantity), unit: parsed.unit });
      } else {
        const existing = await tx
          .select()
          .from(menuItemPrepRequirements)
          .where(and(eq(menuItemPrepRequirements.tenantId, tenantId), eq(menuItemPrepRequirements.menuItemId, id), eq(menuItemPrepRequirements.prepItemId, parsed.componentId)))
          .limit(1);
        if (existing.length > 0) throw new Error(`Prep item ${parsed.componentId} already in recipe`);
        await tx.insert(menuItemPrepRequirements).values({ tenantId, menuItemId: id, prepItemId: parsed.componentId, quantity: String(parsed.quantity) });
      }

      const shadowBomId = await this.findShadowBoMId(id);
      if (shadowBomId) {
        const currentRows = await tx
          .select()
          .from(bomComponents)
          .where(and(eq(bomComponents.tenantId, tenantId), eq(bomComponents.bomId, shadowBomId)));
        const recipe = currentRows.map((r) => ({ componentType: r.componentType, componentId: r.componentId, quantity: Number(r.quantity), unit: r.unit }));
        recipe.push({ componentType: parsed.componentType, componentId: parsed.componentId, quantity: parsed.quantity, unit: parsed.unit });
        const menuRow = await tx.select({ categoryId: menuItems.categoryId }).from(menuItems).where(eq(menuItems.id, id)).limit(1);
        await this.syncShadowBoM(tx, tenantId, id, recipe, menuRow[0]?.categoryId ?? null);
      }
    });

    return (await this.mapMenuItemsAdmin()).find((item) => item.id === id) ?? null;
  }

  async removeMenuItemRecipeComponent(id: string, payload: { componentType: 'ingredient' | 'bom' | 'prep'; componentId: string }): Promise<MenuItemAdmin | null> {
    const parsed = menuItemRemoveRecipeComponentRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const exists = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .limit(1);
    if (exists.length === 0) return null;

    await withTenantTx(async (tx) => {
      if (parsed.componentType === 'ingredient') {
        await tx.delete(menuItemIngredients).where(and(eq(menuItemIngredients.tenantId, tenantId), eq(menuItemIngredients.menuItemId, id), eq(menuItemIngredients.ingredientId, parsed.componentId)));
      } else if (parsed.componentType === 'bom') {
        await tx.delete(menuItemBomRequirements).where(and(eq(menuItemBomRequirements.tenantId, tenantId), eq(menuItemBomRequirements.menuItemId, id), eq(menuItemBomRequirements.bomId, parsed.componentId)));
      } else {
        await tx.delete(menuItemPrepRequirements).where(and(eq(menuItemPrepRequirements.tenantId, tenantId), eq(menuItemPrepRequirements.menuItemId, id), eq(menuItemPrepRequirements.prepItemId, parsed.componentId)));
      }

      const shadowBomId = await this.findShadowBoMId(id);
      if (shadowBomId) {
        const currentRows = await tx
          .select()
          .from(bomComponents)
          .where(and(eq(bomComponents.tenantId, tenantId), eq(bomComponents.bomId, shadowBomId)));
        const recipe = currentRows
          .filter((r) => !(r.componentType === parsed.componentType && r.componentId === parsed.componentId))
          .map((r) => ({ componentType: r.componentType, componentId: r.componentId, quantity: Number(r.quantity), unit: r.unit }));
        const menuRow = await tx.select({ categoryId: menuItems.categoryId }).from(menuItems).where(eq(menuItems.id, id)).limit(1);
        await this.syncShadowBoM(tx, tenantId, id, recipe, menuRow[0]?.categoryId ?? null);
      }
    });

    return (await this.mapMenuItemsAdmin()).find((item) => item.id === id) ?? null;
  }

  async setMenuItemActiveState(id: string, active: boolean): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(menuItems)
      .set({ isActive: active ? 1 : 0 })
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .returning({ id: menuItems.id });

    return updated.length > 0;
  }

  async deleteMenuItem(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const existing = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .limit(1);
    if (existing.length === 0) {
      return false;
    }

    await db
      .delete(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)));

    await this.deleteShadowBoM(id);
    return true;
  }

  async listSimpleCatalogItems(): Promise<MenuItem[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.isActive, 1)));

    return rows.map((row) =>
      menuItemSchema.parse({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        category: row.category,
        printAreas: parsePrintAreas(row.printAreas),
        ingredients: [],
      }),
    );
  }

  async createSimpleCatalogItem(payload: Omit<MenuItemCreateRequest, "recipe"> & { recipe?: unknown }): Promise<MenuItem> {
    const tenantId = getTenantIdOrDefault();
    const menuId = `m_${Date.now().toString(36)}`;

    await db.insert(menuItems).values({
      id: menuId,
      tenantId,
      name: payload.name,
      price: String(payload.price),
      category: payload.category,
      categoryId: payload.categoryId ?? null,
      printAreas: JSON.stringify(payload.printAreas ?? ["kitchen"]),
      isActive: 1,
    });

    const created = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, menuId)))
      .limit(1);

    if (created.length === 0) {
      throw new Error("Failed to create simple catalog item");
    }

    const row = created[0];
    return menuItemSchema.parse({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      printAreas: parsePrintAreas(row.printAreas),
      ingredients: [],
    });
  }

  async updateSimpleCatalogItem(id: string, payload: MenuItemUpdateRequest): Promise<MenuItem | null> {
    const parsed = menuItemUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const updated = await db
      .update(menuItems)
      .set({
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.category ? { category: parsed.category } : {}),
        ...(parsed.categoryId !== undefined ? { categoryId: parsed.categoryId } : {}),
        ...(parsed.printAreas ? { printAreas: JSON.stringify(parsed.printAreas) } : {}),
        ...(parsed.price !== undefined ? { price: String(parsed.price) } : {}),
      })
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return menuItemSchema.parse({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      category: row.category,
      printAreas: parsePrintAreas(row.printAreas),
      ingredients: [],
    });
  }

  async listPayments(filters: PaymentFilters): Promise<PaymentsListResponse> {
    const parsed = paymentFiltersSchema.parse(filters);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [];

    conditions.push(eq(payments.tenantId, tenantId));

    if (parsed.from) {
      conditions.push(gte(payments.createdAt, new Date(parsed.from)));
    }

    if (parsed.to) {
      conditions.push(lte(payments.createdAt, new Date(parsed.to)));
    }

    if (parsed.method) {
      conditions.push(eq(payments.method, parsed.method));
    }

    if (parsed.staffId) {
      conditions.push(eq(payments.staffId, parsed.staffId));
    }

    if (parsed.kind) {
      conditions.push(eq(payments.kind, parsed.kind));
    }

    const baseQuery = db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(parsed.limit ?? 100);

    const rows =
      conditions.length > 0
        ? await baseQuery.where(and(...conditions))
        : await baseQuery;

    return paymentsListResponseSchema.parse(
      rows.map((row) => ({
        id: row.id,
        tableId: row.tableId,
        tableNumber: row.tableNumber,
        subtotal: Number(row.subtotal),
        discountAmount: Number(row.discountAmount),
        surchargeAmount: Number(row.surchargeAmount),
        total: Number(row.total),
        method: row.method,
        kind: row.kind as "sale" | "refund",
        paymentStatus: row.paymentStatus as PaymentStatus,
        paidAmount: Number(row.paidAmount),
        changeAmount: Number(row.changeAmount),
        reference: row.reference ?? undefined,
        gatewayReference: row.gatewayReference ?? undefined,
        capturedAt: row.capturedAt?.toISOString(),
        refundedPaymentId: row.refundedPaymentId ?? undefined,
        refundReason: row.refundReason ?? undefined,
        notes: row.notes ?? undefined,
        staffId: row.staffId,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }

  async refundPayment(
    paymentId: string,
    payload: RefundPaymentRequest,
    actorStaffId: string,
  ): Promise<RefundPaymentResponse | null> {
    const parsed = refundPaymentRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    return withTenantTx(async (tx) => {
      const paymentRows = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.id, paymentId)))
        .limit(1);
      const original = paymentRows[0];
      if (!original) {
        return null;
      }

      if (original.kind !== "sale") {
        throw new Error("Only sale payments can be refunded");
      }

      const previousRefundRows = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.refundedPaymentId, paymentId), eq(payments.kind, "refund")));

      const originalTotal = Number(original.total);
      const alreadyRefunded = previousRefundRows.reduce((sum, row) => sum + Number(row.total), 0);
      const remainingBefore = Number((originalTotal - alreadyRefunded).toFixed(2));
      if (remainingBefore <= 0) {
        throw new Error("Payment already fully refunded");
      }

      const requestedAmount = parsed.amount ?? remainingBefore;
      const refundAmount = Number(requestedAmount.toFixed(2));

      if (refundAmount <= 0) {
        throw new Error("Refund amount must be greater than zero");
      }

      if (refundAmount > remainingBefore) {
        throw new Error("Refund amount exceeds refundable balance");
      }

      const remainingAfter = Number((remainingBefore - refundAmount).toFixed(2));

      const [refundRow] = await tx
        .insert(payments)
        .values({
          id: `ref_${Date.now().toString(36)}`,
          tenantId,
          tableId: original.tableId,
          tableNumber: original.tableNumber,
          subtotal: String(refundAmount),
          discountAmount: "0",
          surchargeAmount: "0",
          total: String(refundAmount),
          method: original.method,
          kind: "refund",
          paymentStatus: "captured",
          paidAmount: "0",
          changeAmount: "0",
          reference: original.reference ?? `refund:${paymentId}`,
          gatewayReference: original.gatewayReference ?? null,
          capturedAt: new Date(),
          refundedPaymentId: paymentId,
          refundReason: parsed.reason,
          notes: parsed.notes ?? null,
          staffId: actorStaffId,
          createdAt: new Date(),
        })
        .returning();

      return refundPaymentResponseSchema.parse({
        success: true,
        payment: {
          id: refundRow.id,
          tableId: refundRow.tableId,
          tableNumber: refundRow.tableNumber,
          subtotal: Number(refundRow.subtotal),
          discountAmount: Number(refundRow.discountAmount),
          surchargeAmount: Number(refundRow.surchargeAmount),
          total: Number(refundRow.total),
          method: refundRow.method,
          kind: refundRow.kind as "sale" | "refund",
          paymentStatus: refundRow.paymentStatus as PaymentStatus,
          paidAmount: Number(refundRow.paidAmount),
          changeAmount: Number(refundRow.changeAmount),
          reference: refundRow.reference ?? undefined,
          gatewayReference: refundRow.gatewayReference ?? undefined,
          capturedAt: refundRow.capturedAt?.toISOString(),
          refundedPaymentId: refundRow.refundedPaymentId ?? undefined,
          refundReason: refundRow.refundReason ?? undefined,
          notes: refundRow.notes ?? undefined,
          staffId: refundRow.staffId,
          createdAt: refundRow.createdAt.toISOString(),
        },
        refundedAmount: refundAmount,
        remainingAmount: remainingAfter,
      });
    });
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

  async createOrReuseCustomer(payload: CustomerCreateRequest): Promise<typeof customers.$inferSelect> {
    const parsed = customerCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const normalized = normalizeCustomerName(parsed.fullName);

    if (parsed.phone) {
      const byPhone = await db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.phone, parsed.phone)))
        .limit(1);
      if (byPhone.length > 0) {
        return byPhone[0];
      }
    }

    const byName = await db
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.fullNameNormalized, normalized)))
      .limit(1);
    if (byName.length > 0) {
      return byName[0];
    }

    const id = `c_${Date.now().toString(36)}`;
    const inserted = await db
      .insert(customers)
      .values({
        id,
        tenantId,
        fullName: parsed.fullName.trim(),
        fullNameNormalized: normalized,
        phone: parsed.phone ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: null,
      })
      .returning();

    return inserted[0];
  }

  async listCustomers(query: CustomersQuery): Promise<Customer[]> {
    const parsed = customersQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const limit = parsed.limit ?? 50;

    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.tenantId, tenantId))
      .orderBy(desc(customers.updatedAt))
      .limit(limit);

    const filteredRows = parsed.query
      ? rows.filter((row) => {
          const q = parsed.query?.toLowerCase().trim() ?? "";
          return row.fullName.toLowerCase().includes(q) || (row.phone ?? "").toLowerCase().includes(q);
        })
      : rows;

    const customerIds = filteredRows.map((row) => row.id);
    const orderRows =
      customerIds.length > 0
        ? await db
            .select()
            .from(orders)
            .where(and(eq(orders.tenantId, tenantId), inArray(orders.customerId, customerIds)))
        : [];
    const totals = new Map<string, { count: number; sum: number }>();
    for (const row of orderRows) {
      if (!row.customerId) continue;
      const current = totals.get(row.customerId) ?? { count: 0, sum: 0 };
      totals.set(row.customerId, { count: current.count + 1, sum: current.sum + Number(row.total) });
    }

    return customerListResponseSchema.parse(
      filteredRows.map((row) => {
        const stats = totals.get(row.id) ?? { count: 0, sum: 0 };
        return this.mapCustomerRow({ row, totalOrders: stats.count, totalSpent: stats.sum });
      }),
    );
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const [customerOrders, addresses] = await Promise.all([
      db.select().from(orders).where(and(eq(orders.tenantId, tenantId), eq(orders.customerId, id))),
      db.select().from(customerAddresses).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, id))).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt)),
    ]);
    return this.mapCustomerRow({
      row,
      totalOrders: customerOrders.length,
      totalSpent: customerOrders.reduce((sum, entry) => sum + Number(entry.total), 0),
      addresses,
    });
  }

  async listCustomerAddresses(customerId: string): Promise<Customer['addresses']> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, customerId)))
      .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt));
    return rows.map((a) => ({
      id: a.id,
      label: a.label,
      address: a.address,
      isDefault: a.isDefault === 1,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  }

  async createCustomerAddress(customerId: string, payload: CustomerAddressCreateRequest): Promise<NonNullable<Customer['addresses']>[number]> {
    const parsed = customerAddressCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const id = `ca_${Date.now().toString(36)}`;
    const now = new Date();

    if (parsed.isDefault) {
      await db.update(customerAddresses).set({ isDefault: 0, updatedAt: now }).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, customerId)));
    }

    const rows = await db.insert(customerAddresses).values({
      id,
      tenantId,
      customerId,
      label: parsed.label ?? null,
      address: parsed.address,
      isDefault: parsed.isDefault ? 1 : 0,
      createdAt: now,
      updatedAt: now,
    }).returning();
    const row = rows[0];
    return { id: row.id, label: row.label, address: row.address, isDefault: row.isDefault === 1, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  async updateCustomerAddress(addressId: string, payload: CustomerAddressUpdateRequest): Promise<NonNullable<Customer['addresses']>[number] | null> {
    const parsed = customerAddressUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: now };
    if (parsed.label !== undefined) updates.label = parsed.label;
    if (parsed.address !== undefined) updates.address = parsed.address;
    if (parsed.isDefault !== undefined) {
      updates.isDefault = parsed.isDefault ? 1 : 0;
      if (parsed.isDefault) {
        const existing = await db.select().from(customerAddresses).where(eq(customerAddresses.id, addressId)).limit(1);
        if (existing.length > 0) {
          await db.update(customerAddresses).set({ isDefault: 0, updatedAt: now }).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.customerId, existing[0].customerId)));
        }
      }
    }
    const rows = await db.update(customerAddresses).set(updates).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.id, addressId))).returning();
    if (rows.length === 0) return null;
    const row = rows[0];
    return { id: row.id, label: row.label, address: row.address, isDefault: row.isDefault === 1, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }

  async deleteCustomerAddress(addressId: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db.delete(customerAddresses).where(and(eq(customerAddresses.tenantId, tenantId), eq(customerAddresses.id, addressId))).returning();
    return rows.length > 0;
  }

  async updateCustomerById(id: string, payload: { fullName?: string; phone?: string | null }): Promise<Customer | null> {
    const tenantId = getTenantIdOrDefault();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (payload.fullName !== undefined) {
      updates.fullName = payload.fullName.trim();
      updates.fullNameNormalized = normalizeCustomerName(payload.fullName);
    }
    if (payload.phone !== undefined) {
      updates.phone = payload.phone;
    }
    const rows = await db
      .update(customers)
      .set(updates)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .returning();
    if (rows.length === 0) return null;
    return this.getCustomerById(id);
  }

  async deleteCustomerById(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .delete(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
      .returning();
    return rows.length > 0;
  }

  async getCustomerAnalytics(payload: CustomerAnalyticsRequest): Promise<CustomerAnalytics> {
    const parsed = customerAnalyticsRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const customerRows = await db.select().from(customers).where(eq(customers.tenantId, tenantId));
    const orderRows = await db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), eq(orders.orderType, "takeaway")));

    const filteredOrders = orderRows.filter((row) => {
      if (parsed.from && row.timestamp < new Date(parsed.from)) return false;
      if (parsed.to && row.timestamp > new Date(parsed.to)) return false;
      return true;
    });

    const customerOrderCount = new Map<string, number>();
    const customerSpent = new Map<string, number>();
    for (const row of filteredOrders) {
      if (!row.customerId) continue;
      customerOrderCount.set(row.customerId, (customerOrderCount.get(row.customerId) ?? 0) + 1);
      customerSpent.set(row.customerId, (customerSpent.get(row.customerId) ?? 0) + Number(row.total));
    }

    const activeCustomers = [...customerOrderCount.keys()].length;
    const totalCustomers = customerRows.length;
    const repeatCustomers = [...customerOrderCount.values()].filter((value) => value > 1).length;
    const sumSpent = [...customerSpent.values()].reduce((sum, value) => sum + value, 0);
    const sumOrders = [...customerOrderCount.values()].reduce((sum, value) => sum + value, 0);

    const fromDate = parsed.from ? new Date(parsed.from) : null;
    const newCustomers = fromDate
      ? customerRows.filter((row) => row.createdAt >= fromDate).length
      : customerRows.length;

    return customerAnalyticsSchema.parse({
      totalCustomers,
      activeCustomers,
      newCustomers,
      repeatRate: activeCustomers > 0 ? repeatCustomers / activeCustomers : 0,
      avgSpendPerCustomer: activeCustomers > 0 ? sumSpent / activeCustomers : 0,
      avgOrdersPerCustomer: activeCustomers > 0 ? sumOrders / activeCustomers : 0,
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

  async listCategories(scope?: Category["scope"]): Promise<Category[]> {
    const tenantId = getTenantIdOrDefault();
    const rows = scope
      ? await db
          .select()
          .from(categories)
          .where(and(eq(categories.tenantId, tenantId), eq(categories.scope, scope)))
          .orderBy(categories.name)
      : await db.select().from(categories).where(eq(categories.tenantId, tenantId)).orderBy(categories.name);
    return categoriesListResponseSchema.parse(rows.map((row) => this.mapCategoryRow(row)));
  }

  async createCategory(payload: CategoryCreateRequest): Promise<Category> {
    const parsed = categoryCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const id = `cat_${Date.now().toString(36)}`;
    const inserted = await db
      .insert(categories)
      .values({
        id,
        tenantId,
        name: parsed.name.trim(),
        scope: parsed.scope,
        printAreas: JSON.stringify(parsed.printAreas),
        isActive: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return this.mapCategoryRow(inserted[0]);
  }

  async updateCategory(id: string, payload: CategoryUpdateRequest): Promise<Category | null> {
    const parsed = categoryUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(categories)
      .set({
        ...(parsed.name ? { name: parsed.name.trim() } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive ? 1 : 0 } : {}),
        ...(parsed.printAreas ? { printAreas: JSON.stringify(parsed.printAreas) } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    return this.mapCategoryRow(updated[0]);
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

  async deleteCategory(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    const existing = await db
      .select({ id: categories.id, scope: categories.scope })
      .from(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)))
      .limit(1);
    if (existing.length === 0) {
      return false;
    }

    const inventoryUsage = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(and(eq(inventory.tenantId, tenantId), eq(inventory.categoryId, id)))
      .limit(1);
    if (inventoryUsage.length > 0) {
      throw new Error("Cannot delete category linked to inventory items");
    }

    const bomUsage = await db
      .select({ id: bomItems.id })
      .from(bomItems)
      .where(and(eq(bomItems.tenantId, tenantId), eq(bomItems.categoryId, id)))
      .limit(1);
    if (bomUsage.length > 0) {
      throw new Error("Cannot delete category linked to BoM items");
    }

    const menuUsage = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.tenantId, tenantId), eq(menuItems.categoryId, id)))
      .limit(1);
    if (menuUsage.length > 0) {
      throw new Error("Cannot delete category linked to menu items");
    }

    await db
      .delete(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.id, id)));
    return true;
  }

  async listCategoryModifierPools(categoryId?: string): Promise<CategoryModifierPool[]> {
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(categoryModifierPools.tenantId, tenantId)];

    const groupRows = await db
      .select()
      .from(categoryModifierPools)
      .where(and(...conditions))
      .orderBy(asc(categoryModifierPools.sortOrder));

    if (groupRows.length === 0) return [];

    const [optionRows, categoryRows] = await Promise.all([
      db.select().from(categoryModifierPoolOptions).where(eq(categoryModifierPoolOptions.tenantId, tenantId)),
      db.select().from(categoryModifierPoolCategories).where(eq(categoryModifierPoolCategories.tenantId, tenantId)),
    ]);

    const optionsByPoolId = new Map<string, CategoryModifierPool["options"]>();
    for (const opt of optionRows) {
      const existing = optionsByPoolId.get(opt.poolId) ?? [];
      existing.push({
        id: opt.id,
        name: opt.name ?? undefined,
        inventoryItemId: opt.inventoryItemId ?? undefined,
        priceDelta: Number(opt.priceDelta),
        sortOrder: opt.sortOrder ?? 0,
      });
      optionsByPoolId.set(opt.poolId, existing);
    }

    const categoriesByPoolId = new Map<string, string[]>();
    for (const cat of categoryRows) {
      const existing = categoriesByPoolId.get(cat.poolId) ?? [];
      existing.push(cat.categoryId);
      categoriesByPoolId.set(cat.poolId, existing);
    }

    let pools = groupRows.map((row) => {
      const poolCategoryIds = categoriesByPoolId.get(row.id) ?? [];
      return {
        id: row.id,
        categoryId: row.categoryId ?? undefined,
        categoryIds: poolCategoryIds,
        name: row.name,
        sortOrder: row.sortOrder ?? 0,
        options: optionsByPoolId.get(row.id) ?? [],
      };
    });

    if (categoryId) {
      pools = pools.filter((p) => p.categoryIds.includes(categoryId));
    }

    return pools;
  }

  async createCategoryModifierPool(payload: CategoryModifierPoolCreateRequest): Promise<CategoryModifierPool> {
    const tenantId = getTenantIdOrDefault();
    const poolId = `cmp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    await db.insert(categoryModifierPools).values({
      id: poolId,
      tenantId,
      categoryId: payload.categoryIds[0] ?? null,
      name: payload.name,
    });

    if (payload.categoryIds.length > 0) {
      await db.insert(categoryModifierPoolCategories).values(
        payload.categoryIds.map((catId) => ({
          id: `cmpc_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
          tenantId,
          poolId,
          categoryId: catId,
        })),
      );
    }

    if (payload.options.length > 0) {
      await db.insert(categoryModifierPoolOptions).values(
        payload.options.map((opt, idx) => ({
          id: `cmpo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
          tenantId,
          poolId,
          name: opt.name ?? null,
          inventoryItemId: opt.inventoryItemId ?? null,
          priceDelta: String(opt.priceDelta),
          sortOrder: idx,
        })),
      );
    }

    const pools = await this.listCategoryModifierPools();
    return pools.find((p) => p.id === poolId)!;
  }

  async updateCategoryModifierPool(id: string, payload: CategoryModifierPoolUpdateRequest): Promise<CategoryModifierPool | null> {
    const tenantId = getTenantIdOrDefault();

    if (payload.name !== undefined) {
      await db
        .update(categoryModifierPools)
        .set({ name: payload.name })
        .where(and(eq(categoryModifierPools.tenantId, tenantId), eq(categoryModifierPools.id, id)));
    }

    if (payload.categoryIds !== undefined) {
      await db
        .delete(categoryModifierPoolCategories)
        .where(and(eq(categoryModifierPoolCategories.tenantId, tenantId), eq(categoryModifierPoolCategories.poolId, id)));

      if (payload.categoryIds.length > 0) {
        await db.insert(categoryModifierPoolCategories).values(
          payload.categoryIds.map((catId) => ({
            id: `cmpc_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
            tenantId,
            poolId: id,
            categoryId: catId,
          })),
        );
      }
    }

    if (payload.options !== undefined) {
      await db
        .delete(categoryModifierPoolOptions)
        .where(and(eq(categoryModifierPoolOptions.tenantId, tenantId), eq(categoryModifierPoolOptions.poolId, id)));

      if (payload.options.length > 0) {
        await db.insert(categoryModifierPoolOptions).values(
          payload.options.map((opt, idx) => ({
            id: `cmpo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
            tenantId,
            poolId: id,
            name: opt.name ?? null,
            inventoryItemId: opt.inventoryItemId ?? null,
            priceDelta: String(opt.priceDelta),
            sortOrder: idx,
          })),
        );
      }
    }

    const pools = await this.listCategoryModifierPools();
    return pools.find((p) => p.id === id) ?? null;
  }

  async deleteCategoryModifierPool(id: string): Promise<boolean> {
    const tenantId = getTenantIdOrDefault();
    await db
      .delete(categoryModifierPoolOptions)
      .where(and(eq(categoryModifierPoolOptions.tenantId, tenantId), eq(categoryModifierPoolOptions.poolId, id)));
    await db
      .delete(categoryModifierPoolCategories)
      .where(and(eq(categoryModifierPoolCategories.tenantId, tenantId), eq(categoryModifierPoolCategories.poolId, id)));
    const result = await db
      .delete(categoryModifierPools)
      .where(and(eq(categoryModifierPools.tenantId, tenantId), eq(categoryModifierPools.id, id)));
    return (result.rowCount ?? 0) > 0;
  }

  async listPrintJobs(query: PrintJobsQuery): Promise<PrintJob[]> {
    const parsed = printJobsQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [];

    conditions.push(eq(printJobs.tenantId, tenantId));

    if (parsed.status) {
      conditions.push(eq(printJobs.status, parsed.status));
    }
    if (parsed.area) {
      conditions.push(eq(printJobs.area, parsed.area));
    }

    const baseQuery = db
      .select()
      .from(printJobs)
      .orderBy(desc(printJobs.createdAt))
      .limit(parsed.limit ?? 100);

    const rows = conditions.length > 0 ? await baseQuery.where(and(...conditions)) : await baseQuery;

    return printJobsListResponseSchema.parse(
      rows.map((row) =>
        printJobSchema.parse({
          id: row.id,
          orderId: row.orderId,
          area: printAreaSchema.parse(row.area),
          protocol: row.protocol,
          status: row.status,
          payload: row.payload,
          error: row.error ?? undefined,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
        }),
      ),
    );
  }

  async pollPrintJobs(areas: PrintArea[]): Promise<PrintJob[]> {
    const tenantId = getTenantIdOrDefault();

    // Atomic: update pending jobs to dispatched and return them in one query.
    // This eliminates the race condition where concurrent polls could dispatch
    // the same jobs because the SELECT and UPDATE were separate operations.
    const now = new Date();
    const dispatchedRows = await db
      .update(printJobs)
      .set({ status: "dispatched", error: null, updatedAt: now, dispatchedAt: now })
      .where(
        and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.status, "pending"),
          inArray(printJobs.area, areas),
        ),
      )
      .returning();

    if (dispatchedRows.length === 0) {
      return [];
    }

    return dispatchedRows.map((row) =>
      printJobSchema.parse({
        id: row.id,
        orderId: row.orderId,
        area: printAreaSchema.parse(row.area),
        protocol: row.protocol,
        status: row.status,
        payload: row.payload,
        error: row.error ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
      }),
    );
  }

  async dispatchPrintJob(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(printJobs)
      .set({
        status: "dispatched",
        error: null,
        updatedAt: new Date(),
        dispatchedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: printAreaSchema.parse(row.area),
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  async failPrintJob(id: string, error: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(printJobs)
      .set({
        status: "failed",
        error: error.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: printAreaSchema.parse(row.area),
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  async completePrintJob(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const now = new Date();
    const updated = await db
      .update(printJobs)
      .set({
        status: "completed",
        updatedAt: now,
        dispatchedAt: now,
      })
      .where(
        and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.id, id),
          inArray(printJobs.status, ["pending", "dispatched"]),
        ),
      )
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: printAreaSchema.parse(row.area),
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  async confirmPrintJob(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(printJobs)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id), eq(printJobs.status, "dispatched")))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: printAreaSchema.parse(row.area),
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
  }

  async retryPrintJob(id: string): Promise<PrintJob | null> {
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(printJobs)
      .set({
        status: "pending",
        error: null,
        updatedAt: new Date(),
        dispatchedAt: null,
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, id), inArray(printJobs.status, ["failed", "dispatched"])))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return printJobSchema.parse({
      id: row.id,
      orderId: row.orderId,
      area: printAreaSchema.parse(row.area),
      protocol: row.protocol,
      status: row.status,
      payload: row.payload,
      error: row.error ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : undefined,
    });
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

  // ── Supplier-Ingredient links ──────────────────────────────────────

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

  async listShifts(query: ShiftsQuery): Promise<Shift[]> {
    const parsed = shiftsQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(staffShifts.tenantId, tenantId)];
    if (parsed.staffId) {
      conditions.push(eq(staffShifts.staffId, parsed.staffId));
    }
    if (parsed.status) {
      conditions.push(eq(staffShifts.status, parsed.status));
    }
    if (parsed.from) {
      conditions.push(gte(staffShifts.startAt, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(staffShifts.endAt, new Date(parsed.to)));
    }

    const rows = await db
      .select()
      .from(staffShifts)
      .where(and(...conditions))
      .orderBy(desc(staffShifts.startAt))
      .limit(parsed.limit ?? 200);

    return rows.map((row) =>
      shiftSchema.parse({
        id: row.id,
        staffId: row.staffId,
        shiftDate: row.shiftDate,
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        toleranceEarlyMin: row.toleranceEarlyMin,
        toleranceLateMin: row.toleranceLateMin,
        status: shiftStatusSchema.parse(row.status),
        notes: row.notes ?? undefined,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }),
    );
  }

  async createShift(payload: ShiftCreateRequest): Promise<Shift> {
    const parsed = shiftCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();

    const staffRows = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, parsed.staffId), eq(staff.isActive, 1)))
      .limit(1);
    if (staffRows.length === 0) {
      throw new Error("Staff not found or inactive");
    }

    const inserted = await db
      .insert(staffShifts)
      .values({
        id: `sh_${crypto.randomUUID()}`,
        tenantId,
        staffId: parsed.staffId,
        shiftDate: parsed.shiftDate,
        startAt: new Date(parsed.startAt),
        endAt: new Date(parsed.endAt),
        toleranceEarlyMin: parsed.toleranceEarlyMin,
        toleranceLateMin: parsed.toleranceLateMin,
        status: "scheduled",
        notes: parsed.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const row = inserted[0];
    return shiftSchema.parse({
      id: row.id,
      staffId: row.staffId,
      shiftDate: row.shiftDate,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      toleranceEarlyMin: row.toleranceEarlyMin,
      toleranceLateMin: row.toleranceLateMin,
      status: shiftStatusSchema.parse(row.status),
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async updateShift(id: string, payload: ShiftUpdateRequest): Promise<Shift | null> {
    const parsed = shiftUpdateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const updated = await db
      .update(staffShifts)
      .set({
        ...(parsed.startAt !== undefined ? { startAt: new Date(parsed.startAt) } : {}),
        ...(parsed.endAt !== undefined ? { endAt: new Date(parsed.endAt) } : {}),
        ...(parsed.toleranceEarlyMin !== undefined ? { toleranceEarlyMin: parsed.toleranceEarlyMin } : {}),
        ...(parsed.toleranceLateMin !== undefined ? { toleranceLateMin: parsed.toleranceLateMin } : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(staffShifts.tenantId, tenantId), eq(staffShifts.id, id)))
      .returning();

    if (updated.length === 0) {
      return null;
    }

    const row = updated[0];
    return shiftSchema.parse({
      id: row.id,
      staffId: row.staffId,
      shiftDate: row.shiftDate,
      startAt: row.startAt.toISOString(),
      endAt: row.endAt.toISOString(),
      toleranceEarlyMin: row.toleranceEarlyMin,
      toleranceLateMin: row.toleranceLateMin,
      status: shiftStatusSchema.parse(row.status),
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async clockIn(payload: ClockInRequest): Promise<TimeEntry> {
    const parsed = clockInRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const at = new Date(parsed.at);

    const staffRows = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, tenantId), eq(staff.id, parsed.staffId), eq(staff.isActive, 1)))
      .limit(1);
    if (staffRows.length === 0) {
      throw new Error("Staff not found or inactive");
    }

    const openRows = await db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.tenantId, tenantId),
          eq(timeEntries.staffId, parsed.staffId),
          isNull(timeEntries.clockOutAt),
          inArray(timeEntries.status, ["open", "anomaly"]),
        ),
      )
      .limit(1);
    if (openRows.length > 0) {
      throw new Error("Open time entry already exists");
    }

    let entryStatus: TimeEntryStatus = "open";
    if (parsed.shiftId) {
      const shiftRows = await db
        .select()
        .from(staffShifts)
        .where(and(eq(staffShifts.tenantId, tenantId), eq(staffShifts.id, parsed.shiftId)))
        .limit(1);
      const shift = shiftRows[0];
      if (shift) {
        const lateThreshold = new Date(shift.startAt.getTime() + shift.toleranceLateMin * 60_000);
        if (at > lateThreshold) {
          entryStatus = "anomaly";
        }
      }
    }

    const now = new Date();
    const inserted = await db
      .insert(timeEntries)
      .values({
        id: `te_${crypto.randomUUID()}`,
        tenantId,
        staffId: parsed.staffId,
        shiftId: parsed.shiftId ?? null,
        clockInAt: at,
        clockOutAt: null,
        status: entryStatus,
        source: timeEntrySourceSchema.parse(parsed.source),
        notes: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const row = inserted[0];
    return timeEntrySchema.parse({
      id: row.id,
      staffId: row.staffId,
      shiftId: row.shiftId ?? undefined,
      clockInAt: row.clockInAt.toISOString(),
      clockOutAt: row.clockOutAt ? row.clockOutAt.toISOString() : null,
      status: timeEntryStatusSchema.parse(row.status),
      source: timeEntrySourceSchema.parse(row.source),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async clockOut(payload: ClockOutRequest): Promise<TimeEntry> {
    const parsed = clockOutRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();

    const rows = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.tenantId, tenantId),
          eq(timeEntries.staffId, parsed.staffId),
          isNull(timeEntries.clockOutAt),
          inArray(timeEntries.status, ["open", "anomaly"]),
        ),
      )
      .orderBy(desc(timeEntries.clockInAt))
      .limit(1);
    const open = rows[0];
    if (!open) {
      throw new Error("No open time entry");
    }

    const updated = await db
      .update(timeEntries)
      .set({
        clockOutAt: new Date(parsed.at),
        status: "closed",
        updatedAt: new Date(),
      })
      .where(and(eq(timeEntries.tenantId, tenantId), eq(timeEntries.id, open.id)))
      .returning();

    const row = updated[0];
    return timeEntrySchema.parse({
      id: row.id,
      staffId: row.staffId,
      shiftId: row.shiftId ?? undefined,
      clockInAt: row.clockInAt.toISOString(),
      clockOutAt: row.clockOutAt ? row.clockOutAt.toISOString() : null,
      status: timeEntryStatusSchema.parse(row.status),
      source: timeEntrySourceSchema.parse(row.source),
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  async timeReport(query: TimeReportQuery): Promise<TimeReportResponse> {
    const parsed = timeReportQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(timeEntries.tenantId, tenantId), gte(timeEntries.clockInAt, new Date(parsed.from)), lte(timeEntries.clockInAt, new Date(parsed.to))];
    if (parsed.staffId) {
      conditions.push(eq(timeEntries.staffId, parsed.staffId));
    }

    const rows = await db
      .select()
      .from(timeEntries)
      .where(and(...conditions))
      .orderBy(desc(timeEntries.clockInAt));

    const entries = rows
      .filter((row) => row.clockOutAt)
      .map((row) => {
        const minutes = Math.max(0, Math.round((row.clockOutAt!.getTime() - row.clockInAt.getTime()) / 60000));
        return {
          staffId: row.staffId,
          minutes,
          date: row.clockInAt.toISOString().slice(0, 10),
          anomaly: row.status === "anomaly",
        };
      });

    const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
    return timeReportResponseSchema.parse({
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(2)),
      entries,
    });
  }

  async closeFiscalDay(payload: FiscalCloseRequest, actorStaffId: string): Promise<FiscalClosure> {
    const parsed = fiscalCloseRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const dayStart = new Date(`${parsed.businessDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${parsed.businessDate}T23:59:59.999Z`);

    const already = await db
      .select({ id: fiscalClosures.id })
      .from(fiscalClosures)
      .where(and(eq(fiscalClosures.tenantId, tenantId), eq(fiscalClosures.businessDate, parsed.businessDate)))
      .limit(1);
    if (already.length > 0) {
      throw new Error("Fiscal day already closed");
    }

    const paymentsRows = await db
      .select()
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), gte(payments.createdAt, dayStart), lte(payments.createdAt, dayEnd)));

    const gross = paymentsRows.filter((row) => row.kind === "sale").reduce((sum, row) => sum + Number(row.total), 0);
    const refunds = paymentsRows.filter((row) => row.kind === "refund").reduce((sum, row) => sum + Number(row.total), 0);
    const cash = paymentsRows.filter((row) => row.kind === "sale" && row.method === "cash").reduce((sum, row) => sum + Number(row.total), 0);
    const card = paymentsRows.filter((row) => row.kind === "sale" && row.method === "card").reduce((sum, row) => sum + Number(row.total), 0);
    const totals = { gross, refunds, net: gross - refunds, cash, card };

    const now = new Date();
    const inserted = await db
      .insert(fiscalClosures)
      .values({
        id: `fc_${crypto.randomUUID()}`,
        tenantId,
        businessDate: parsed.businessDate,
        closedByStaffId: actorStaffId,
        totalsJson: JSON.stringify(totals),
        closedAt: now,
        notes: parsed.notes ?? null,
      })
      .returning();

    const row = inserted[0];
    return fiscalClosureSchema.parse({
      id: row.id,
      businessDate: row.businessDate,
      closedByStaffId: row.closedByStaffId,
      totals,
      closedAt: row.closedAt.toISOString(),
      notes: row.notes ?? undefined,
    });
  }

  async createFiscalExport(payload: FiscalExportCreateRequest, actorStaffId: string): Promise<FiscalExport> {
    const parsed = fiscalExportCreateRequestSchema.parse(payload);
    const tenantId = getTenantIdOrDefault();
    const now = new Date();
    const id = `fx_${crypto.randomUUID()}`;

    const path = `/exports/${tenantId}/fiscal_${parsed.businessDate}.csv`;
    const inserted = await db
      .insert(fiscalExports)
      .values({
        id,
        tenantId,
        businessDate: parsed.businessDate,
        format: parsed.format,
        status: "ready",
        path,
        generatedByStaffId: actorStaffId,
        generatedAt: now,
        checksum: null,
      })
      .returning();

    const row = inserted[0];
    return fiscalExportSchema.parse({
      id: row.id,
      businessDate: row.businessDate,
      format: row.format as "csv",
      status: fiscalExportStatusSchema.parse(row.status),
      path: row.path,
      generatedByStaffId: row.generatedByStaffId,
      generatedAt: row.generatedAt.toISOString(),
      checksum: row.checksum ?? undefined,
    });
  }

  async listFiscalExports(query: FiscalExportsQuery): Promise<FiscalExport[]> {
    const parsed = fiscalExportsQuerySchema.parse(query);
    const tenantId = getTenantIdOrDefault();
    const conditions: SQL[] = [eq(fiscalExports.tenantId, tenantId)];
    if (parsed.status) {
      conditions.push(eq(fiscalExports.status, parsed.status));
    }
    if (parsed.from) {
      conditions.push(gte(fiscalExports.generatedAt, new Date(parsed.from)));
    }
    if (parsed.to) {
      conditions.push(lte(fiscalExports.generatedAt, new Date(parsed.to)));
    }

    const rows = await db
      .select()
      .from(fiscalExports)
      .where(and(...conditions))
      .orderBy(desc(fiscalExports.generatedAt))
      .limit(parsed.limit ?? 200);

    return rows.map((row) =>
      fiscalExportSchema.parse({
        id: row.id,
        businessDate: row.businessDate,
        format: row.format as "csv",
        status: fiscalExportStatusSchema.parse(row.status),
        path: row.path,
        generatedByStaffId: row.generatedByStaffId,
        generatedAt: row.generatedAt.toISOString(),
        checksum: row.checksum ?? undefined,
      }),
    );
  }

  async getFiscalExportById(id: string): Promise<FiscalExport | null> {
    const tenantId = getTenantIdOrDefault();
    const rows = await db
      .select()
      .from(fiscalExports)
      .where(and(eq(fiscalExports.tenantId, tenantId), eq(fiscalExports.id, id)))
      .limit(1);
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return fiscalExportSchema.parse({
      id: row.id,
      businessDate: row.businessDate,
      format: row.format as "csv",
      status: fiscalExportStatusSchema.parse(row.status),
      path: row.path,
      generatedByStaffId: row.generatedByStaffId,
      generatedAt: row.generatedAt.toISOString(),
      checksum: row.checksum ?? undefined,
    });
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

  // ─── Loyalty Points ─────────────────────────────────────────────────────

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
      totalRedeemed: row.totalRedeemed,
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
        updatedAt: nowDate,
      });
    } else {
      const existing = existingRows[0];
      await db
        .update(loyaltyPoints)
        .set({
          points: existing.points + points,
          totalEarned: existing.totalEarned + points,
          updatedAt: nowDate,
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
      createdAt: nowDate,
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
        updatedAt: nowDate,
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
      createdAt: nowDate,
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
      createdAt: row.createdAt.toISOString(),
    }));
  }

  // ─── Table CRUD ───────────────────────────────────────────────

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

  // ─── Food Cost Matrix ─────────────────────────────────────────────────

  /**
   * Get the full food cost matrix for a tenant.
   * Returns ingredient × menu item quantities with cost calculations.
   */
  async getFoodCostMatrix(): Promise<{
    rows: Array<{
      menuItemId: string;
      menuItemName: string;
      category: string;
      ingredientId: string;
      ingredientName: string;
      quantity: number;
      unit: string;
      ingredientCost: number;
      totalCost: number;
      menuItemPrice: number;
      margin: number;
      marginPercent: number;
      recommendedPrice: number;
      status: 'ok' | 'needs_change';
    }>;
    summary: Array<{
      menuItemId: string;
      menuItemName: string;
      category: string;
      totalCost: number;
      currentPrice: number;
      recommendedPrice: number;
      margin: number;
      marginPercent: number;
      status: 'ok' | 'needs_change';
      ingredientCount: number;
    }>;
  }> {
    const tenantId = getTenantIdOrDefault();

    // Fetch all menu items, ingredients, and recipe links in parallel
    const [menuRows, ingRows, recipeRows] = await Promise.all([
      db
        .select({
          id: menuItems.id,
          name: menuItems.name,
          category: menuItems.category,
          price: menuItems.price,
          defaultContainerId: menuItems.defaultContainerId,
        })
        .from(menuItems)
        .where(eq(menuItems.tenantId, tenantId)),
      db
        .select({
          id: inventory.id,
          name: inventory.name,
          unitCost: inventory.unitCost,
          unit: inventory.unit,
        })
        .from(inventory)
        .where(eq(inventory.tenantId, tenantId)),
      db
        .select({
          menuItemId: menuItemIngredients.menuItemId,
          ingredientId: menuItemIngredients.ingredientId,
          quantity: menuItemIngredients.quantity,
          unit: menuItemIngredients.unit,
        })
        .from(menuItemIngredients)
        .where(eq(menuItemIngredients.tenantId, tenantId)),
    ]);

    // Fetch container costs
    const containerIds = [...new Set(menuRows.map((m) => m.defaultContainerId).filter((id): id is string => Boolean(id)))];
    const containerRows = containerIds.length > 0
      ? await db
          .select({ id: inventory.id, name: inventory.name, unitCost: inventory.unitCost })
          .from(inventory)
          .where(and(eq(inventory.tenantId, tenantId), inArray(inventory.id, containerIds)))
      : [];
    const containerById = new Map(containerRows.map((c) => [c.id, c]));

    // Build lookup maps
    const menuById = new Map(menuRows.map((m) => [m.id, m]));
    const ingById = new Map(ingRows.map((i) => [i.id, i]));

    // Target margin: 66.67% (1/3 food cost)
    const TARGET_MARGIN = 0.6667;

    // Build matrix rows
    const rows: Array<{
      menuItemId: string;
      menuItemName: string;
      category: string;
      ingredientId: string;
      ingredientName: string;
      quantity: number;
      unit: string;
      ingredientCost: number;
      totalCost: number;
      menuItemPrice: number;
      margin: number;
      marginPercent: number;
      recommendedPrice: number;
      status: 'ok' | 'needs_change';
    }> = [];

    const summaryMap = new Map<string, {
      menuItemId: string;
      menuItemName: string;
      category: string;
      totalCost: number;
      currentPrice: number;
      recommendedPrice: number;
      margin: number;
      marginPercent: number;
      status: 'ok' | 'needs_change';
      ingredientCount: number;
    }>();

    // Initialize summary for all menu items
    for (const menu of menuRows) {
      summaryMap.set(menu.id, {
        menuItemId: menu.id,
        menuItemName: menu.name,
        category: menu.category,
        totalCost: 0,
        currentPrice: toNumeric(menu.price as unknown as string),
        recommendedPrice: 0,
        margin: 0,
        marginPercent: 0,
        status: 'ok',
        ingredientCount: 0,
      });
    }

    // Add container cost if selected
    for (const menu of menuRows) {
      if (menu.defaultContainerId) {
        const container = containerById.get(menu.defaultContainerId);
        if (container) {
          const containerCost = toNumeric(container.unitCost as unknown as string);

          rows.push({
            menuItemId: menu.id,
            menuItemName: menu.name,
            category: menu.category,
            ingredientId: container.id,
            ingredientName: `[Container] ${container.name}`,
            quantity: 1,
            unit: 'pz',
            ingredientCost: containerCost,
            totalCost: containerCost,
            menuItemPrice: toNumeric(menu.price as unknown as string),
            margin: 0,
            marginPercent: 0,
            recommendedPrice: 0,
            status: 'ok',
          });

          const summary = summaryMap.get(menu.id);
          if (summary) {
            summary.totalCost += containerCost;
            summary.ingredientCount++;
          }
        }
      }
    }

    // Process each recipe link
    for (const recipe of recipeRows) {
      const menu = menuById.get(recipe.menuItemId);
      const ing = ingById.get(recipe.ingredientId);
      if (!menu || !ing) continue;

      const qty = toNumeric(recipe.quantity as unknown as string);
      const unitCost = toNumeric(ing.unitCost as unknown as string);
      const menuItemPrice = toNumeric(menu.price as unknown as string);

      // Cost = quantity × unit cost (both in inventory-native units)
      const totalCost = qty * unitCost;

      // Margin calculation
      const margin = menuItemPrice - totalCost;
      const marginPercent = menuItemPrice > 0 ? margin / menuItemPrice : 0;
      const recommendedPrice = marginPercent < TARGET_MARGIN && marginPercent > 0
        ? totalCost / (1 - TARGET_MARGIN)
        : menuItemPrice;

      const status: 'ok' | 'needs_change' = marginPercent >= TARGET_MARGIN ? 'ok' : 'needs_change';

      rows.push({
        menuItemId: recipe.menuItemId,
        menuItemName: menu.name,
        category: menu.category,
        ingredientId: recipe.ingredientId,
        ingredientName: ing.name,
        quantity: qty,
        unit: recipe.unit || ing.unit,
        ingredientCost: unitCost,
        totalCost,
        menuItemPrice,
        margin,
        marginPercent,
        recommendedPrice,
        status,
      });

      // Update summary
      const summary = summaryMap.get(recipe.menuItemId);
      if (summary) {
        summary.totalCost += totalCost;
        summary.ingredientCount++;
      }
    }

    // Finalize summary
    const summary = Array.from(summaryMap.values()).map((s) => {
      const margin = s.currentPrice - s.totalCost;
      const marginPercent = s.currentPrice > 0 ? margin / s.currentPrice : 0;
      const recommendedPrice = marginPercent < TARGET_MARGIN && marginPercent > 0
        ? s.totalCost / (1 - TARGET_MARGIN)
        : s.currentPrice;

      return {
        ...s,
        margin,
        marginPercent,
        recommendedPrice,
        status: marginPercent >= TARGET_MARGIN ? 'ok' as const : 'needs_change' as const,
      };
    });

    return { rows, summary };
  }

  /**
   * Update a single cell in the food cost matrix.
   * This updates the menuItemIngredients record.
   */
  async updateFoodCostMatrixCell(
    menuItemId: string,
    ingredientId: string,
    quantity: number,
    unit: string,
  ): Promise<void> {
    const tenantId = getTenantIdOrDefault();

    // Check if the link exists
    const existing = await db
      .select()
      .from(menuItemIngredients)
      .where(
        and(
          eq(menuItemIngredients.tenantId, tenantId),
          eq(menuItemIngredients.menuItemId, menuItemId),
          eq(menuItemIngredients.ingredientId, ingredientId),
        ),
      )
      .limit(1);

    if (quantity <= 0) {
      // Remove the link if quantity is 0 or negative
      if (existing.length > 0) {
        await db
          .delete(menuItemIngredients)
          .where(
            and(
              eq(menuItemIngredients.tenantId, tenantId),
              eq(menuItemIngredients.menuItemId, menuItemId),
              eq(menuItemIngredients.ingredientId, ingredientId),
            ),
          );
      }
      return;
    }

    if (existing.length > 0) {
      // Update existing link
      await db
        .update(menuItemIngredients)
        .set({ quantity: quantity.toString(), unit })
        .where(
          and(
            eq(menuItemIngredients.tenantId, tenantId),
            eq(menuItemIngredients.menuItemId, menuItemId),
            eq(menuItemIngredients.ingredientId, ingredientId),
          ),
        );
    } else {
      // Create new link
      await db.insert(menuItemIngredients).values({
        tenantId,
        menuItemId,
        ingredientId,
        quantity: quantity.toString(),
        unit,
      });
    }
  }

  /**
   * Bulk import food cost matrix from spreadsheet data.
   * Maps ingredient names to inventory IDs and creates/updates recipe links.
   */
  async importFoodCostMatrix(
    rows: Array<{
      ingredientName: string;
      menuItemName: string;
      quantity: number;
      unit: string;
    }>,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const tenantId = getTenantIdOrDefault();
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    // Fetch all menu items and inventory for name-to-ID mapping
    const [menuRows, ingRows] = await Promise.all([
      db
        .select({ id: menuItems.id, name: menuItems.name })
        .from(menuItems)
        .where(eq(menuItems.tenantId, tenantId)),
      db
        .select({ id: inventory.id, name: inventory.name })
        .from(inventory)
        .where(eq(inventory.tenantId, tenantId)),
    ]);

    // Build name-to-ID maps (case-insensitive)
    const menuByName = new Map(menuRows.map((m) => [m.name.toLowerCase().trim(), m.id]));
    const ingByName = new Map(ingRows.map((i) => [i.name.toLowerCase().trim(), i.id]));

    // Track processed pairs to prevent duplicates
    const processedPairs = new Set<string>();

    for (const row of rows) {
      const menuItemId = menuByName.get(row.menuItemName.toLowerCase().trim());
      const ingredientId = ingByName.get(row.ingredientName.toLowerCase().trim());

      if (!menuItemId) {
        errors.push(`Menu item not found: "${row.menuItemName}"`);
        skipped++;
        continue;
      }

      if (!ingredientId) {
        errors.push(`Ingredient not found: "${row.ingredientName}"`);
        skipped++;
        continue;
      }

      // Deduplicate: skip if this exact pair was already processed
      const pairKey = `${menuItemId}:${ingredientId}`;
      if (processedPairs.has(pairKey)) {
        errors.push(`Duplicate skipped: "${row.menuItemName}" × "${row.ingredientName}" (already imported)`);
        skipped++;
        continue;
      }
      processedPairs.add(pairKey);

      try {
        await this.updateFoodCostMatrixCell(menuItemId, ingredientId, row.quantity, row.unit);
        imported++;
      } catch (e) {
        errors.push(`Failed to import ${row.menuItemName} × ${row.ingredientName}: ${(e as Error).message}`);
        skipped++;
      }
    }

    return { imported, skipped, errors };
  }

  // ── Fuzzy name matching helpers ──────────────────────────────────────
  private readonly INGREDIENT_ALIASES: Record<string, string> = {
    'hamburgher100': 'Burger 100g',
    'hamburgher180': 'Burger 180g',
    'birbe di polllo': 'Nuggets',
    'chiken': 'Chicken',
    'cotto': 'Prosciutto',
    'bresaola': 'Prosciutto crudo',
    'wrustel grandi': 'Wurstel',
    'wrustel piccoli': 'Wurstel',
    'uovo': 'Albume',
    'pecorinograttugiato': 'Pecorino romano',
    'pecorinofette': 'Pecorino romano',
    'provolaaffumicata': 'Scamorza affumicata',
    'cipollacroccante': 'Anelli di cipolla',
    'cipollacaramellata': 'Cipolla caramellata',
    'cremadizucca': 'Crema di zucca',
    'pulledpork': 'Pulled pork',
    'ciliegino': 'Pomodoro',
  };

  private readonly MENU_ITEM_ALIASES: Record<string, string> = {
    'luglio': 'Luglio Burger',
    'smoky': 'Smoky Burger',
    'pistacchio': 'Pistacchio Burger',
    'agosto': 'Agosto Burger',
    'smash': 'Smash Burger',
    'carbo': 'Carbo Burger',
    'frank': "Frank's",
    'wrap': 'Chicken Wrap',
    'xxl': 'Burro XXL',
    'spicy': 'Spicy Combo',
  };

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private fuzzyFind(
    needle: string,
    haystack: Array<{ id: string; name: string }>,
    aliases?: Record<string, string>,
  ): { id: string; name: string } | null {
    const norm = this.normalizeName(needle);
    if (!norm) return null;

    // Manual alias lookup
    const aliasTarget = aliases?.[norm];
    if (aliasTarget) {
      const normAlias = this.normalizeName(aliasTarget);
      const found = haystack.find((i) => this.normalizeName(i.name) === normAlias);
      if (found) return found;
    }

    // 1) exact normalized match
    for (const item of haystack) {
      if (this.normalizeName(item.name) === norm) return item;
    }
    // 2) needle is a prefix of item name (word-boundary safe, ≥3 chars)
    for (const item of haystack) {
      const itemNorm = this.normalizeName(item.name);
      if (norm.length >= 3 && itemNorm.startsWith(norm)) {
        const rest = itemNorm.slice(norm.length);
        if (!rest || rest.startsWith(' ')) return item;
      }
    }
    // 3) word-level overlap (all needle words found in target, ≥3 chars each)
    const needleWords = norm.split(' ').filter((w) => w.length >= 3);
    if (needleWords.length > 0) {
      for (const item of haystack) {
        const itemWords = this.normalizeName(item.name).split(' ').filter(Boolean);
        const hits = needleWords.filter((w) => itemWords.includes(w));
        if (hits.length === needleWords.length) return item;
      }
    }
    return null;
  }

  // ── Full xlsx import (backend parses file) ──────────────────────────
  async importFromXlsx(xlsxBuffer: Buffer): Promise<{
    costsUpdated: number;
    costsSkipped: number;
    recipesImported: number;
    recipesSkipped: number;
    costMatches: Array<{ xlsxName: string; matchedTo: string; unitCost: number }>;
    recipeMatches: Array<{ ingredient: string; menuItem: string; qty: number }>;
    errors: string[];
  }> {
    const tenantId = getTenantIdOrDefault();
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });

    const errors: string[] = [];
    let costsUpdated = 0;
    let costsSkipped = 0;
    let recipesImported = 0;
    let recipesSkipped = 0;
    const costMatches: Array<{ xlsxName: string; matchedTo: string; unitCost: number }> = [];
    const recipeMatches: Array<{ ingredient: string; menuItem: string; qty: number }> = [];

    // Fetch all existing inventory + menu items
    const [ingRows, menuRows] = await Promise.all([
      db.select({ id: inventory.id, name: inventory.name, unit: inventory.unit })
        .from(inventory).where(eq(inventory.tenantId, tenantId)),
      db.select({ id: menuItems.id, name: menuItems.name, price: menuItems.price })
        .from(menuItems).where(eq(menuItems.tenantId, tenantId)),
    ]);
    const ingList = ingRows.map((i) => ({ id: i.id, name: i.name, unit: i.unit }));
    const menuList = menuRows.map((m) => ({ id: m.id, name: m.name }));

    // Track processed ingredient-menu pairs to prevent duplicates
    const processedPairs = new Set<string>();
    // Track which xlsx names mapped to which DB IDs (for duplicate detection)
    const xlsxNameToDbId = new Map<string, string>();
    // Track which DB ingredient IDs already had their cost updated (prevent overwrite)
    const processedCosts = new Set<string>();

    // Build grams-per-portion lookup from Ingredienti tab
    const gramsPerPortionMap = new Map<string, number>();

    // ── Phase 1: Parse Ingredienti tab → update inventory.unit_cost + build grams lookup ──
    const ingSheet = workbook.Sheets['Ingredienti'];
    if (ingSheet) {
      const data = XLSX.utils.sheet_to_json<unknown[]>(ingSheet, { header: 1, defval: null });

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const xlsxName = String(row[0] ?? '').trim();
        if (!xlsxName) continue;

        const grams = Number(row[1]) || 0;
        // Column G = correct per-portion cost (already computed in XLSX)
        // Column F = cost+IVA per kg (misleading: actually pack cost for some items)
        // Column E = cost per kg (without IVA)
        // Use column G directly — it's the single source of truth
        const costPerPiece = Number(row[6]) || 0;
        const costPerKg = costPerPiece; // use per-portion cost directly

        // Build grams-per-portion map (normalized key)
        const normName = this.normalizeName(xlsxName);
        if (grams > 0) {
          gramsPerPortionMap.set(normName, grams);
        }

        const matched = this.fuzzyFind(xlsxName, ingList, this.INGREDIENT_ALIASES);
        if (!matched) {
          errors.push(`Ingredient not found: "${xlsxName}"`);
          costsSkipped++;
          continue;
        }

        // Check for ambiguous matches: does another xlsx name also map to the same DB item?
        const existingMapping = xlsxNameToDbId.get(matched.id);
        if (existingMapping && existingMapping !== normName) {
          errors.push(`Ambiguous: "${xlsxName}" and "${existingMapping}" both map to "${matched.name}" — using first`);
        }
        xlsxNameToDbId.set(matched.id, normName);

        // Skip if this DB ingredient already had its cost updated by a previous xlsx row
        if (processedCosts.has(matched.id)) {
          costsSkipped++;
          continue;
        }

        const invUnit = ingList.find((i) => i.id === matched.id)?.unit ?? 'g';

        // Calculate cost in the inventory's native unit
        let unitCost = 0;
        if (invUnit === 'kg' || invUnit === 'L') {
          unitCost = costPerKg;
        } else if (invUnit === 'g') {
          unitCost = costPerKg > 0 ? costPerKg / 1000 : 0;
        } else if (invUnit === 'pz' || invUnit === 'fette' || invUnit === 'pacchi') {
          unitCost = costPerPiece;
        } else {
          unitCost = costPerKg;
        }

        if (unitCost > 0) {
          await db
            .update(inventory)
            .set({ unitCost: unitCost.toFixed(4) })
            .where(and(eq(inventory.id, matched.id), eq(inventory.tenantId, tenantId)));

          costMatches.push({ xlsxName, matchedTo: matched.name, unitCost });
          costsUpdated++;
          processedCosts.add(matched.id);
        } else {
          costsSkipped++;
        }
      }
    }

    // ── Phase 2: Parse recipe tabs → create/update BOM links ────────
    const RECIPE_SHEETS = ['Antipasti', 'Panini', 'Special'];
    for (const sheetName of RECIPE_SHEETS) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
      if (data.length < 2) continue;

      // Row 0: menu item names starting from column B
      const menuNames = (data[0] as unknown[]).slice(1) as string[];

      for (let r = 1; r < data.length; r++) {
        const row = data[r] as unknown[];
        const xlsxIngName = String(row[0] ?? '').trim();
        if (!xlsxIngName) continue;

        const matchedIng = this.fuzzyFind(xlsxIngName, ingList, this.INGREDIENT_ALIASES);
        if (!matchedIng) {
          continue;
        }

        // Determine the unit to store quantity in (match inventory unit)
        const invUnit = ingList.find((i) => i.id === matchedIng.id)?.unit ?? 'g';

        for (let c = 0; c < menuNames.length; c++) {
          const rawQty = row[c + 1];
          if (rawQty == null || rawQty === '' || rawQty === 0) continue;
          const qty = Number(rawQty);
          if (!qty || qty <= 0) continue;

          const xlsxMenuName = String(menuNames[c] ?? '').trim();
          if (!xlsxMenuName) continue;

          const matchedMenu = this.fuzzyFind(xlsxMenuName, menuList, this.MENU_ITEM_ALIASES);
          if (!matchedMenu) {
            errors.push(`Menu item not found: "${xlsxMenuName}"`);
            recipesSkipped++;
            continue;
          }

          // Deduplicate: skip if this exact ingredient-menu pair was already processed
          const pairKey = `${matchedMenu.id}:${matchedIng.id}`;
          if (processedPairs.has(pairKey)) {
            errors.push(`Duplicate skipped: "${matchedIng.name}" × "${matchedMenu.name}" (already imported from another row)`);
            recipesSkipped++;
            continue;
          }
          processedPairs.add(pairKey);

          // Convert quantity: xlsx qty is number of portions; multiply by grams-per-portion
          const gramsPP = gramsPerPortionMap.get(this.normalizeName(xlsxIngName)) ?? 0;
          let storeQty = qty;
          let storeUnit = 'g';
          if (invUnit === 'kg') {
            storeQty = (gramsPP * qty) / 1000;
            storeUnit = 'kg';
          } else if (invUnit === 'pz' || invUnit === 'fette' || invUnit === 'pacchi') {
            storeQty = qty;
            storeUnit = invUnit;
          } else if (invUnit === 'g') {
            storeQty = gramsPP > 0 ? gramsPP * qty : qty;
            storeUnit = 'g';
          } else {
            storeQty = gramsPP > 0 ? gramsPP * qty : qty;
            storeUnit = invUnit;
          }

          try {
            await this.updateFoodCostMatrixCell(matchedMenu.id, matchedIng.id, storeQty, storeUnit);
            recipeMatches.push({ ingredient: matchedIng.name, menuItem: matchedMenu.name, qty: storeQty });
            recipesImported++;
          } catch (e) {
            errors.push(`Failed: ${matchedMenu.name} × ${matchedIng.name}: ${(e as Error).message}`);
            recipesSkipped++;
          }
        }
      }
    }

    return { costsUpdated, costsSkipped, recipesImported, recipesSkipped, costMatches, recipeMatches, errors };
  }

  /**
   * Full food cost import from pre-parsed data (used by frontend).
   */
  async importFoodCostFull(
    ingredientCosts: Array<{ name: string; costPerKg: number; costPerPiece: number; gramsPerPortion: number; piecesPerPortion: number }>,
    recipeRows: Array<{ ingredientName: string; menuItemName: string; quantity: number; unit: string }>,
  ): Promise<{
    costsUpdated: number;
    recipesImported: number;
    recipesSkipped: number;
    errors: string[];
  }> {
    const tenantId = getTenantIdOrDefault();
    const errors: string[] = [];
    let costsUpdated = 0;
    let recipesImported = 0;
    let recipesSkipped = 0;

    // Fetch all existing inventory + menu items for fuzzy matching
    const [ingRows, menuRows] = await Promise.all([
      db.select({ id: inventory.id, name: inventory.name })
        .from(inventory).where(eq(inventory.tenantId, tenantId)),
      db.select({ id: menuItems.id, name: menuItems.name })
        .from(menuItems).where(eq(menuItems.tenantId, tenantId)),
    ]);
    const ingList = ingRows.map((i) => ({ id: i.id, name: i.name }));
    const menuList = menuRows.map((m) => ({ id: m.id, name: m.name }));

    // Track processed pairs to prevent duplicates
    const processedPairs = new Set<string>();
    // Track which DB ingredient IDs already had their cost updated
    const processedCosts = new Set<string>();

    for (const cost of ingredientCosts) {
      const matched = this.fuzzyFind(cost.name, ingList, this.INGREDIENT_ALIASES);
      if (!matched) {
        errors.push(`Ingredient not found: "${cost.name}"`);
        continue;
      }
      if (processedCosts.has(matched.id)) continue;
      let unitCost = 0;
      if (cost.costPerPiece > 0 && cost.piecesPerPortion > 0) {
        unitCost = cost.costPerPiece;
      } else if (cost.costPerKg > 0 && cost.gramsPerPortion > 0) {
        unitCost = (cost.costPerKg / 1000) * cost.gramsPerPortion;
      } else if (cost.costPerPiece > 0) {
        unitCost = cost.costPerPiece;
      } else if (cost.costPerKg > 0) {
        unitCost = cost.costPerKg;
      }
      if (unitCost > 0) {
        await db.update(inventory).set({ unitCost: unitCost.toFixed(4) })
          .where(and(eq(inventory.id, matched.id), eq(inventory.tenantId, tenantId)));
        costsUpdated++;
        processedCosts.add(matched.id);
      }
    }

    for (const row of recipeRows) {
      const matchedIng = this.fuzzyFind(row.ingredientName, ingList, this.INGREDIENT_ALIASES);
      const matchedMenu = this.fuzzyFind(row.menuItemName, menuList, this.MENU_ITEM_ALIASES);
      if (!matchedMenu) { errors.push(`Menu item not found: "${row.menuItemName}"`); recipesSkipped++; continue; }
      if (!matchedIng) { errors.push(`Ingredient not found: "${row.ingredientName}"`); recipesSkipped++; continue; }

      // Deduplicate: skip if this exact ingredient-menu pair was already processed
      const pairKey = `${matchedMenu.id}:${matchedIng.id}`;
      if (processedPairs.has(pairKey)) {
        errors.push(`Duplicate skipped: "${row.ingredientName}" × "${row.menuItemName}" (already imported)`);
        recipesSkipped++;
        continue;
      }
      processedPairs.add(pairKey);

      try {
        await this.updateFoodCostMatrixCell(matchedMenu.id, matchedIng.id, row.quantity, row.unit);
        recipesImported++;
      } catch (e) {
        errors.push(`Failed: ${row.menuItemName} × ${row.ingredientName}: ${(e as Error).message}`);
        recipesSkipped++;
      }
    }

    return { costsUpdated, recipesImported, recipesSkipped, errors };
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

  // ─── Print Bridges ─────────────────────────────────────────────────────────

  async upsertPrintBridge(payload: {
    bridgeId: string;
    name?: string;
    host?: string | null;
    version?: string | null;
    areas: string[];
    printers: Array<{ area: string; name: string; ip?: string | null; port?: number }>;
  }, instanceId?: string, overrideTenantId?: string): Promise<PrintBridge> {
    const tenantId = overrideTenantId ?? this.currentTenantId();
    // Cross-tenant bridge_id collision pre-flight.
    const crossTenantCollision = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.id, payload.bridgeId), ne(printBridges.tenantId, tenantId)),
    });
    if (crossTenantCollision) {
      throw new Error();
    }
    const existing = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, payload.bridgeId)),
    });
    const now = new Date();
    const areasJson = JSON.stringify(payload.areas);
    const printersJson = JSON.stringify(payload.printers);
    if (existing) {
      await db
        .update(printBridges)
        .set({
          name: payload.name ?? existing.name,
          host: payload.host ?? existing.host,
          version: payload.version ?? existing.version,
          status: "active",
          areas: areasJson,
          printers: printersJson,
          lastHeartbeatAt: now,
          updatedAt: now,
        })
        .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, payload.bridgeId)));
    } else {
      await db.insert(printBridges).values({
        id: payload.bridgeId,
        tenantId,
        name: payload.name ?? payload.bridgeId,
        host: payload.host ?? null,
        version: payload.version ?? null,
        status: "active",
        areas: areasJson,
        printers: printersJson,
        lastHeartbeatAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    return (await this.getPrintBridge(payload.bridgeId))!;
  }

  async listPrintBridges(): Promise<PrintBridge[]> {
    const tenantId = this.currentTenantId();
    const rows = await db
      .select()
      .from(printBridges)
      .where(eq(printBridges.tenantId, tenantId))
      .orderBy(desc(printBridges.lastHeartbeatAt));
    return rows.map((r) => this.toPrintBridge(r));
  }

  async getPrintBridge(bridgeId: string): Promise<PrintBridge | null> {
    const tenantId = this.currentTenantId();
    const row = await db.query.printBridges.findFirst({
      where: and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, bridgeId)),
    });
    return row ? this.toPrintBridge(row) : null;
  }

  private async reclaimStalePrintJobClaims(tenantId: string): Promise<void> {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    await db.update(printJobs)
      .set({ bridgeId: null, claimedByInstanceId: null, claimedAt: null, status: 'pending' })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.status, 'dispatched'), lt(printJobs.claimedAt, cutoff)));
  }

  async claimPrintJobsForBridge(bridgeId: string, limit: number, instanceId: string, overrideTenantId?: string): Promise<PrintJob[]> {
    const tenantId = overrideTenantId ?? this.currentTenantId();
    await this.reclaimStalePrintJobClaims(tenantId);
    const bridge = await this.getPrintBridge(bridgeId);
    if (!bridge || bridge.areas.length === 0) return [];

    const claimed = await db
      .update(printJobs)
      .set({ status: 'dispatched', bridgeId, claimedByInstanceId: instanceId, claimedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(printJobs.tenantId, tenantId),
          eq(printJobs.status, 'pending'),
          or(isNull(printJobs.bridgeId), eq(printJobs.bridgeId, bridgeId)),
          inArray(printJobs.area, bridge.areas),
        ),
      )
      .returning();
    return (claimed ?? []).slice(0, limit).map((r) => printJobSchema.parse(r));
  }

  async completeBridgeJob(bridgeId: string, jobId: string, notes: string | undefined, instanceId: string, overrideTenantId?: string): Promise<PrintJob | null> {
    const tenantId = overrideTenantId ?? this.currentTenantId();
    const existing = await db.query.printJobs.findFirst({
      where: and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, jobId), eq(printJobs.claimedByInstanceId, instanceId)),
    });
    if (!existing || existing.bridgeId !== bridgeId) {
      return null;
    }
    const [row] = await db
      .update(printJobs)
      .set({
        status: "completed",
        error: notes ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, jobId)))
      .returning();
    return row ? printJobSchema.parse(row) : null;
  }

  async failBridgeJob(bridgeId: string, jobId: string, error: string, instanceId: string, overrideTenantId?: string): Promise<PrintJob | null> {
    const tenantId = overrideTenantId ?? this.currentTenantId();
    const existing = await db.query.printJobs.findFirst({
      where: and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, jobId), eq(printJobs.claimedByInstanceId, instanceId)),
    });
    if (!existing || existing.bridgeId !== bridgeId) {
      return null;
    }
    const [row] = await db
      .update(printJobs)
      .set({
        status: "failed",
        error: error.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(and(eq(printJobs.tenantId, tenantId), eq(printJobs.id, jobId)))
      .returning();
    return row ? printJobSchema.parse(row) : null;
  }

  // ─── Print Bridge Onboarding Secrets ───────────────────────────────────

  private hashBridgeSecret(plaintext: string): string {
    const pepper = process.env.PRINT_BRIDGE_SECRET_PEPPER?.trim();
    if (pepper) {
      return crypto.createHmac("sha256", pepper).update(plaintext).digest("hex");
    }
    return crypto.createHash("sha256").update(plaintext).digest("hex");
  }

  /**
   * Hash for 6-digit ephemeral codes. Uses HMAC-SHA256 with the global SHORT_CODE_PEPPER
   * so a DB leak does not yield codes offline. Throws if pepper is not configured —
   * callers should catch and return null so admins see a clear misconfiguration error.
   */
  private hashShortCode(code: string): string {
    const pepper = process.env.SHORT_CODE_PEPPER?.trim();
    if (!pepper) {
      throw new Error("SHORT_CODE_PEPPER env var is not set; cannot authenticate 6-digit codes");
    }
    return crypto.createHmac("sha256", pepper).update(code).digest("hex");
  }

  async listOnboardingSecrets(tenantId: string): Promise<PrintBridgeOnboardingSecret[]> {
    const rows = await db
      .select({
        id: printBridgeOnboardingSecrets.id,
        tenantId: printBridgeOnboardingSecrets.tenantId,
        suggestedBridgeId: printBridgeOnboardingSecrets.suggestedBridgeId,
        boundBridgeId: printBridgeOnboardingSecrets.boundBridgeId,
        lastUsedAt: printBridgeOnboardingSecrets.lastUsedAt,
        revokedAt: printBridgeOnboardingSecrets.revokedAt,
        createdByStaffId: printBridgeOnboardingSecrets.createdByStaffId,
        createdAt: printBridgeOnboardingSecrets.createdAt,
      })
      .from(printBridgeOnboardingSecrets)
      .where(eq(printBridgeOnboardingSecrets.tenantId, tenantId))
      .orderBy(desc(printBridgeOnboardingSecrets.createdAt));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      suggestedBridgeId: r.suggestedBridgeId,
      boundBridgeId: r.boundBridgeId ?? null,
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      createdByStaffId: r.createdByStaffId ?? null,
      createdAt: r.createdAt.toISOString(),
      isActive: r.revokedAt == null,
    }));
  }

  async createOnboardingSecret(
    tenantId: string,
    createdByStaffId: string | null,
    bridgeIdHint?: string,
    mode: "long" | "code-6digit" = "long",
    options?: { publicBaseUrl?: string },
  ): Promise<PrintBridgeOnboardingSecretCreateResponse | PrintBridgeOnboardingSecretCreateCode6DigitResponse> {
    const id = `obs_${crypto.randomBytes(8).toString("hex")}`;
    const safeHint = (bridgeIdHint ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);
    const suggestedBridgeId = `bridge_${safeHint || "auto"}_${crypto.randomBytes(3).toString("hex")}`;
    const now = new Date();

    if (mode === "code-6digit") {
      const pepper = process.env.SHORT_CODE_PEPPER?.trim();
      if (!pepper) {
        throw new Error("SHORT_CODE_PEPPER env var is not set; cannot mint 6-digit codes");
      }
      // The 6-digit space is small but the 90s TTL makes global collisions
      // essentially zero; the loop is a defensive guard.
      let code: string;
      let shortCodeHash: string;
      let attempts = 0;
      while (true) {
        attempts++;
        code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
        shortCodeHash = crypto.createHmac("sha256", pepper).update(code).digest("hex");
        const conflict = await db.query.printBridgeOnboardingSecrets.findFirst({
          where: eq(printBridgeOnboardingSecrets.shortCodeHash, shortCodeHash),
        });
        if (!conflict) break;
        if (attempts > 5) throw new Error("Failed to mint a unique 6-digit code after multiple attempts");
      }
      const shortCodeExpiresAt = new Date(now.getTime() + 90_000);

      await db.insert(printBridgeOnboardingSecrets).values({
        id,
        tenantId,
        // secretHash is NOT NULL on prod; placeholder never matched by hashBridgeSecret.
        secretHash: `code6_${id}`,
        shortCodeHash,
        shortCodeExpiresAt,
        suggestedBridgeId,
        boundBridgeId: null,
        lastUsedAt: null,
        revokedAt: null,
        createdByStaffId: createdByStaffId ?? null,
        createdAt: now,
      });

      const publicBaseUrl = (
        options?.publicBaseUrl
          ?? process.env.PRINT_BRIDGE_PUBLIC_BASE_URL
          ?? process.env.PUBLIC_BASE_URL
          ?? "http://localhost:11900"
      ).replace(/\/+$/, "");
      const qrPayload = `${publicBaseUrl}/print-station?code=${code}&tenant=${encodeURIComponent(tenantId)}&bridgeHint=${encodeURIComponent(suggestedBridgeId)}`;

      return {
        mode: "code-6digit",
        secretId: id,
        code,
        qrPayload,
        ttlSeconds: 90,
        expiresAt: shortCodeExpiresAt.toISOString(),
        suggestedBridgeId,
      };
    }

    // Long-secret mode (existing behavior preserved verbatim).
    const randomBytes = crypto.randomBytes(32);
    const b64url = randomBytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    const plaintext = `pbos_${b64url}`;
    const secretHash = this.hashBridgeSecret(plaintext);

    await db.insert(printBridgeOnboardingSecrets).values({
      id,
      tenantId,
      secretHash,
      suggestedBridgeId,
      boundBridgeId: null,
      lastUsedAt: null,
      revokedAt: null,
      createdByStaffId: createdByStaffId ?? null,
      createdAt: now,
    });

    const admin: PrintBridgeOnboardingSecret = {
      id,
      tenantId,
      suggestedBridgeId,
      boundBridgeId: null,
      lastUsedAt: null,
      revokedAt: null,
      createdByStaffId: createdByStaffId ?? null,
      createdAt: now.toISOString(),
      isActive: true,
    };

    const bootstrapSnippet = [
      `# Esegui sul PC cucina dopo aver installato QZ Tray:`,
      `PRINT_BRIDGE_ID="${suggestedBridgeId}"`,
      `PRINT_BRIDGE_SECRET="${plaintext}"`,
      `PRINT_BRIDGE_AREAS="kitchen,bar,cashier"`,
      `pm2 start ecosystem.hmr.config.cjs --only gustopos-print-bridge`,
    ].join("\n");

    return {
      mode: "long",
      secret: admin,
      plaintext,
      suggestedBridgeId,
      bootstrapSnippet,
    };
  }

  async revokeOnboardingSecret(tenantId: string, id: string): Promise<void> {
    await db
      .update(printBridgeOnboardingSecrets)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(printBridgeOnboardingSecrets.tenantId, tenantId),
          eq(printBridgeOnboardingSecrets.id, id),
          isNull(printBridgeOnboardingSecrets.revokedAt),
        ),
      );
  }

  async resolveOnboardingSecret(plaintext: string): Promise<{
    secretId: string;
    tenantId: string;
    suggestedBridgeId: string;
    boundBridgeId: string | null;
    revokedAt: Date | null;
  } | null> {
    const hash = this.hashBridgeSecret(plaintext);
    const row = await db.query.printBridgeOnboardingSecrets.findFirst({
      where: eq(printBridgeOnboardingSecrets.secretHash, hash),
    });
    if (!row) return null;
    return {
      secretId: row.id,
      tenantId: row.tenantId,
      suggestedBridgeId: row.suggestedBridgeId,
      boundBridgeId: row.boundBridgeId ?? null,
      revokedAt: row.revokedAt ?? null,
    };
  }

  /**
   * Resolve by 6-digit ephemeral code. Returns null if code is invalid, expired,
   * revoked, or SHORT_CODE_PEPPER is not configured (so 6-digit path is silently
   * disabled in environments that haven't opted in).
   */
  async resolveOnboardingSecretByShortCode(code: string): Promise<{
    secretId: string;
    tenantId: string;
    suggestedBridgeId: string;
    boundBridgeId: string | null;
    revokedAt: Date | null;
  } | null> {
    let hash: string;
    try {
      hash = this.hashShortCode(code);
    } catch {
      return null;
    }
    const now = new Date();
    const row = await db.query.printBridgeOnboardingSecrets.findFirst({
      where: and(
        eq(printBridgeOnboardingSecrets.shortCodeHash, hash),
        isNotNull(printBridgeOnboardingSecrets.shortCodeHash),
        gt(printBridgeOnboardingSecrets.shortCodeExpiresAt, now),
        isNull(printBridgeOnboardingSecrets.revokedAt),
      ),
    });
    if (!row) return null;
    return {
      secretId: row.id,
      tenantId: row.tenantId,
      suggestedBridgeId: row.suggestedBridgeId,
      boundBridgeId: row.boundBridgeId ?? null,
      revokedAt: row.revokedAt ?? null,
    };
  }

  /**
   * Idempotent first-bind for the 6-digit path. Same code may be presented multiple
   * times within the 90s window (auto-retry on transient network errors), so we
   * do NOT consume/revoke the code — only update lastUsedAt and bind on first hit.
   */
  async markShortCodeFirstBind(
    code: string,
    bridgeId: string,
  ): Promise<{ firstBind: boolean; tenantId: string; suggestedBridgeId: string } | null> {
    let hash: string;
    try {
      hash = this.hashShortCode(code);
    } catch {
      return null;
    }
    const now = new Date();
    // Atomic CAS: only assign boundBridgeId if currently null. Postgres serializes
    // UPDATE...RETURNING under row-level lock, so exactly one concurrent caller
    // wins and others see 0 rows updated (fall through to touch).
    const claimed = await db
      .update(printBridgeOnboardingSecrets)
      .set({ boundBridgeId: bridgeId, lastUsedAt: now })
      .where(
        and(
          eq(printBridgeOnboardingSecrets.shortCodeHash, hash),
          isNotNull(printBridgeOnboardingSecrets.shortCodeHash),
          gt(printBridgeOnboardingSecrets.shortCodeExpiresAt, now),
          isNull(printBridgeOnboardingSecrets.revokedAt),
          isNull(printBridgeOnboardingSecrets.boundBridgeId),
        ),
      )
      .returning({
        tenantId: printBridgeOnboardingSecrets.tenantId,
        suggestedBridgeId: printBridgeOnboardingSecrets.suggestedBridgeId,
      });
    if (claimed.length > 0) {
      return {
        firstBind: true,
        tenantId: claimed[0].tenantId,
        suggestedBridgeId: claimed[0].suggestedBridgeId,
      };
    }
    // Already bound (same bridge retrying, or different bridge's race lost). Touch only.
    const touched = await db
      .update(printBridgeOnboardingSecrets)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(printBridgeOnboardingSecrets.shortCodeHash, hash),
          isNotNull(printBridgeOnboardingSecrets.shortCodeHash),
          gt(printBridgeOnboardingSecrets.shortCodeExpiresAt, now),
          isNull(printBridgeOnboardingSecrets.revokedAt),
        ),
      )
      .returning({
        tenantId: printBridgeOnboardingSecrets.tenantId,
        suggestedBridgeId: printBridgeOnboardingSecrets.suggestedBridgeId,
      });
    if (touched.length === 0) return null;
    return {
      firstBind: false,
      tenantId: touched[0].tenantId,
      suggestedBridgeId: touched[0].suggestedBridgeId,
    };
  }

  async markOnboardingSecretUsed(
    plaintext: string,
    bridgeId: string,
  ): Promise<{ firstBind: boolean }> {
    const hash = this.hashBridgeSecret(plaintext);
    const existing = await db.query.printBridgeOnboardingSecrets.findFirst({
      where: eq(printBridgeOnboardingSecrets.secretHash, hash),
    });
    if (!existing) return { firstBind: false };
    const now = new Date();
    const firstBind = existing.boundBridgeId == null;
    await db
      .update(printBridgeOnboardingSecrets)
      .set({
        lastUsedAt: now,
        boundBridgeId: firstBind ? bridgeId : existing.boundBridgeId ?? bridgeId,
      })
      .where(eq(printBridgeOnboardingSecrets.id, existing.id));
    return { firstBind };
  }

  private toPrintBridge(row: typeof printBridges.$inferSelect): PrintBridge {
    let areas: PrintArea[] = [];
    let printers: Array<{ area: PrintArea; name: string; ip?: string | null; port?: number }> = [];
    try {
      const parsedAreas = JSON.parse(row.areas);
      if (Array.isArray(parsedAreas)) {
        areas = parsedAreas
          .filter((a): a is PrintArea => a === "kitchen" || a === "bar" || a === "cashier");
      }
    } catch {
      areas = [];
    }
    try {
      const parsedPrinters = JSON.parse(row.printers);
      if (Array.isArray(parsedPrinters)) {
        printers = parsedPrinters
          .filter((p): p is { area: string; name: string; ip?: string | null; port?: number } =>
            typeof p === "object" && p !== null && typeof (p as any).name === "string")
          .map((p) => {
            const area = (p as any).area;
            const safeArea: PrintArea = area === "kitchen" || area === "bar" || area === "cashier" ? area : "kitchen";
            return {
              name: (p as any).name as string,
              area: safeArea,
              ip: (p as any).ip ?? null,
              port: typeof (p as any).port === "number" ? (p as any).port : undefined,
            };
          });
      }
    } catch {
      printers = [];
    }

    let mappings: PrintBridgePrinterMapping[] = [];
    try {
      const parsedMappings = JSON.parse(row.mappings);
      if (Array.isArray(parsedMappings)) {
        const zodSafe = z.array(printBridgePrinterMappingSchema).safeParse(parsedMappings);
        if (zodSafe.success) {
          mappings = zodSafe.data.map((m) => ({ area: m.area, name: m.name, ip: m.ip, port: m.port }));
        } else {
          console.warn(`[print-bridge] mappings for ${row.id} failed Zod validation; using lenient fallback`);
          mappings = parsedMappings
          .filter(
            (m): m is { area: string; name: string; ip?: string | null; port?: number } =>
              typeof m === "object" && m !== null && typeof (m as any).name === "string",
          )
          .map((m): PrintBridgePrinterMapping | null => {
            const safeArea: PrintArea =
              (m as any).area === "kitchen" || (m as any).area === "bar" || (m as any).area === "cashier"
                ? ((m as any).area as PrintArea)
                : "kitchen";
            const name = typeof (m as any).name === "string" && (m as any).name.length > 0
              ? ((m as any).name as string)
              : null;
            if (name === null) return null; // skip rows missing a printer name (server Zod would 400 anyway)
            return {
              area: safeArea,
              name,
              ip: typeof (m as any).ip === "string" ? ((m as any).ip as string) : undefined,
              port: typeof (m as any).port === "number" ? ((m as any).port as number) : undefined,
            };
          })
          .filter((m): m is PrintBridgePrinterMapping => m !== null);
      }
      }
    } catch {
      mappings = [];
    }
    let claimedAreas: PrintArea[] = [];
    try {
      const parsedClaimed = JSON.parse(row.claimedAreas);
      if (Array.isArray(parsedClaimed)) {
        const zodSafe = z.array(printAreaSchema).safeParse(parsedClaimed);
        if (zodSafe.success) {
          claimedAreas = zodSafe.data;
        } else {
          console.warn(`[print-bridge] claimedAreas for ${row.id} failed Zod validation; using lenient fallback`);
          claimedAreas = parsedClaimed.filter(
          (a): a is PrintArea => a === "kitchen" || a === "bar" || a === "cashier",
        );
      }
      }
    } catch {
      claimedAreas = [];
    }
    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      host: row.host ?? null,
      version: row.version ?? null,
      status: row.status as "active" | "offline",
      areas,
      printers,
      lastHeartbeatAt: row.lastHeartbeatAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      mappings,
      claimedAreas,
    };
  }

  // ─── Print Bridges Phase B: admin-updateable settings + test print dispatcher ──

  async updateBridgeMappings(bridgeId: string, mappings: Array<{ area: PrintArea; name: string; ip?: string | null; port?: number | null }>): Promise<PrintBridge> {
    const tenantId = this.currentTenantId();
    const id = bridgeId;
    await db
      .update(printBridges)
      .set({ mappings: JSON.stringify(mappings), updatedAt: new Date() })
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, id)));
    const rows = await db
      .select()
      .from(printBridges)
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error(`Bridge ${id} not found`);
    return this.toPrintBridge(row);
  }

  async updateBridgeClaimedAreas(bridgeId: string, claimedAreas: PrintArea[]): Promise<PrintBridge> {
    const tenantId = this.currentTenantId();
    const id = bridgeId;
    await db
      .update(printBridges)
      .set({ claimedAreas: JSON.stringify(claimedAreas), updatedAt: new Date() })
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, id)));
    const rows = await db
      .select()
      .from(printBridges)
      .where(and(eq(printBridges.tenantId, tenantId), eq(printBridges.id, id)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new Error(`Bridge ${id} not found`);
    return this.toPrintBridge(row);
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
        payload: `Brigde: ${bridgeRow.name}\nArea: ${area}\nTest: ${message ?? "(nessun messaggio)"}`.replace(/\n/g, "\n"),
        error: null,
        createdAt: now,
        updatedAt: now,
        dispatchedAt: null,
      });
    });

    return { jobId, bridgeId, area, orderId };
  }
}

