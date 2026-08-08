import { z } from "zod";

// ─── Cart Item (POS client-side) ───────────────────────────────────────

export const cartItemSchema = z.object({
  cartItemId: z.string(),
  menuItemId: z.string(),
  name: z.string(),
  basePrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  round: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().default(''),
  ingredientOverrides: z.array(z.object({
    ingredientId: z.string(),
    action: z.enum(['add', 'remove']),
  })).default([]),
  selectedModifiers: z.array(z.object({
    groupId: z.string(),
    optionId: z.string(),
  })).default([]),
  modifierPriceDelta: z.number().default(0),
});

export type CartItem = z.infer<typeof cartItemSchema>;
