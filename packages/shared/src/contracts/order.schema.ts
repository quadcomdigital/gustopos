import { z } from "zod";

// ─── Order Enums ────────────────────────────────────────────────────────────

export const orderStatusSchema = z.enum([
  "pending",
  "preparing",
  "ready",
  "served",
  "paid",
  "cancelled",
]);

export const orderTypeSchema = z.enum(["dine_in", "takeaway", "delivery"]);

/**
 * Review gate for public group orders. A submitted group order is created as
 * `pending_approval` and only becomes a real order (printed, stock deducted)
 * once staff approves. Normal orders stay `not_required`.
 */
export const orderApprovalStatusSchema = z.enum([
  "not_required",
  "pending_approval",
  "approved",
  "rejected",
]);

// ─── Order Item ─────────────────────────────────────────────────────────────

export const orderItemSchema = z.object({
  id: z.string().min(1),
  orderItemId: z.number().int().positive().optional(),
  name: z.string().min(1),
  price: z.number().nonnegative('Price cannot be negative'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  round: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().max(200).optional(),
  skipKitchenPrint: z.boolean().optional(),
  ingredientOverrides: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        action: z.enum(["add", "remove"]),
      }),
    )
    .optional(),
  selectedModifiers: z
    .array(
      z.object({
        groupId: z.string().min(1),
        optionId: z.string().min(1),
      }),
    )
    .optional(),
});

// ─── Order ──────────────────────────────────────────────────────────────────

export const orderSchema = z.object({
  id: z.string(),
  orderType: orderTypeSchema,
  table: z.string().optional(),
  ticketNumber: z.string().optional(),
  customerName: z.string().optional(),
  customerId: z.string().optional(),
  customerPhone: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  items: z.array(orderItemSchema),
  total: z.number().nonnegative(),
  status: orderStatusSchema,
  timestamp: z.string(),
  staffId: z.string().min(1),
  approvalStatus: orderApprovalStatusSchema.optional(),
  rejectionReason: z.string().optional(),
});

// ─── Create / Update / Void ─────────────────────────────────────────────────

export const createOrderRequestSchema = z.object({
  orderType: orderTypeSchema.optional(),
  table: z.string().optional(),
  customerName: z.string().min(2).max(120).optional(),
  customerId: z.string().optional(),
  customerPhone: z.string().max(30).optional(),
  pickupEta: z.string().datetime().optional(),
  items: z.array(orderItemSchema).min(1, 'Order must have at least 1 item'),
  total: z.number().positive('Order total must be positive'),
  staffId: z.string().min(1, 'Staff ID is required'),
});

export const updateOrderRequestSchema = z.object({
  status: orderStatusSchema.optional(),
  items: z.array(z.object({
    orderItemId: z.number().int().positive(),
    quantity: z.number().int().min(0),
  })).optional(),
});

export const updateOrderItemQuantityRequestSchema = z.object({
  quantity: z.number().int().min(0),
});

export type UpdateOrderItemQuantityRequest = z.infer<typeof updateOrderItemQuantityRequestSchema>;

export const voidOrderRequestSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const voidOrderResponseSchema = z.object({
  success: z.boolean(),
  order: orderSchema,
});

// ─── History ────────────────────────────────────────────────────────────────

export const orderHistoryFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: orderStatusSchema.optional(),
  orderType: orderTypeSchema.optional(),
  staffId: z.string().optional(),
  table: z.string().optional(),
  customerId: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const orderHistoryListResponseSchema = z.array(orderSchema);

// ─── Sales summary (dashboard KPI) ─────────────────────────────────────────
//
// The dashboard used to derive Incasso/Ordini/Scontrino/Top5 from the bootstrapped
// `data.orders`, which deliberately holds ONLY open orders (paid/cancelled are
// excluded by getPublicData) — so every counter was permanently zero. These
// aggregates are computed server-side, tenant-scoped, over paid orders only.

export const salesSummaryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const salesTopDishSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
});

export const salesSummarySchema = z.object({
  /** Window the numbers refer to, echoed back so the UI can label it. */
  from: z.string().nullable(),
  to: z.string().nullable(),
  revenue: z.number().nonnegative(),
  orders: z.number().int().nonnegative(),
  avgOrderValue: z.number().nonnegative(),
  topDishes: z.array(salesTopDishSchema),
});

// ─── Dashboard visibility log ──────────────────────────────────────────────
//
// The € counters are masked by default (privacy on a shared floor). Reveal/hide
// is audited server-side, next to order.void and payment.refund.

export const dashboardVisibilityActionSchema = z.enum(["reveal", "hide"]);

export const dashboardVisibilityLogRequestSchema = z.object({
  action: dashboardVisibilityActionSchema,
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderType = z.infer<typeof orderTypeSchema>;
export type OrderApprovalStatus = z.infer<typeof orderApprovalStatusSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderRequestSchema>;
export type VoidOrderRequest = z.infer<typeof voidOrderRequestSchema>;
export type VoidOrderResponse = z.infer<typeof voidOrderResponseSchema>;
export type OrderHistoryFilters = z.infer<typeof orderHistoryFiltersSchema>;
export type OrderHistoryListResponse = z.infer<typeof orderHistoryListResponseSchema>;
export type SalesSummaryQuery = z.infer<typeof salesSummaryQuerySchema>;
export type SalesTopDish = z.infer<typeof salesTopDishSchema>;
export type SalesSummary = z.infer<typeof salesSummarySchema>;
export type DashboardVisibilityAction = z.infer<typeof dashboardVisibilityActionSchema>;
export type DashboardVisibilityLogRequest = z.infer<typeof dashboardVisibilityLogRequestSchema>;
