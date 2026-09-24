import { z } from "zod";

// ─── Re-export shared base types ──────────────────────────────────────────
export * from "./contracts/shared.schema";

// ─── Re-export ingredient domain ──────────────────────────────────────────
import { ingredientSchema } from "./contracts/ingredient.schema";
export {
  ingredientSchema,
  ingredientCreateRequestSchema,
  ingredientUpdateRequestSchema,
  ingredientAdjustRequestSchema,
  stockMovementSchema,
  stockMovementsQuerySchema,
  reorderSuggestionSchema,
  ingredientCostImportSchema,
} from "./contracts/ingredient.schema";
export type {
  Ingredient,
  IngredientCreateRequest,
  IngredientUpdateRequest,
  IngredientAdjustRequest,
  StockMovement,
  StockMovementsQuery,
  IngredientCostImport,
} from "./contracts/ingredient.schema";

// ─── Re-export order domain ───────────────────────────────────────────────
import { orderSchema } from "./contracts/order.schema";
export * from "./contracts/order.schema";

// ─── Re-export auth domain ────────────────────────────────────────────────
import { staffSchema } from "./contracts/auth.schema";
export * from "./contracts/auth.schema";

// ─── Re-export tables domain ──────────────────────────────────────────────
import { tableSchema } from "./contracts/tables.schema";
export * from "./contracts/tables.schema";

// ─── Re-export reservations domain ────────────────────────────────────────
export * from "./contracts/reservations.schema";

// ─── Re-export delivery domain ────────────────────────────────────────────
export * from "./contracts/delivery.schema";

// ─── Re-export shifts domain ──────────────────────────────────────────────
export * from "./contracts/shifts.schema";

// ─── Re-export fiscal domain ──────────────────────────────────────────────
export * from "./contracts/fiscal.schema";

// ─── Re-export customers domain ───────────────────────────────────────────
export * from "./contracts/customers.schema";

// ─── Re-export suppliers domain ───────────────────────────────────────────
export * from "./contracts/suppliers.schema";

// ─── Re-export public domain ──────────────────────────────────────────────
export * from "./contracts/public.schema";

// ─── Re-export menu domain ────────────────────────────────────────────────
import { categorySchema, categoryModifierPoolSchema, menuItemSchema } from "./contracts/menu.schema";
export * from "./contracts/menu.schema";

// ─── Re-export payment domain ─────────────────────────────────────────────
export * from "./contracts/payment.schema";

// ─── Re-export BoM domain ─────────────────────────────────────────────────
import { bomItemSchema } from "./contracts/bom.schema";
export * from "./contracts/bom.schema";

// ─── Re-export print domain ───────────────────────────────────────────────
export * from "./contracts/print.schema";
export * from "./contracts/fiscal.schema";

// ─── Re-export diagnostics (client terminal reporting) ────────────────────
export * from "./contracts/diagnostics.schema";

// ─── Re-export misc domains ───────────────────────────────────────────────
export * from "./contracts/prep.schema";
export * from "./contracts/inventory-workflow.schema";
export * from "./contracts/coupon.schema";
export * from "./contracts/cart.schema";
export * from "./contracts/rounds.schema";
export * from "./contracts/production.schema";
export * from "./contracts/food-cost.schema";
export * from "./contracts/loyalty.schema";

// ─── AppData (ties all domains together) ─────────────────────────────────

export const appDataSchema = z.object({
  orders: z.array(orderSchema),
  inventory: z.array(ingredientSchema),
  bomItems: z.array(bomItemSchema),
  menu: z.array(menuItemSchema),
  staff: z.array(staffSchema),
  tables: z.array(tableSchema),
  categories: z.array(categorySchema).default([]),
  categoryModifierPools: z.array(categoryModifierPoolSchema).default([]),
});

export type AppData = z.infer<typeof appDataSchema>;
