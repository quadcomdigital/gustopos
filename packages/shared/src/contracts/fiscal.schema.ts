import { z } from "zod";

// ─── Fiscal Closure (Path A — internal bookkeeping) ───────────────────────

export const fiscalClosureSchema = z.object({
  id: z.string(),
  businessDate: z.string(),
  closedByStaffId: z.string(),
  totals: z.object({
    gross: z.number(),
    refunds: z.number(),
    net: z.number(),
    cash: z.number(),
    card: z.number(),
  }),
  closedAt: z.string(),
  notes: z.string().optional(),
});

export const fiscalCloseRequestSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

// ─── Fiscal Export (Path A — immutable CSV snapshots) ─────────────────────

export const fiscalExportStatusSchema = z.enum(["pending", "ready", "failed"]);
export const fiscalExportFormatSchema = z.enum(["csv"]);

export const fiscalExportSchema = z.object({
  id: z.string(),
  businessDate: z.string(),
  format: fiscalExportFormatSchema,
  status: fiscalExportStatusSchema,
  path: z.string(),
  generatedByStaffId: z.string(),
  generatedAt: z.string(),
  checksum: z.string().optional(),
  error: z.string().optional(),
});

export const fiscalExportCreateRequestSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: fiscalExportFormatSchema.default("csv"),
});

export const fiscalExportsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: fiscalExportStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ─── Certified Fiscal Printer / Registratore Telematico (Path B) ──────────
// Emission to a certified RT device reached through the Go agent on the
// cashier PC (generic protocollo RT over TCP). Distinct from Path A (internal
// closure + export) which is pure bookkeeping with no hardware.

export const fiscalPrinterModelSchema = z.enum(["generic-rt", "epson-tm-s1000", "custom-vkp80iii", "rch-custom"]);

export const fiscalPrinterConfigSchema = z.object({
  enabled: z.boolean().default(false),
  model: fiscalPrinterModelSchema.default("generic-rt"),
  // host può essere vuoto quando enabled=false (fiscale non configurata): il
  // default "" è legittimo, quindi niente min(1) qui — altrimenti il parse del
  // config assente fallisce e ogni heartbeat del print agent va in 500.
  host: z.string().max(253).default(""),
  port: z.number().int().min(1).max(65535).default(4001),
  // Commands differ per vendor; `generic-rt` uses the common @-command text
  // protocol. Per-model adapters can tune command strings later.
  protocol: z.literal("rt-text").default("rt-text"),
});

export const fiscalPrinterConfigResponseSchema = z.object({
  fiscalPrinter: fiscalPrinterConfigSchema,
});

export const fiscalPrinterConfigUpdateRequestSchema = z.object({
  fiscalPrinter: fiscalPrinterConfigSchema.partial(),
});

// ─── Fiscal Job (agent-claimed, like print jobs) ──────────────────────────

export const fiscalJobTypeSchema = z.enum(["receipt", "chiusura", "test"]);
export const fiscalJobStatusSchema = z.enum(["pending", "dispatched", "completed", "failed"]);

export const fiscalReceiptItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  price: z.number().nonnegative(),
});

export const fiscalReceiptPayloadSchema = z.object({
  paymentId: z.string(),
  items: z.array(fiscalReceiptItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  method: z.enum(["cash", "card", "mixed"]),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const fiscalJobSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  type: fiscalJobTypeSchema,
  status: fiscalJobStatusSchema,
  payload: z.string(), // JSON string (fiscalReceiptPayloadSchema for receipts)
  result: z.string().optional(), // JSON string: { progressive, emittedAt } on success
  error: z.string().optional(),
  bridgeId: z.string().nullable().optional(),
  claimedByInstanceId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dispatchedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

export const fiscalJobsQuerySchema = z.object({
  status: fiscalJobStatusSchema.optional(),
  type: fiscalJobTypeSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ─── Fiscal-bridge protocol (agent ↔ API, mirrors print-bridge) ───────────

export const fiscalBridgeClaimRequestSchema = z.object({
  bridgeId: z.string(),
  limit: z.number().int().positive().max(20).optional(),
});

export const fiscalBridgeClaimResponseSchema = z.object({
  jobs: z.array(fiscalJobSchema),
});

export const fiscalBridgeJobCompleteRequestSchema = z.object({
  bridgeId: z.string(),
  // Result JSON with the progressive read back from the RT device.
  progressive: z.string().min(1).max(64),
  emittedAt: z.string().datetime().optional(),
});

export const fiscalBridgeJobFailRequestSchema = z.object({
  bridgeId: z.string(),
  error: z.string().min(1).max(500),
});

export const fiscalChiusuraRequestSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type FiscalClosure = z.infer<typeof fiscalClosureSchema>;
export type FiscalCloseRequest = z.infer<typeof fiscalCloseRequestSchema>;
export type FiscalExportStatus = z.infer<typeof fiscalExportStatusSchema>;
export type FiscalExportFormat = z.infer<typeof fiscalExportFormatSchema>;
export type FiscalExport = z.infer<typeof fiscalExportSchema>;
export type FiscalExportCreateRequest = z.infer<typeof fiscalExportCreateRequestSchema>;
export type FiscalExportsQuery = z.infer<typeof fiscalExportsQuerySchema>;
export type FiscalPrinterModel = z.infer<typeof fiscalPrinterModelSchema>;
export type FiscalPrinterConfig = z.infer<typeof fiscalPrinterConfigSchema>;
export type FiscalPrinterConfigResponse = z.infer<typeof fiscalPrinterConfigResponseSchema>;
export type FiscalPrinterConfigUpdateRequest = z.infer<typeof fiscalPrinterConfigUpdateRequestSchema>;
export type FiscalJobType = z.infer<typeof fiscalJobTypeSchema>;
export type FiscalJobStatus = z.infer<typeof fiscalJobStatusSchema>;
export type FiscalReceiptItem = z.infer<typeof fiscalReceiptItemSchema>;
export type FiscalReceiptPayload = z.infer<typeof fiscalReceiptPayloadSchema>;
export type FiscalJob = z.infer<typeof fiscalJobSchema>;
export type FiscalJobsQuery = z.infer<typeof fiscalJobsQuerySchema>;
export type FiscalBridgeClaimRequest = z.infer<typeof fiscalBridgeClaimRequestSchema>;
export type FiscalBridgeClaimResponse = z.infer<typeof fiscalBridgeClaimResponseSchema>;
export type FiscalBridgeJobCompleteRequest = z.infer<typeof fiscalBridgeJobCompleteRequestSchema>;
export type FiscalBridgeJobFailRequest = z.infer<typeof fiscalBridgeJobFailRequestSchema>;
export type FiscalChiusuraRequest = z.infer<typeof fiscalChiusuraRequestSchema>;
