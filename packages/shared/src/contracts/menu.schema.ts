import { z } from "zod";
import { printAreaSchema, bomComponentTypeSchema } from "../contracts/shared.schema";
import { canonicalMenuComponentSchema } from "../contracts/inventory-workflow.schema";

// ─── Category ───────────────────────────────────────────────────────────────

export const categoryScopeSchema = z.enum(["ingredient", "bom", "menu"]);

export const categorySchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  scope: categoryScopeSchema,
  isActive: z.boolean(),
  printAreas: z.array(printAreaSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const categoriesListResponseSchema = z.array(categorySchema);

export const categoryCreateRequestSchema = z.object({
  name: z.string().min(2),
  scope: categoryScopeSchema,
  printAreas: z.array(printAreaSchema).default(["kitchen"]),
});

export const categoryUpdateRequestSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  printAreas: z.array(printAreaSchema).optional(),
});

// ─── Category Modifier Pools ────────────────────────────────────────────────

export const categoryModifierPoolOptionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  inventoryItemId: z.string().optional(),
  priceDelta: z.number().default(0),
  sortOrder: z.number().int().default(0),
});

export const categoryModifierPoolSchema = z.object({
  id: z.string(),
  categoryId: z.string().optional(),
  categoryIds: z.array(z.string()).default([]),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  options: z.array(categoryModifierPoolOptionSchema).default([]),
});

export const categoryModifierPoolCreateRequestSchema = z.object({
  categoryIds: z.array(z.string().min(1)).min(1),
  name: z.string().min(1),
  options: z.array(categoryModifierPoolOptionSchema.omit({ id: true })).default([]),
});

export const categoryModifierPoolUpdateRequestSchema = z.object({
  name: z.string().min(1).optional(),
  categoryIds: z.array(z.string().min(1)).min(1).optional(),
  options: z.array(categoryModifierPoolOptionSchema.omit({ id: true })).optional(),
});

// ─── Modifier Options ───────────────────────────────────────────────────────

export const modifierOptionOverrideSchema = z.object({
  ingredientId: z.string().min(1),
  action: z.enum(["add", "remove", "replace"]),
});

export const modifierOptionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  inventoryItemId: z.string().optional(),
  priceDelta: z.number().default(0),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  ingredientOverrides: z.array(modifierOptionOverrideSchema).default([]),
});

export const modifierOptionOverrideInputSchema = z.object({
  ingredientId: z.string().min(1),
  action: z.enum(["add", "remove", "replace"]),
});

export const modifierOptionInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  inventoryItemId: z.string().optional(),
  priceDelta: z.number().default(0),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  ingredientOverrides: z.array(modifierOptionOverrideInputSchema).default([]),
});

// ─── Modifier Groups ────────────────────────────────────────────────────────

export const modifierGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  required: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  sortOrder: z.number().int().default(0),
  options: z.array(modifierOptionSchema).default([]),
});

export const modifierGroupInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  required: z.boolean().default(false),
  minSelections: z.number().int().min(0).default(0),
  maxSelections: z.number().int().min(1).default(1),
  sortOrder: z.number().int().default(0),
  options: z.array(modifierOptionInputSchema).default([]),
});

// ─── Menu Recipe Component ──────────────────────────────────────────────────

export const menuRecipeComponentSchema = z.object({
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
  componentName: z.string().min(1).optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

// ─── Menu Item Modifier ─────────────────────────────────────────────────────

export const menuItemModifierSchema = z.object({
  id: z.string(),
  inventoryItemId: z.string(),
  name: z.string().optional(),
  priceDelta: z.number().default(0),
  effectivePrice: z.number().optional(),
});

// ─── Menu Item ──────────────────────────────────────────────────────────────

export const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  category: z.string(),
  categoryId: z.string().optional(),
  printAreas: z.array(printAreaSchema),
  ingredients: z.array(z.string()),
  recipe: z.array(menuRecipeComponentSchema).default([]),
  modifiers: z.array(menuItemModifierSchema).default([]),
  modifierGroups: z.array(modifierGroupSchema).default([]),
});

