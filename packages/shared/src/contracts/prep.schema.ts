import { z } from "zod";
import { canonicalUnitSchema, prepSourceSchema, prepSourceTypeSchema } from "./inventory-workflow.schema";

// ─── Prep Items ────────────────────────────────────────────────────────

export const preparePrepItemResponseSchema = z.object({
  prepItemId: z.string(),
  name: z.string(),
  previousStock: z.number(),
  newStock: z.number(),
  ingredientsDeducted: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    unit: z.string(),
  })),
});

export const prepItemSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  sourceType: prepSourceTypeSchema,
  sourceId: z.string(),
  name: z.string(),
  inputQuantity: z.number(),
  inputUnit: canonicalUnitSchema,
  outputQuantity: z.number(),
  outputUnit: canonicalUnitSchema,
  stockQuantity: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const prepItemCreateRequestSchema = z.object({
  name: z.string().min(2),
  source: prepSourceSchema,
});

export const prepItemUpdateRequestSchema = z.object({
  name: z.string().optional(),
  inputQuantity: z.number().positive().optional(),
  inputUnit: canonicalUnitSchema.optional(),
  outputQuantity: z.number().positive().optional(),
  outputUnit: canonicalUnitSchema.optional(),
  isActive: z.boolean().optional(),
});

// ─── Unit Conversion ───────────────────────────────────────────────────

export const unitConversionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  inventoryId: z.string(),
  fromUnit: z.string(),
  toUnit: z.string(),
  factor: z.number(),
  createdAt: z.string(),
});

export const unitConversionCreateRequestSchema = z.object({
  fromUnit: z.string().min(1),
  toUnit: z.string().min(1),
  factor: z.number().positive(),
});

// ─── Types ─────────────────────────────────────────────────────────────

export type PreparePrepItemResponse = z.infer<typeof preparePrepItemResponseSchema>;
export type PrepItem = z.infer<typeof prepItemSchema>;
export type PrepItemCreateRequest = z.infer<typeof prepItemCreateRequestSchema>;
export type PrepItemUpdateRequest = z.infer<typeof prepItemUpdateRequestSchema>;
export type UnitConversion = z.infer<typeof unitConversionSchema>;
export type UnitConversionCreateRequest = z.infer<typeof unitConversionCreateRequestSchema>;
