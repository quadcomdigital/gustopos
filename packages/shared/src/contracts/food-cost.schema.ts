import { z } from "zod";
import { ingredientCostImportSchema } from "../contracts/ingredient.schema";

// ─── Food Cost Matrix ─────────────────────────────────────────────────

export const foodCostMatrixRowSchema = z.object({
  menuItemId: z.string(),
  menuItemName: z.string(),
  ingredientId: z.string(),
  ingredientName: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
  ingredientCost: z.number().nonnegative().default(0),
  totalCost: z.number().nonnegative().default(0),
  menuItemPrice: z.number().nonnegative().default(0),
  margin: z.number().default(0),
  marginPercent: z.number().default(0),
  recommendedPrice: z.number().nonnegative().default(0),
  status: z.enum(['ok', 'needs_change']).default('ok'),
});

export const foodCostMatrixCellSchema = z.object({
  menuItemId: z.string(),
  ingredientId: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
});

export const foodCostMatrixUpdateSchema = z.object({
  menuItemId: z.string().min(1),
  ingredientId: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
});

export const foodCostMatrixImportRowSchema = z.object({
  ingredientName: z.string(),
  menuItemName: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
});

export const foodCostMatrixImportSchema = z.object({
  rows: z.array(foodCostMatrixImportRowSchema),
});

export const foodCostFullImportSchema = z.object({
  ingredientCosts: z.array(ingredientCostImportSchema).default([]),
  recipeRows: z.array(foodCostMatrixImportRowSchema).default([]),
});

export const foodCostAnalysisSchema = z.object({
  menuItemId: z.string(),
  menuItemName: z.string(),
  category: z.string(),
  totalCost: z.number().nonnegative(),
  currentPrice: z.number().nonnegative(),
  recommendedPrice: z.number().nonnegative(),
  margin: z.number(),
  marginPercent: z.number(),
  status: z.enum(['ok', 'needs_change']),
  ingredientCount: z.number().int().nonnegative(),
});

// ─── Types ─────────────────────────────────────────────────────────────

export type FoodCostMatrixRow = z.infer<typeof foodCostMatrixRowSchema>;
export type FoodCostMatrixCell = z.infer<typeof foodCostMatrixCellSchema>;
export type FoodCostMatrixUpdate = z.infer<typeof foodCostMatrixUpdateSchema>;
export type FoodCostMatrixImportRow = z.infer<typeof foodCostMatrixImportRowSchema>;
export type FoodCostMatrixImport = z.infer<typeof foodCostMatrixImportSchema>;
export type FoodCostFullImport = z.infer<typeof foodCostFullImportSchema>;
export type FoodCostAnalysis = z.infer<typeof foodCostAnalysisSchema>;