export const menuItemAdminSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  category: z.string(),
  categoryId: z.string().optional(),
  printAreas: z.array(printAreaSchema),
  isActive: z.boolean(),
  recipe: z.array(menuRecipeComponentSchema),
  modifiers: z.array(menuItemModifierSchema).default([]),
  modifierGroups: z.array(modifierGroupSchema).default([]),
});

export const menuItemAdminListResponseSchema = z.array(menuItemAdminSchema);

export const menuItemCreateRequestSchema = z.object({
  name: z.string().min(2),
  price: z.number().nonnegative(),
  category: z.string().min(2),
  categoryId: z.string().optional(),
  printAreas: z.array(printAreaSchema).default(["kitchen"]),
  recipe: z.array(menuRecipeComponentSchema).default([]),
  modifiers: z.array(menuItemModifierSchema.omit({ id: true, name: true, effectivePrice: true })).default([]),
  modifierGroups: z.array(modifierGroupInputSchema).default([]),
});

export const menuItemUpdateRequestSchema = z.object({
  name: z.string().min(2).optional(),
  price: z.number().positive().optional(),
  category: z.string().min(2).optional(),
  categoryId: z.string().optional(),
  printAreas: z.array(printAreaSchema).optional(),
  components: z.array(canonicalMenuComponentSchema).optional(),
  modifierGroups: z.array(modifierGroupInputSchema).optional(),
});

// ─── Menu Item Recipe Components (add/remove) ───────────────────────────────

export const menuItemAddRecipeComponentRequestSchema = z.object({
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

export const menuItemRemoveRecipeComponentRequestSchema = z.object({
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type CategoryScope = z.infer<typeof categoryScopeSchema>;
export type Category = z.infer<typeof categorySchema>;
export type CategoriesListResponse = z.infer<typeof categoriesListResponseSchema>;
export type CategoryCreateRequest = z.infer<typeof categoryCreateRequestSchema>;
export type CategoryUpdateRequest = z.infer<typeof categoryUpdateRequestSchema>;
export type CategoryModifierPool = z.infer<typeof categoryModifierPoolSchema>;
export type CategoryModifierPoolOption = z.infer<typeof categoryModifierPoolOptionSchema>;
export type CategoryModifierPoolCreateRequest = z.infer<typeof categoryModifierPoolCreateRequestSchema>;
export type CategoryModifierPoolUpdateRequest = z.infer<typeof categoryModifierPoolUpdateRequestSchema>;

export type ModifierOptionOverride = z.infer<typeof modifierOptionOverrideSchema>;
export type ModifierOption = z.infer<typeof modifierOptionSchema>;
export type ModifierOptionInput = z.infer<typeof modifierOptionInputSchema>;
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;
export type ModifierGroupInput = z.infer<typeof modifierGroupInputSchema>;

export type MenuRecipeComponent = z.infer<typeof menuRecipeComponentSchema>;
export type MenuItemModifier = z.infer<typeof menuItemModifierSchema>;
export type MenuItem = z.infer<typeof menuItemSchema>;
export type MenuItemAdmin = z.infer<typeof menuItemAdminSchema>;
export type MenuItemAdminListResponse = z.infer<typeof menuItemAdminListResponseSchema>;
export type MenuItemCreateRequest = z.infer<typeof menuItemCreateRequestSchema>;
export type MenuItemUpdateRequest = z.infer<typeof menuItemUpdateRequestSchema>;
export type MenuItemAddRecipeComponentRequest = z.infer<typeof menuItemAddRecipeComponentRequestSchema>;
export type MenuItemRemoveRecipeComponentRequest = z.infer<typeof menuItemRemoveRecipeComponentRequestSchema>;
