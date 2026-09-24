import { z } from "zod";
import { printAreaSchema, bomComponentTypeSchema } from "./shared.schema";

/** Canonical units accepted by recipe, production, and stock operations. */
export const canonicalUnitSchema = z.enum(["mg", "g", "kg", "ml", "L", "pz"]);
export type CanonicalUnit = z.infer<typeof canonicalUnitSchema>;

/** Explicit reference type: never infer behavior from names or matching formulas. */
export const recipeComponentTypeSchema = bomComponentTypeSchema;
export type RecipeComponentType = z.infer<typeof recipeComponentTypeSchema>;

export const prepSourceTypeSchema = z.enum(["ingredient", "bom"]);
export type PrepSourceType = z.infer<typeof prepSourceTypeSchema>;

/** Input/output ratio for a prep materialized from raw stock or a BoM. */
export const prepSourceSchema = z.object({
  sourceType: prepSourceTypeSchema,
  sourceId: z.string().min(1),
  inputQuantity: z.number().positive(),
  inputUnit: canonicalUnitSchema,
  outputQuantity: z.number().positive(),
  outputUnit: canonicalUnitSchema,
});
export type PrepSource = z.infer<typeof prepSourceSchema>;

/** Canonical component edge used by menus and recursive BoMs. */
/** Existing request boundary; Phase 4 will replace it with canonicalMenuComponentSchema. */
export const menuComponentSchema = z.object({
  componentType: recipeComponentTypeSchema,
  componentId: z.string().min(1),
  quantity: z.number().positive(),
});
export type MenuComponent = z.infer<typeof menuComponentSchema>;

/** Target-aware canonical edge used by the hard-cut API after normalization. */
export const canonicalMenuComponentSchema = menuComponentSchema.extend({
  unit: canonicalUnitSchema,
});
export type CanonicalMenuComponent = z.infer<typeof canonicalMenuComponentSchema>;

// ─── Modifier group input (canonical) ───────────────────────────────────────
// Living here (not in menu.schema.ts) because menu.schema.ts already imports
// from this module; placing them here avoids a circular dependency.

export const modifierOptionOverrideInputSchema = z.object({
  ingredientId: z.string().min(1),
  action: z.enum(["add", "remove", "replace"]),
});
export type ModifierOptionOverrideInput = z.infer<typeof modifierOptionOverrideInputSchema>;

export const modifierOptionInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  inventoryItemId: z.string().optional(),
  referenceId: z.string().nullable().optional(),
  componentType: z.enum(["ingredient", "prep", "bom"]).default("ingredient"),
  componentId: z.string().optional(),
  quantity: z.number().positive().default(1),
  unit: canonicalUnitSchema.default("pz"),
  priceDelta: z.number().default(0),
  // Multiplicative pricing on the ITEM base price (see category pool options).
  priceMultiplier: z.number().positive().nullable().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  ingredientOverrides: z.array(modifierOptionOverrideInputSchema).default([]),
});
export type ModifierOptionInput = z.infer<typeof modifierOptionInputSchema>;

export const modifierGroupInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  required: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  multiSelectPriceMode: z.enum(["max", "sum", "none"]).default("max"),
  sortOrder: z.number().int().default(0),
  options: z.array(modifierOptionInputSchema).default([]),
});
export type ModifierGroupInput = z.infer<typeof modifierGroupInputSchema>;

export const inlineIngredientSchema = z.object({
  clientKey: z.string().min(1),
  name: z.string().min(2),
  unit: canonicalUnitSchema,
  unitCost: z.number().nonnegative().default(0),
});
export type InlineIngredient = z.infer<typeof inlineIngredientSchema>;

/**
 * Inline prep draft. The source must be explicit; a raw ingredient or an
 * existing BoM can be selected, but an inline BoM header is never created here.
 */
/** Existing request shape retained only until the menu transaction is rewritten. */
export const inlinePrepSchema = z.object({
  clientKey: z.string().min(1),
  name: z.string().min(2),
  unit: canonicalUnitSchema,
  components: z.array(z.object({
    ingredientId: z.string().min(1),
    quantity: z.number().positive(),
  })).min(1),
});
export type InlinePrep = z.infer<typeof inlinePrepSchema>;

/** New canonical inline prep draft: explicit raw/BOM source and ratio. */
export const canonicalInlinePrepSchema = z.object({
  clientKey: z.string().min(1),
  name: z.string().min(2),
  source: prepSourceSchema,
});
export type CanonicalInlinePrep = z.infer<typeof canonicalInlinePrepSchema>;

