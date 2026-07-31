import { z } from "zod";

// ─── Delivery ───────────────────────────────────────────────────────────────

export const deliveryStatusSchema = z.enum(["new", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]);

export const deliveryOrderSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  customerAddress: z.string().min(1),
  courierName: z.string().optional(),
  courierPhone: z.string().optional(),
  eta: z.string().optional(),
  status: deliveryStatusSchema,
  statusChangedAt: z.string().optional(),
  assignedAt: z.string().optional(),
  deliveryFee: z.number().nonnegative(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const deliveryOrdersListResponseSchema = z.array(deliveryOrderSchema);

export const deliveryUpsertRequestSchema = z.object({
  customerAddress: z.string().min(5).max(280),
  courierName: z.string().max(120).optional(),
  courierPhone: z.string().max(30).optional(),
  eta: z.string().datetime().optional(),
  status: deliveryStatusSchema.default("new"),
  deliveryFee: z.number().nonnegative().default(0),
  notes: z.string().max(500).optional(),
});

export const deliveryStatusUpdateRequestSchema = z.object({
  status: deliveryStatusSchema,
  eta: z.string().datetime().optional(),
  courierName: z.string().max(120).optional(),
  courierPhone: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
});

export const deliveryOrdersQuerySchema = z.object({
  status: deliveryStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
export type DeliveryOrder = z.infer<typeof deliveryOrderSchema>;
export type DeliveryOrdersListResponse = z.infer<typeof deliveryOrdersListResponseSchema>;
export type DeliveryUpsertRequest = z.infer<typeof deliveryUpsertRequestSchema>;
export type DeliveryStatusUpdateRequest = z.infer<typeof deliveryStatusUpdateRequestSchema>;
export type DeliveryOrdersQuery = z.infer<typeof deliveryOrdersQuerySchema>;
