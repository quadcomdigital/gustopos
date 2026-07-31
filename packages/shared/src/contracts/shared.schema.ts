import { z } from "zod";

// ─── Shared base enums (used by both contracts.ts and menu.schema.ts) ────────

export const printAreaSchema = z.enum(["kitchen", "bar", "cashier"]);

export const bomComponentTypeSchema = z.enum(["ingredient", "bom", "prep"]);

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type PrintArea = z.infer<typeof printAreaSchema>;
export type BomComponentType = z.infer<typeof bomComponentTypeSchema>;
