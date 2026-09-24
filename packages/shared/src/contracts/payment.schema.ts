import { z } from "zod";

// ─── Payment Enums ──────────────────────────────────────────────────────────

export const paymentMethodSchema = z.enum(["cash", "card", "mixed"]);
export const paymentKindSchema = z.enum(["sale", "refund"]);
export const paymentStatusSchema = z.enum(["pending", "captured", "failed", "voided"]);

// ─── Payment Item ───────────────────────────────────────────────────────────

export const paymentItemSchema = z.object({
  orderItemId: z.number().int().positive(),
  menuItemId: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});

// ─── Payment ────────────────────────────────────────────────────────────────

export const paymentSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  tableNumber: z.string(),
  subtotal: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  surchargeAmount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  method: paymentMethodSchema,
  kind: paymentKindSchema,
  paymentStatus: paymentStatusSchema,
  paidAmount: z.number().nonnegative(),
  changeAmount: z.number().nonnegative(),
  reference: z.string().optional(),
  gatewayReference: z.string().optional(),
  capturedAt: z.string().optional(),
  refundedPaymentId: z.string().optional(),
  refundReason: z.string().optional(),
  notes: z.string().optional(),
  shareIndex: z.number().int().nonnegative().optional(),
  staffId: z.string().min(1),
  createdAt: z.string(),
  items: z.array(paymentItemSchema).optional(),
  // Certified fiscal emission (Path B) — populated when the operator opted in
  // and the RT printer emitted the receipt via the Go agent.
  fiscalStatus: z.enum(["none", "pending", "emitted", "failed"]).optional(),
  fiscalProgressive: z.string().optional(),
  fiscalError: z.string().optional(),
});

// ─── Close Table ────────────────────────────────────────────────────────────

export const payTableResponseSchema = z.object({
  success: z.boolean(),
});

export const closeTableRequestSchema = z.object({
  method: paymentMethodSchema,
  paidAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  surchargeAmount: z.number().nonnegative().optional(),
  gatewayReference: z.string().min(3).max(120).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  notes: z.string().max(500).optional(),
  // Opt-in certified fiscal emission: when true (and a fiscal printer is
  // configured for the tenant), the API enqueues a fiscal job for the Go
  // agent. Default OFF — fiscal is never mandatory.
  fiscalEmit: z.boolean().optional(),
  // Per-transaction override for the cashier close receipt. When false the
  // receipt is NOT printed for this close (the global autoPrintOnClose setting
  // still applies when absent/true).
  printReceipt: z.boolean().optional(),
});

export const closeTableResponseSchema = z.object({
  success: z.boolean(),
  payment: paymentSchema,
});

// ─── Split Bill ─────────────────────────────────────────────────────────────

export const splitBillRequestSchema = z.object({
  people: z.number().int().min(2).max(20),
  persist: z.boolean().optional(),
  method: paymentMethodSchema.optional(),
  paidAmounts: z.array(z.number().nonnegative()).optional(),
  splitReference: z.string().min(3).max(120).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  discountAmount: z.number().nonnegative().optional(),
  surchargeAmount: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export const splitBillResponseSchema = z.object({
  tableId: z.string(),
  tableNumber: z.string(),
  total: z.number(),
  people: z.number().int(),
  shares: z.array(z.number()),
  persisted: z.boolean().optional(),
  payments: z.array(paymentSchema).optional(),
});

// ─── Pay Selected Items ─────────────────────────────────────────────────────

export const paySelectedItemsRequestSchema = z.object({
  items: z.array(z.object({
    orderItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).min(1),
  method: paymentMethodSchema,
  gatewayReference: z.string().min(3).max(120).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const paySelectedItemsResponseSchema = z.object({
  payment: paymentSchema,
  paidItems: z.array(z.object({
    orderItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })),
  allItemsPaid: z.boolean(),
});

// ─── Mark Share as Paid ─────────────────────────────────────────────────────

export const markShareAsPaidRequestSchema = z.object({
  method: paymentMethodSchema,
  gatewayReference: z.string().min(3).max(120).optional(),
});

export const markShareAsPaidResponseSchema = z.object({
  payment: paymentSchema,
  allSharesPaid: z.boolean(),
});

// ─── Transfer Table ─────────────────────────────────────────────────────────

export const transferTableRequestSchema = z.object({
  targetTableId: z.string().min(1),
});

export const transferTableResponseSchema = z.object({
  success: z.boolean(),
  sourceTableId: z.string(),
  targetTableId: z.string(),
  movedOrders: z.number().int(),
});

// ─── Merge Table (unificazione conto) ───────────────────────────────────────

export const mergeTableRequestSchema = z.object({
  targetTableId: z.string().min(1),
});

export const mergeTableResponseSchema = z.object({
  success: z.boolean(),
  sourceTableId: z.string(),
  targetTableId: z.string(),
  mergedOrders: z.number().int(),
  mergedPayments: z.number().int(),
});

// ─── Payment History / Refunds ──────────────────────────────────────────────

export const paymentFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  method: paymentMethodSchema.optional(),
  kind: paymentKindSchema.optional(),
  staffId: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const paymentsListResponseSchema = z.array(paymentSchema);

export const refundPaymentRequestSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().min(3).max(500),
  notes: z.string().max(500).optional(),
});

export const refundPaymentResponseSchema = z.object({
  success: z.boolean(),
  payment: paymentSchema,
  refundedAmount: z.number(),
  remainingAmount: z.number(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type PayTableResponse = z.infer<typeof payTableResponseSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentKind = z.infer<typeof paymentKindSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type CloseTableRequest = z.infer<typeof closeTableRequestSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type CloseTableResponse = z.infer<typeof closeTableResponseSchema>;
export type SplitBillRequest = z.infer<typeof splitBillRequestSchema>;
export type SplitBillResponse = z.infer<typeof splitBillResponseSchema>;
export type PaySelectedItemsRequest = z.infer<typeof paySelectedItemsRequestSchema>;
export type PaySelectedItemsResponse = z.infer<typeof paySelectedItemsResponseSchema>;
export type MarkShareAsPaidRequest = z.infer<typeof markShareAsPaidRequestSchema>;
export type MarkShareAsPaidResponse = z.infer<typeof markShareAsPaidResponseSchema>;
export type TransferTableRequest = z.infer<typeof transferTableRequestSchema>;
export type TransferTableResponse = z.infer<typeof transferTableResponseSchema>;
export type MergeTableRequest = z.infer<typeof mergeTableRequestSchema>;
export type MergeTableResponse = z.infer<typeof mergeTableResponseSchema>;
export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;
export type PaymentsListResponse = z.infer<typeof paymentsListResponseSchema>;
export type RefundPaymentRequest = z.infer<typeof refundPaymentRequestSchema>;
export type RefundPaymentResponse = z.infer<typeof refundPaymentResponseSchema>;
