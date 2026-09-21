import { z } from "zod";
import { printAreaSchema } from "../contracts/shared.schema";
import { orderSchema, orderItemSchema } from "../contracts/order.schema";

// ─── Public Menu ───────────────────────────────────────────────────────

export const publicMenuCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  stationId: z.string().nullable().optional(),
  printAreas: z.array(printAreaSchema),
});

export const publicMenuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  categoryId: z.string().optional(),
  category: z.string(),
  ingredients: z.array(z.string()),
  bomIds: z.array(z.string()),
  stationId: z.string().nullable().optional(),
  printAreas: z.array(printAreaSchema),
  isFeatured: z.boolean().default(false),
  isSoldOut: z.boolean().default(false),
});

export const publicMenuBrandingSchema = z.object({
  preset: z.enum(["minimal_elegant", "rich_visual", "modern_bistro"]).default("minimal_elegant"),
  logoUrl: z
    .string()
    .refine((value) => /^https?:\/\//.test(value) || /^data:image\//.test(value), "Invalid logo URL")
    .optional(),
  heroImageUrl: z
    .string()
    .refine((value) => /^https?:\/\//.test(value) || /^data:image\//.test(value), "Invalid hero image URL")
    .optional(),
  brandTagline: z.string().max(120).optional(),
  showIngredients: z.boolean().default(true),
  showPrices: z.boolean().default(true),
  currency: z.string().max(8).default("EUR"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f172a"),
});

export const publicMenuModuleConfigSchema = publicMenuBrandingSchema.extend({
  categoryOrder: z.array(z.string()).default([]),
  hiddenCategoryIds: z.array(z.string()).default([]),
  featuredItemIds: z.array(z.string()).default([]),
  soldOutItemIds: z.array(z.string()).default([]),
});

export const publicMenuResponseSchema = z.object({
  tenant: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  branding: publicMenuBrandingSchema,
  capabilities: z.object({
    takeawayOrder: z.boolean().default(false),
    groupOrder: z.boolean().default(false),
    takeawayConfig: z.object({
      minOrderAmount: z.number().nonnegative().default(0),
      maxItems: z.number().int().positive().default(20),
      pickupEtaRequired: z.boolean().default(false),
      allowNotes: z.boolean().default(true),
    }),
  }),
  categories: z.array(publicMenuCategorySchema),
  items: z.array(publicMenuItemSchema),
  generatedAt: z.string(),
});

// ─── Public Takeaway ───────────────────────────────────────────────────

export const publicTakeawayCreateRequestSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  total: z.number().positive(),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().max(30).optional(),
  pickupEta: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const publicTakeawayCreateResponseSchema = z.object({
  order: orderSchema,
  trackingToken: z.string(),
  trackingUrl: z.string(),
});

export const publicTakeawayTrackingResponseSchema = z.object({
  order: orderSchema,
});

// ─── Group Order ───────────────────────────────────────────────────────

export const groupOrderSessionStatusSchema = z.enum(["open", "locked", "submitted", "expired"]);

export const groupOrderParticipantRoleSchema = z.enum(["master", "guest"]);

export const groupOrderCartItemSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  menuItemId: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  category: z.string(),
  ingredients: z.array(z.string()),
  updatedByParticipantId: z.string().optional(),
  updatedAt: z.string(),
});

export const groupOrderParticipantSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  displayName: z.string().min(2).max(120),
  role: groupOrderParticipantRoleSchema,
  isOnline: z.boolean().default(false),
  joinedAt: z.string(),
  lastSeenAt: z.string(),
});

export const groupOrderSessionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  tenantSlug: z.string(),
  joinCode: z.string(),
  status: groupOrderSessionStatusSchema,
  version: z.number().int().nonnegative(),
  masterParticipantId: z.string(),
  expiresAt: z.string(),
  submittedOrderId: z.string().optional(),
  participants: z.array(groupOrderParticipantSchema),
  items: z.array(groupOrderCartItemSchema),
  total: z.number().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const groupOrderCreateSessionRequestSchema = z.object({
  displayName: z.string().min(2).max(120),
});

