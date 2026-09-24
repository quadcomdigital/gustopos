import { z } from "zod";

// ─── Tables ─────────────────────────────────────────────────────────────────

// "suspended" is a virtual signal state: the conto (pre-bill) has been handed
// to the table and is awaiting payment. It behaves like an occupied table for
// payments/merge but is highlighted differently in the map.
export const tableStatusSchema = z.enum(["free", "occupied", "reserved", "suspended"]);

export const tableSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: tableStatusSchema,
  currentOrderId: z.string().optional(),
  // Physical zone/area label ("GAZEBO", "SALA OROLOGIO", ...). Optional:
  // tenants without zones simply omit it and the map shows no zone filter.
  zone: z.string().optional(),
  isVirtual: z.boolean().optional(),
});

export const tableCreateRequestSchema = z.object({
  number: z.string().min(1).max(20),
  zone: z.string().min(1).max(30).optional(),
});

export const tableUpdateRequestSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  // Empty string clears the zone (explicit null is not part of PATCH payloads).
  zone: z.string().max(30).optional(),
});

// ─── Suspend (pre-bill) ──────────────────────────────────────────────────────

export const suspendTableRequestSchema = z.object({
  // Print the pre-bill on the cashier printer. The operator opts out when the
  // table just needs the visual "awaiting payment" signal.
  printPreBill: z.boolean().optional(),
});

export const suspendTableResponseSchema = z.object({
  success: z.boolean(),
  tableId: z.string(),
  status: tableStatusSchema,
  printed: z.boolean(),
});

export const tableBulkCreateRequestSchema = z.object({
  count: z.number().int().min(1).max(100),
  prefix: z.string().max(10).optional(),
  // Zone applied to every table created in this batch.
  zone: z.string().min(1).max(30).optional(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type TableStatus = z.infer<typeof tableStatusSchema>;
export type Table = z.infer<typeof tableSchema>;
export type TableCreateRequest = z.infer<typeof tableCreateRequestSchema>;
export type TableUpdateRequest = z.infer<typeof tableUpdateRequestSchema>;
export type TableBulkCreateRequest = z.infer<typeof tableBulkCreateRequestSchema>;
export type SuspendTableRequest = z.infer<typeof suspendTableRequestSchema>;
export type SuspendTableResponse = z.infer<typeof suspendTableResponseSchema>;
