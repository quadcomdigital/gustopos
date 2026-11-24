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

/**
 * Chiusura di un conto già interamente incassato a voci (pay-items): non c'è
 * nulla da incassare, ma il tavolo è ancora occupato. Nessun nuovo pagamento,
 * nessuno scontrino: solo gli ordini aperti passano a `paid` e il tavolo torna
 * libero. Rifiutata se resta un residuo da incassare.
 */
export const settleTableResponseSchema = z.object({
  success: z.boolean(),
  tableId: z.string(),
  tableNumber: z.string(),
  closedOrders: z.number().int().nonnegative(),
  totalAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
});

// ─── Split Bill ─────────────────────────────────────────────────────────────

export const splitBillRequestSchema = z.object({
  people: z.number().int().min(2).max(20),
  persist: z.boolean().optional(),
  method: paymentMethodSchema.optional(),
  paidAmounts: z.array(z.number().nonnegative()).optional(),
  // Quote editabili già alla creazione: importo netto di ogni persona. Quando
  // presente la somma deve coincidere con il totale del conto a meno di tolleranza.
  shareAmounts: z.array(z.number().nonnegative()).optional(),
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
  // Importo effettivamente consegnato/accettato: per i contanti serve a calcolare
  // il resto. Se assente vale l'importo della selezione.
  paidAmount: z.number().nonnegative().optional(),
  gatewayReference: z.string().min(3).max(120).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  notes: z.string().max(500).optional(),
  // Scontrino di cassa per questa selezione + fiscale opzionale solo quando la
  // selezione completa il conto (stesse semantiche della chiusura conto).
  fiscalEmit: z.boolean().optional(),
  printReceipt: z.boolean().optional(),
});

export const paySelectedItemsResponseSchema = z.object({
  payment: paymentSchema,
  paidItems: z.array(z.object({
    orderItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })),
  allItemsPaid: z.boolean(),
  // Residuo dopo questa selezione, per aggiornare subito il carrello/checkout.
  totalAmount: z.number().nonnegative().optional(),
  paidAmountTotal: z.number().nonnegative().optional(),
  remainingAmount: z.number().nonnegative().optional(),
});

// ─── Mark Share as Paid ─────────────────────────────────────────────────────

export const markShareAsPaidRequestSchema = z.object({
  method: paymentMethodSchema,
  // Importo contanti consegnato per questa quota: il resto è la differenza con
  // la quota. Se assente vale l'importo della quota.
  paidAmount: z.number().nonnegative().optional(),
  gatewayReference: z.string().min(3).max(120).optional(),
  // Scontrino di cassa + fiscale: emessi solo sull'ultima quota pagata, con
  // importi e righe del conto completo.
  fiscalEmit: z.boolean().optional(),
  printReceipt: z.boolean().optional(),
});

export const markShareAsPaidResponseSchema = z.object({
  payment: paymentSchema,
  allSharesPaid: z.boolean(),
  remainingAmount: z.number().nonnegative().optional(),
});

// ─── Update Split Shares ────────────────────────────────────────────────────

// Quote editabili: nuovi importi netti delle quote pendenti. La somma deve
// coincidere con il totale della divisione (a meno di tolleranza). Solo quote
// non ancora incassate sono modificabili.
export const updateSplitSharesRequestSchema = z.object({
  amounts: z.array(z.number().nonnegative()).min(2).max(20),
});

export const updateSplitSharesResponseSchema = z.object({
  tableId: z.string(),
  tableNumber: z.string(),
  total: z.number(),
  shares: z.array(z.number()),
  payments: z.array(paymentSchema),
});

// ─── Cancel Split ───────────────────────────────────────────────────────────

// Discards a split that has not collected any money yet (pending shares only).
export const cancelSplitBillResponseSchema = z.object({
  cancelled: z.number().int().nonnegative(),
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
export type SettleTableResponse = z.infer<typeof settleTableResponseSchema>;
export type SplitBillRequest = z.infer<typeof splitBillRequestSchema>;
export type SplitBillResponse = z.infer<typeof splitBillResponseSchema>;
export type PaySelectedItemsRequest = z.infer<typeof paySelectedItemsRequestSchema>;
export type PaySelectedItemsResponse = z.infer<typeof paySelectedItemsResponseSchema>;
export type MarkShareAsPaidRequest = z.infer<typeof markShareAsPaidRequestSchema>;
export type MarkShareAsPaidResponse = z.infer<typeof markShareAsPaidResponseSchema>;
export type UpdateSplitSharesRequest = z.infer<typeof updateSplitSharesRequestSchema>;
export type UpdateSplitSharesResponse = z.infer<typeof updateSplitSharesResponseSchema>;
export type CancelSplitBillResponse = z.infer<typeof cancelSplitBillResponseSchema>;
export type TransferTableRequest = z.infer<typeof transferTableRequestSchema>;
export type TransferTableResponse = z.infer<typeof transferTableResponseSchema>;
export type MergeTableRequest = z.infer<typeof mergeTableRequestSchema>;
export type MergeTableResponse = z.infer<typeof mergeTableResponseSchema>;
export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;
export type PaymentsListResponse = z.infer<typeof paymentsListResponseSchema>;
export type RefundPaymentRequest = z.infer<typeof refundPaymentRequestSchema>;
export type RefundPaymentResponse = z.infer<typeof refundPaymentResponseSchema>;
