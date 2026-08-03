import { z } from "zod";

/** Canonical units accepted by recipe and stock operations. */
export const canonicalUnitSchema = z.enum(["mg", "g", "kg", "ml", "L", "pz"]);
export type CanonicalUnit = z.infer<typeof canonicalUnitSchema>;

export const recipeComponentTypeSchema = z.enum(["ingredient", "prep"]);
export type RecipeComponentType = z.infer<typeof recipeComponentTypeSchema>;

export const prepComponentSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
});
export type PrepComponent = z.infer<typeof prepComponentSchema>;

export const menuComponentSchema = z.object({
  componentType: recipeComponentTypeSchema,
  componentId: z.string().min(1),
  quantity: z.number().positive(),
});
export type MenuComponent = z.infer<typeof menuComponentSchema>;

export const inlineIngredientSchema = z.object({
  clientKey: z.string().min(1),
  name: z.string().min(2),
  unit: canonicalUnitSchema,
  unitCost: z.number().nonnegative().default(0),
});
export type InlineIngredient = z.infer<typeof inlineIngredientSchema>;

export const inlinePrepSchema = z.object({
  clientKey: z.string().min(1),
  name: z.string().min(2),
  unit: canonicalUnitSchema,
  components: z.array(prepComponentSchema).min(1),
});
export type InlinePrep = z.infer<typeof inlinePrepSchema>;

/** Atomic menu-first product creation payload. */
export const createMenuProductRequestSchema = z.object({
  name: z.string().min(2),
  price: z.number().nonnegative(),
  category: z.string().min(2),
  categoryId: z.string().min(1).optional(),
  printAreas: z.array(z.enum(["kitchen", "bar", "cashier"])).default(["kitchen"]),
  components: z.array(menuComponentSchema).default([]),
  inlineIngredients: z.array(inlineIngredientSchema).default([]),
  inlinePreps: z.array(inlinePrepSchema).default([]),
});
export type CreateMenuProductRequest = z.infer<typeof createMenuProductRequestSchema>;

export const menuComponentResponseSchema = menuComponentSchema.extend({
  name: z.string(),
  unit: canonicalUnitSchema,
});

export const menuProductResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  category: z.string(),
  categoryId: z.string().optional(),
  printAreas: z.array(z.enum(["kitchen", "bar", "cashier"])),
  isActive: z.boolean(),
  components: z.array(menuComponentResponseSchema),
});
export type MenuProductResponse = z.infer<typeof menuProductResponseSchema>;

export const prepItemComponentResponseSchema = prepComponentSchema.extend({
  name: z.string(),
  unit: canonicalUnitSchema,
});

export const prepItemResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: canonicalUnitSchema,
  stockQuantity: z.number().nonnegative(),
  components: z.array(prepItemComponentResponseSchema),
  isActive: z.boolean(),
});
export type PrepItemResponse = z.infer<typeof prepItemResponseSchema>;

export const orderStockImpactSchema = z.object({
  orderId: z.string(),
  orderItemId: z.number().int().positive(),
  componentType: recipeComponentTypeSchema,
  componentId: z.string(),
  quantity: z.number().positive(),
  unit: canonicalUnitSchema,
});
export type OrderStockImpact = z.infer<typeof orderStockImpactSchema>;