/** Atomic menu-first product creation payload. */
export const createMenuProductRequestSchema = z.object({
  name: z.string().min(2),
  price: z.number().nonnegative(),
  category: z.string().min(2),
  categoryId: z.string().min(1).optional(),
  stationId: z.string().min(1).optional(),
  referenceId: z.string().min(1).optional(),
  printAreas: z.array(printAreaSchema).default(["kitchen"]),
  components: z.array(menuComponentSchema).default([]),
  inlineIngredients: z.array(inlineIngredientSchema).default([]),
  inlinePreps: z.array(inlinePrepSchema).default([]),
});
export type CreateMenuProductRequest = z.infer<typeof createMenuProductRequestSchema>;

/**
 * Hard-cut menu product contract. This is intentionally separate from the
 * current endpoint contract until the schema/repository migration is complete.
 */
export const canonicalCreateMenuProductRequestSchema = z.object({
  name: z.string().min(2),
  price: z.number().nonnegative(),
  category: z.string().min(2),
  categoryId: z.string().min(1).optional(),
  stationId: z.string().min(1).optional(),
  referenceId: z.string().min(1).optional(),
  printAreas: z.array(printAreaSchema).default(["kitchen"]),
  components: z.array(canonicalMenuComponentSchema).default([]),
  inlineIngredients: z.array(inlineIngredientSchema).default([]),
  inlinePreps: z.array(canonicalInlinePrepSchema).default([]),
  modifierGroups: z.array(modifierGroupInputSchema).default([]),
});
export type CanonicalCreateMenuProductRequest = z.infer<typeof canonicalCreateMenuProductRequestSchema>;

export const menuComponentResponseSchema = canonicalMenuComponentSchema.extend({
  name: z.string(),
});

export const menuProductResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  category: z.string(),
  categoryId: z.string().optional(),
  stationId: z.string().nullable().optional(),
  referenceId: z.string().nullable().optional(),
  printAreas: z.array(printAreaSchema),
  isActive: z.boolean(),
  components: z.array(menuComponentResponseSchema),
});
export type MenuProductResponse = z.infer<typeof menuProductResponseSchema>;

export const prepItemResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: prepSourceSchema,
  outputUnit: canonicalUnitSchema,
  stockQuantity: z.number().nonnegative(),
  isActive: z.boolean(),
});
export type PrepItemResponse = z.infer<typeof prepItemResponseSchema>;

export const orderStockImpactSchema = z.object({
  orderId: z.string(),
  orderItemId: z.number().int().positive(),
  componentType: z.enum(["ingredient", "prep"]),
  componentId: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
});
export type OrderStockImpact = z.infer<typeof orderStockImpactSchema>;

export const modifierDeltaActionSchema = z.enum(["add", "remove"]);
export type ModifierDeltaAction = z.infer<typeof modifierDeltaActionSchema>;

export const modifierDeltaSchema = z.object({
  componentType: recipeComponentTypeSchema,
  componentId: z.string().min(1),
  action: modifierDeltaActionSchema,
  quantity: z.number().positive(),
  unit: canonicalUnitSchema,
});
export type ModifierDelta = z.infer<typeof modifierDeltaSchema>;

export const stockMovementTypeSchema = z.enum([
  "opening_balance",
  "order_deduction",
  "order_reversal",
  "manual_adjustment",
  "purchase_receipt",
  "prep_production",
  "prep_consumption",
  "prep_restoration",
]);
export type InventoryStockMovementType = z.infer<typeof stockMovementTypeSchema>;

export const openingBalanceSchema = z.object({
  componentType: z.enum(["ingredient", "prep"]),
  componentId: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: canonicalUnitSchema,
  note: z.string().max(500).optional(),
});
export type OpeningBalance = z.infer<typeof openingBalanceSchema>;

export const autoProductionAuthorizationSchema = z.object({
  operatorId: z.string().min(1),
  confirmed: z.literal(true),
});
export type AutoProductionAuthorization = z.infer<typeof autoProductionAuthorizationSchema>;

export const autoProductionRequestSchema = z.object({
  prepId: z.string().min(1),
  quantity: z.number().positive(),
  authorization: autoProductionAuthorizationSchema,
});
export type AutoProductionRequest = z.infer<typeof autoProductionRequestSchema>;