export const groupOrderCreateSessionResponseSchema = z.object({
  session: groupOrderSessionSchema,
  participant: groupOrderParticipantSchema,
  participantToken: z.string().min(24),
  joinUrl: z.string(),
});

export const groupOrderJoinSessionRequestSchema = z.object({
  displayName: z.string().min(2).max(120),
});

export const groupOrderJoinSessionResponseSchema = z.object({
  session: groupOrderSessionSchema,
  participant: groupOrderParticipantSchema,
  participantToken: z.string().min(24),
});

export const groupOrderPatchCartRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      menuItemId: z.string().min(1),
      quantity: z.number().int().min(0),
    }),
  ),
});

export const groupOrderPatchCartResponseSchema = z.object({
  session: groupOrderSessionSchema,
  reconciled: z.boolean().default(false),
});

export const groupOrderSubmitRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(8).optional(),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().max(30).optional(),
  pickupEta: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const groupOrderSubmitResponseSchema = z.object({
  session: groupOrderSessionSchema,
  order: orderSchema,
});

export const groupOrderRealtimeJoinedSchema = z.object({
  session: groupOrderSessionSchema,
  participant: groupOrderParticipantSchema,
});

export const groupOrderRealtimeCartUpdatedSchema = z.object({
  session: groupOrderSessionSchema,
  byParticipantId: z.string(),
  reconciled: z.boolean().default(false),
});

export const groupOrderRealtimeMasterChangedSchema = z.object({
  sessionId: z.string(),
  masterParticipantId: z.string(),
});

export const groupOrderRealtimeSubmittedSchema = z.object({
  session: groupOrderSessionSchema,
  order: orderSchema,
});

// ─── Public Funnel Events ──────────────────────────────────────────────

export const publicFunnelEventRequestSchema = z.object({
  event: z.enum([
    "public_menu_view",
    "public_menu_add_to_cart",
    "public_menu_checkout_start",
    "public_takeaway_submit_success",
    "public_takeaway_tracking_view",
  ]),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const publicFunnelEventResponseSchema = z.object({
  success: z.literal(true),
});

// ─── Self-Order QR ─────────────────────────────────────────────────────

export const selfOrderSessionSchema = z.object({
  tableId: z.string(),
  tableNumber: z.string(),
  expiresAt: z.string(),
});

export const selfOrderResolveResponseSchema = z.object({
  session: selfOrderSessionSchema,
  menu: publicMenuResponseSchema,
});

export const selfOrderCreateRequestSchema = z.object({
  token: z.string().min(12),
  items: z.array(orderItemSchema).min(1),
  total: z.number().positive(),
  customerName: z.string().min(2).max(120).optional(),
  customerPhone: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
});

export const selfOrderCreateResponseSchema = z.object({
  order: orderSchema,
  sessionExpiresAt: z.string(),
});

export const selfOrderSessionRotateResponseSchema = z.object({
  tableId: z.string(),
  tableNumber: z.string(),
  token: z.string(),
  expiresAt: z.string(),
  publicUrl: z.string(),
});

// ─── Consumer Accounts ─────────────────────────────────────────────────

export const consumerUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  fullName: z.string().min(2),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const consumerRegisterRequestSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  password: z.string().min(6).max(120),
}).refine((payload) => Boolean(payload.email || payload.phone), {
  message: "Either email or phone is required",
});

export const consumerLoginRequestSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  password: z.string().min(6).max(120),
}).refine((payload) => Boolean(payload.email || payload.phone), {
  message: "Either email or phone is required",
});

export const consumerAuthResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: consumerUserSchema,
});

export const consumerRefreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export const consumerRefreshResponseSchema = consumerAuthResponseSchema;

export const consumerAccountsConfigSchema = z.object({
  registrationEnabled: z.boolean().default(true),
  requireAccountForTakeaway: z.boolean().default(false),
  requireAccountForSelfOrder: z.boolean().default(false),
});

