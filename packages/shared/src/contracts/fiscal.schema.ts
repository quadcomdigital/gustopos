import { z } from "zod";

// ─── Fiscal Closure ─────────────────────────────────────────────────────────

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

// ─── Fiscal Export ──────────────────────────────────────────────────────────

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

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type FiscalClosure = z.infer<typeof fiscalClosureSchema>;
export type FiscalCloseRequest = z.infer<typeof fiscalCloseRequestSchema>;
export type FiscalExportStatus = z.infer<typeof fiscalExportStatusSchema>;
export type FiscalExportFormat = z.infer<typeof fiscalExportFormatSchema>;
export type FiscalExport = z.infer<typeof fiscalExportSchema>;
export type FiscalExportCreateRequest = z.infer<typeof fiscalExportCreateRequestSchema>;
export type FiscalExportsQuery = z.infer<typeof fiscalExportsQuerySchema>;
