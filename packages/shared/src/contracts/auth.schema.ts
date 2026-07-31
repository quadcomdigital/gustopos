import { z } from "zod";

// ─── Base enums ────────────────────────────────────────────────────────

export const staffRoleSchema = z.enum(["admin", "waiter", "chef"]);
export const moduleKeySchema = z.enum([
  "kitchen",
  "inventory",
  "customers",
  "analytics",
  "printing",
  "public_menu",
  "public_takeaway",
  "consumer_accounts",
  "loyalty_points",
  "self_order_qr",
  "reservations",
  "delivery",
  "purchasing_suppliers",
  "staff_shifts_timeclock",
  "fiscal_exports",
  "simple_catalog",
  "public_group_order",
]);

// ─── Staff ─────────────────────────────────────────────────────────────

export const staffSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  role: staffRoleSchema,
  enabledModules: z.array(moduleKeySchema).optional(),
  permissions: z.array(z.string()).optional(),
  customPermissions: z.array(z.string()).optional(),
});

export const staffAdminSchema = staffSchema.extend({
  isActive: z.boolean(),
  customPermissions: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const staffListResponseSchema = z.array(staffSchema);
export const staffAdminListResponseSchema = z.array(staffAdminSchema);

export const staffCreateRequestSchema = z.object({
  name: z.string().min(2),
  role: staffRoleSchema,
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export const staffUpdateRequestSchema = z.object({
  name: z.string().min(2).optional(),
  role: staffRoleSchema.optional(),
  customPermissions: z.array(z.string()).optional(),
});

export const staffResetPinRequestSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export const logoutResponseSchema = z.object({
  success: z.boolean(),
});

// ─── Login / Refresh ───────────────────────────────────────────────────

export const loginRequestSchema = z.object({
  staffId: z.string(),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: staffSchema,
});

export const refreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export const refreshResponseSchema = loginResponseSchema;

// ─── Superadmin ────────────────────────────────────────────────────────

export const superadminLoginRequestSchema = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(8).max(200),
});

export const superadminUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  isActive: z.boolean(),
  lastLoginAt: z.string().optional(),
});

export const superadminAuthResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: superadminUserSchema,
});

export const superadminRefreshRequestSchema = z.object({
  refreshToken: z.string(),
});

// ─── Tenant ────────────────────────────────────────────────────────────

export const tenantSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  subdomain: z.string().optional(),
  domain: z.string().optional(),
  isActive: z.boolean(),
  resolutionOrder: z.array(z.enum(["subdomain", "slug", "header", "jwt"])).default(["subdomain", "slug", "header", "jwt"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const tenantModuleSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  moduleKey: moduleKeySchema,
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const tenantModuleConfigSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  moduleKey: moduleKeySchema,
  config: z.record(z.string(), z.unknown()).default({}),
  updatedAt: z.string(),
});

export const tenantCreateRequestSchema = z.object({
  slug: z.string().min(2).max(60),
  name: z.string().min(2).max(120),
  subdomain: z.string().min(2).max(63).optional(),
  domain: z.string().max(255).optional(),
  resolutionOrder: z.array(z.enum(["subdomain", "slug", "header", "jwt"])).min(1).max(4).optional(),
});

export const tenantUpdateRequestSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  subdomain: z.string().min(2).max(63).optional(),
  domain: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
  resolutionOrder: z.array(z.enum(["subdomain", "slug", "header", "jwt"])).min(1).max(4).optional(),
});

export const tenantModuleToggleRequestSchema = z.object({
  moduleKey: moduleKeySchema,
  enabled: z.boolean(),
});

export const tenantModuleConfigUpsertRequestSchema = z.object({
  moduleKey: moduleKeySchema,
  config: z.record(z.string(), z.unknown()),
});

// ─── QZ Tray Config ────────────────────────────────────────────────────

export const qzTrayConfigSchema = z.object({
  hosts: z.array(z.string()).default(["localhost", "localhost.qz.io"]),
  securePorts: z.array(z.number()).default([8181, 8282, 8383, 8484]),
  insecurePorts: z.array(z.number()).default([8182, 8283, 8384, 8385]),
  useSecure: z.boolean().default(true),
});

// ─── Types ─────────────────────────────────────────────────────────────

export type ModuleKey = z.infer<typeof moduleKeySchema>;
export type Staff = z.infer<typeof staffSchema>;
export type StaffAdmin = z.infer<typeof staffAdminSchema>;
export type StaffListResponse = z.infer<typeof staffListResponseSchema>;
export type StaffAdminListResponse = z.infer<typeof staffAdminListResponseSchema>;
export type StaffCreateRequest = z.infer<typeof staffCreateRequestSchema>;
export type StaffUpdateRequest = z.infer<typeof staffUpdateRequestSchema>;
export type StaffResetPinRequest = z.infer<typeof staffResetPinRequestSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type SuperadminLoginRequest = z.infer<typeof superadminLoginRequestSchema>;
export type SuperadminUser = z.infer<typeof superadminUserSchema>;
export type SuperadminAuthResponse = z.infer<typeof superadminAuthResponseSchema>;
export type SuperadminRefreshRequest = z.infer<typeof superadminRefreshRequestSchema>;
export type Tenant = z.infer<typeof tenantSchema>;
export type TenantModule = z.infer<typeof tenantModuleSchema>;
export type TenantModuleConfig = z.infer<typeof tenantModuleConfigSchema>;
export type TenantCreateRequest = z.infer<typeof tenantCreateRequestSchema>;
export type TenantUpdateRequest = z.infer<typeof tenantUpdateRequestSchema>;
export type TenantModuleToggleRequest = z.infer<typeof tenantModuleToggleRequestSchema>;
export type TenantModuleConfigUpsertRequest = z.infer<typeof tenantModuleConfigUpsertRequestSchema>;
export type QzTrayConfig = z.infer<typeof qzTrayConfigSchema>;
