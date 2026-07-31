import { z } from "zod";

// ─── Customer ──────────────────────────────────────────────────────────

export const customerSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastSeenAt: z.string().optional(),
  totalOrders: z.number().int().nonnegative(),
  totalSpent: z.number().nonnegative(),
  addresses: z.array(z.object({
    id: z.string(),
    label: z.string().nullable(),
    address: z.string(),
    isDefault: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })).optional(),
});

export const customerAddressCreateRequestSchema = z.object({
  label: z.string().max(60).optional(),
  address: z.string().min(5).max(280),
  isDefault: z.boolean().optional(),
});

export const customerAddressUpdateRequestSchema = z.object({
  label: z.string().max(60).nullable().optional(),
  address: z.string().min(5).max(280).optional(),
  isDefault: z.boolean().optional(),
});

export const customerListResponseSchema = z.array(customerSchema);

export const customerCreateRequestSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
});

export const customersQuerySchema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const customerUpdateRequestSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
});

// ─── Analytics & Summaries ─────────────────────────────────────────────

export const customerAnalyticsSchema = z.object({
  totalCustomers: z.number().int(),
  activeCustomers: z.number().int(),
  newCustomers: z.number().int(),
  repeatRate: z.number(),
  avgSpendPerCustomer: z.number(),
  avgOrdersPerCustomer: z.number(),
});

export const customerAnalyticsRequestSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const operationalSummaryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const reservationsSummarySchema = z.object({
  total: z.number().int(),
  pending: z.number().int(),
  confirmed: z.number().int(),
  seated: z.number().int(),
  cancelled: z.number().int(),
  noShow: z.number().int(),
  noShowRate: z.number(),
});

export const deliverySummarySchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  new: z.number().int(),
  preparing: z.number().int(),
  ready: z.number().int(),
  outForDelivery: z.number().int(),
  delivered: z.number().int(),
  cancelled: z.number().int(),
});

// ─── Types ─────────────────────────────────────────────────────────────

export type Customer = z.infer<typeof customerSchema>;
export type CustomerListResponse = z.infer<typeof customerListResponseSchema>;
export type CustomerCreateRequest = z.infer<typeof customerCreateRequestSchema>;
export type CustomerUpdateRequest = z.infer<typeof customerUpdateRequestSchema>;
export type CustomerAddress = z.infer<typeof customerSchema>['addresses'] extends (infer T)[] | undefined ? T : never;
export type CustomerAddressCreateRequest = z.infer<typeof customerAddressCreateRequestSchema>;
export type CustomerAddressUpdateRequest = z.infer<typeof customerAddressUpdateRequestSchema>;
export type CustomersQuery = z.infer<typeof customersQuerySchema>;
export type CustomerAnalytics = z.infer<typeof customerAnalyticsSchema>;
export type CustomerAnalyticsRequest = z.infer<typeof customerAnalyticsRequestSchema>;
export type OperationalSummaryQuery = z.infer<typeof operationalSummaryQuerySchema>;
export type ReservationsSummary = z.infer<typeof reservationsSummarySchema>;
export type DeliverySummary = z.infer<typeof deliverySummarySchema>;

