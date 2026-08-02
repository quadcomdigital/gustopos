import { z } from "zod";

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
  // Exactly one of ingredientId / bomId is set: ingredientId for the classic
  // single-ingredient variant, bomId for a variant whose recipe is a BoM.
  ingredientId: z.string().nullable(),
  bomId: z.string().nullable(),
  name: z.string(),
  quantityPerUnit: z.number(),
  unit: z.string(),
  stockQuantity: z.number(),
  createdAt: z.string(),
});

export const prepItemUpdateRequestSchema = z.object({
  name: z.string().optional(),
  quantityPerUnit: z.number().positive().optional(),
  unit: z.string().optional(),
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
export type PrepItemUpdateRequest = z.infer<typeof prepItemUpdateRequestSchema>;
export type UnitConversion = z.infer<typeof unitConversionSchema>;
export type UnitConversionCreateRequest = z.infer<typeof unitConversionCreateRequestSchema>;
