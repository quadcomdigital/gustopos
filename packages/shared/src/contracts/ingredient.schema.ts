import { z } from "zod";

// ─── Ingredient ──────────────────────────────────────────────────────────────

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable().optional(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
  minThreshold: z.number().nonnegative(),
  categoryId: z.string().optional(),
  unitCost: z.number().nonnegative().default(0),
  salePrice: z.number().nonnegative().nullable().default(null),
  isActive: z.boolean().default(true),
  supplierName: z.string().nullable().optional(),
  brandName: z.string().nullable().optional(),
  isContainer: z.number().default(0),
});

export const ingredientCreateRequestSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(1).optional(),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
  minThreshold: z.number().nonnegative(),
  categoryId: z.string().optional(),
  unitCost: z.number().nonnegative().default(0),
  salePrice: z.number().nonnegative().nullable().optional(),
  isContainer: z.number().optional().default(0),
});

export const ingredientUpdateRequestSchema = z.object({
  name: z.string().min(2).optional(),
  sku: z.string().min(1).nullable().optional(),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  minThreshold: z.number().nonnegative().optional(),
  categoryId: z.string().optional(),
  unitCost: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  isContainer: z.number().optional(),
});

export const ingredientAdjustRequestSchema = z.object({
  quantity: z.number(),
  notes: z.string().optional(),
});

// ─── Stock Movements ────────────────────────────────────────────────────────

export const stockMovementTypeSchema = z.enum([
  "order_deduction",
  "order_reversal",
  "manual_adjustment",
  "purchase_receipt",
  "prep_consumption",
]);

export const stockMovementSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  ingredientId: z.string().optional(),
  prepItemId: z.string().optional(),
  orderId: z.string().nullable().optional(),
  movementType: stockMovementTypeSchema,
  quantity: z.number(),
  previousQuantity: z.number(),
  newQuantity: z.number(),
  notes: z.string().nullable().optional(),
  staffId: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const stockMovementsQuerySchema = z.object({
  ingredientId: z.string().optional(),
  orderId: z.string().optional(),
  movementType: stockMovementTypeSchema.optional(),
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
});

// ─── Reorder ────────────────────────────────────────────────────────────────

export const reorderSuggestionSchema = z.object({
  ingredientId: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  currentQty: z.number(),
  minThreshold: z.number(),
  unit: z.string(),
  deficit: z.number(),
  preferredSupplierName: z.string().optional(),
  lastUnitCost: z.number().optional(),
});

// ─── Food Cost Import ───────────────────────────────────────────────────────

export const ingredientCostImportSchema = z.object({
  name: z.string(),
  costPerKg: z.number().nonnegative().default(0),
  costPerPiece: z.number().nonnegative().default(0),
  gramsPerPortion: z.number().nonnegative().default(0),
  piecesPerPortion: z.number().nonnegative().default(0),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type Ingredient = z.infer<typeof ingredientSchema>;
export type IngredientCreateRequest = z.infer<typeof ingredientCreateRequestSchema>;
export type IngredientUpdateRequest = z.infer<typeof ingredientUpdateRequestSchema>;
export type IngredientAdjustRequest = z.infer<typeof ingredientAdjustRequestSchema>;
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type StockMovement = z.infer<typeof stockMovementSchema>;
export type StockMovementsQuery = z.infer<typeof stockMovementsQuerySchema>;
export type IngredientCostImport = z.infer<typeof ingredientCostImportSchema>;
