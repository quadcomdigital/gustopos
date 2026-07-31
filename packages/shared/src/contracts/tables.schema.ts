import { z } from "zod";

// ─── Tables ─────────────────────────────────────────────────────────────────

export const tableStatusSchema = z.enum(["free", "occupied", "reserved"]);

export const tableSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: tableStatusSchema,
  currentOrderId: z.string().optional(),
});

export const tableCreateRequestSchema = z.object({
  number: z.string().min(1).max(20),
});

export const tableUpdateRequestSchema = z.object({
  number: z.string().min(1).max(20).optional(),
});

export const tableBulkCreateRequestSchema = z.object({
  count: z.number().int().min(1).max(100),
  prefix: z.string().max(10).optional(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type TableStatus = z.infer<typeof tableStatusSchema>;
export type Table = z.infer<typeof tableSchema>;
export type TableCreateRequest = z.infer<typeof tableCreateRequestSchema>;
export type TableUpdateRequest = z.infer<typeof tableUpdateRequestSchema>;
export type TableBulkCreateRequest = z.infer<typeof tableBulkCreateRequestSchema>;