export const consumerOrderHistoryItemSchema = z.object({
  order: orderSchema,
});

export const consumerOrderHistoryResponseSchema = z.array(consumerOrderHistoryItemSchema);

// ─── Types ─────────────────────────────────────────────────────────────

export type PublicMenuResponse = z.infer<typeof publicMenuResponseSchema>;
export type PublicTakeawayCreateRequest = z.infer<typeof publicTakeawayCreateRequestSchema>;
export type PublicTakeawayCreateResponse = z.infer<typeof publicTakeawayCreateResponseSchema>;
export type PublicTakeawayTrackingResponse = z.infer<typeof publicTakeawayTrackingResponseSchema>;
export type GroupOrderSessionStatus = z.infer<typeof groupOrderSessionStatusSchema>;
export type GroupOrderParticipantRole = z.infer<typeof groupOrderParticipantRoleSchema>;
export type GroupOrderCartItem = z.infer<typeof groupOrderCartItemSchema>;
export type GroupOrderParticipant = z.infer<typeof groupOrderParticipantSchema>;
export type GroupOrderSession = z.infer<typeof groupOrderSessionSchema>;
export type GroupOrderCreateSessionRequest = z.infer<typeof groupOrderCreateSessionRequestSchema>;
export type GroupOrderCreateSessionResponse = z.infer<typeof groupOrderCreateSessionResponseSchema>;
export type GroupOrderJoinSessionRequest = z.infer<typeof groupOrderJoinSessionRequestSchema>;
export type GroupOrderJoinSessionResponse = z.infer<typeof groupOrderJoinSessionResponseSchema>;
export type GroupOrderPatchCartRequest = z.infer<typeof groupOrderPatchCartRequestSchema>;
export type GroupOrderPatchCartResponse = z.infer<typeof groupOrderPatchCartResponseSchema>;
export type GroupOrderSubmitRequest = z.infer<typeof groupOrderSubmitRequestSchema>;
export type GroupOrderSubmitResponse = z.infer<typeof groupOrderSubmitResponseSchema>;
export type GroupOrderRealtimeJoined = z.infer<typeof groupOrderRealtimeJoinedSchema>;
export type GroupOrderRealtimeCartUpdated = z.infer<typeof groupOrderRealtimeCartUpdatedSchema>;
export type GroupOrderRealtimeMasterChanged = z.infer<typeof groupOrderRealtimeMasterChangedSchema>;
export type GroupOrderRealtimeSubmitted = z.infer<typeof groupOrderRealtimeSubmittedSchema>;
export type PublicFunnelEventRequest = z.infer<typeof publicFunnelEventRequestSchema>;
export type PublicFunnelEventResponse = z.infer<typeof publicFunnelEventResponseSchema>;
export type SelfOrderSession = z.infer<typeof selfOrderSessionSchema>;
export type SelfOrderResolveResponse = z.infer<typeof selfOrderResolveResponseSchema>;
export type SelfOrderCreateRequest = z.infer<typeof selfOrderCreateRequestSchema>;
export type SelfOrderCreateResponse = z.infer<typeof selfOrderCreateResponseSchema>;
export type SelfOrderSessionRotateResponse = z.infer<typeof selfOrderSessionRotateResponseSchema>;
export type ConsumerUser = z.infer<typeof consumerUserSchema>;
export type ConsumerRegisterRequest = z.infer<typeof consumerRegisterRequestSchema>;
export type ConsumerLoginRequest = z.infer<typeof consumerLoginRequestSchema>;
export type ConsumerAuthResponse = z.infer<typeof consumerAuthResponseSchema>;
export type ConsumerRefreshRequest = z.infer<typeof consumerRefreshRequestSchema>;
export type ConsumerRefreshResponse = z.infer<typeof consumerRefreshResponseSchema>;
export type ConsumerAccountsConfig = z.infer<typeof consumerAccountsConfigSchema>;
export type ConsumerOrderHistoryResponse = z.infer<typeof consumerOrderHistoryResponseSchema>;
