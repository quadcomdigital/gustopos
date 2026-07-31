import { z } from "zod";

// ─── Coupon Engine ─────────────────────────────────────────────────────

export const couponSchema = z.object({
  id: z.string(),
  code: z.string().min(3).max(30),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  minOrderAmount: z.number().nonnegative().default(0),
  maxUses: z.number().int().positive().optional(),
  usedCount: z.number().int().nonnegative(),
  expiresAt: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const couponCreateRequestSchema = z.object({
  code: z.string().min(3).max(30).toUpperCase(),
  type: z.enum(['percentage', 'fixed']),
  value: z.number().positive(),
  minOrderAmount: z.number().nonnegative().default(0),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const couponUpdateRequestSchema = z.object({
  type: z.enum(['percentage', 'fixed']).optional(),
  value: z.number().positive().optional(),
  minOrderAmount: z.number().nonnegative().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const couponValidateRequestSchema = z.object({
  code: z.string().min(3).max(30).toUpperCase(),
  orderAmount: z.number().nonnegative(),
});

export const couponValidateResponseSchema = z.object({
  valid: z.boolean(),
  coupon: couponSchema.nullable(),
  discount: z.number().nonnegative(),
  error: z.string().optional(),
});

// ─── Types ─────────────────────────────────────────────────────────────

export type Coupon = z.infer<typeof couponSchema>;
export type CouponCreateRequest = z.infer<typeof couponCreateRequestSchema>;
export type CouponUpdateRequest = z.infer<typeof couponUpdateRequestSchema>;
export type CouponValidateRequest = z.infer<typeof couponValidateRequestSchema>;
export type CouponValidateResponse = z.infer<typeof couponValidateResponseSchema>;
