import { z } from "zod";

// ─── Loyalty Balance ────────────────────────────────────────────────────

export const loyaltyBalanceSchema = z.object({
  customerId: z.string(),
  points: z.number().int().nonnegative(),
  totalEarned: z.number().int().nonnegative(),
  totalRedeemed: z.number().int().nonnegative(),
});

// ─── Loyalty Transactions ───────────────────────────────────────────────

export const loyaltyTransactionSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  type: z.enum(['earn', 'redeem', 'adjust']),
  points: z.number().int(),
  orderId: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
});

export const loyaltyTransactionsListSchema = z.array(loyaltyTransactionSchema);

// ─── Loyalty Requests ───────────────────────────────────────────────────

export const loyaltyRedeemRequestSchema = z.object({
  customerId: z.string().min(1),
  points: z.number().int().positive(),
  orderId: z.string().optional(),
});

export const loyaltyEarnRequestSchema = z.object({
  customerId: z.string().min(1),
  points: z.number().int().positive(),
  orderId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

// ─── Loyalty Config ─────────────────────────────────────────────────────

export const loyaltyConfigSchema = z.object({
  earnRate: z.number().positive(),
  redeemRate: z.number().positive(),
  minRedeemPoints: z.number().int().nonnegative(),
});

// ─── Types ──────────────────────────────────────────────────────────────

export type LoyaltyBalance = z.infer<typeof loyaltyBalanceSchema>;
export type LoyaltyTransaction = z.infer<typeof loyaltyTransactionSchema>;
export type LoyaltyTransactionsList = z.infer<typeof loyaltyTransactionsListSchema>;
export type LoyaltyRedeemRequest = z.infer<typeof loyaltyRedeemRequestSchema>;
export type LoyaltyEarnRequest = z.infer<typeof loyaltyEarnRequestSchema>;
export type LoyaltyConfig = z.infer<typeof loyaltyConfigSchema>;
