import { z } from "zod";

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

export const orderStatusSchema = z.enum([
  "pending",
  "preparing",
  "ready",
  "served",
  "paid",
  "cancelled",
]);

export const tableStatusSchema = z.enum(["free", "occupied", "reserved"]);
export const orderTypeSchema = z.enum(["dine_in", "takeaway", "delivery"]);
export const reservationStatusSchema = z.enum(["pending", "confirmed", "seated", "cancelled", "no_show"]);
export const deliveryStatusSchema = z.enum(["new", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]);
export const categoryScopeSchema = z.enum(["ingredient", "bom", "menu"]);
export const printAreaSchema = z.enum(["kitchen", "bar", "cashier"]);

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().nullable().optional(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
  minThreshold: z.number().nonnegative(),
  categoryId: z.string().optional(),
  unitCost: z.number().nonnegative().default(0),
  salePrice: z.number().nonnegative().nullable().default(null),
  isActive: z.boolean().default(true),
  supplierName: z.string().nullable().optional(),
  brandName: z.string().nullable().optional(),
  isContainer: z.number().default(0),
});

export const ingredientCreateRequestSchema = z.object({
  name: z.string().min(2),
  sku: z.string().min(1).optional(),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
  minThreshold: z.number().nonnegative(),
  categoryId: z.string().optional(),
  unitCost: z.number().nonnegative().default(0),
  salePrice: z.number().nonnegative().nullable().optional(),
  isContainer: z.number().optional().default(0),
});

export const ingredientUpdateRequestSchema = z.object({
  name: z.string().min(2).optional(),
  sku: z.string().min(1).nullable().optional(),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().min(1).optional(),
  minThreshold: z.number().nonnegative().optional(),
  categoryId: z.string().optional(),
  unitCost: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  isContainer: z.number().optional(),
});

export const ingredientAdjustRequestSchema = z.object({
  quantity: z.number(),
  notes: z.string().optional(),
});

export const prepItemSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  ingredientId: z.string(),
  name: z.string(),
  quantityPerUnit: z.number(),
  unit: z.string(),
  stockQuantity: z.number().nonnegative().default(0),
  createdAt: z.string(),
});

export type PrepItem = z.infer<typeof prepItemSchema>;

export const prepItemUpdateRequestSchema = z.object({
  name: z.string().min(1).optional(),
  quantityPerUnit: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
});

export type PrepItemUpdateRequest = z.infer<typeof prepItemUpdateRequestSchema>;

export const unitConversionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  inventoryId: z.string(),
  fromUnit: z.string(),
  toUnit: z.string(),
  factor: z.number(),
  createdAt: z.string(),
});

export type UnitConversion = z.infer<typeof unitConversionSchema>;

export const unitConversionCreateRequestSchema = z.object({
  fromUnit: z.string().min(1),
  toUnit: z.string().min(1),
  factor: z.number().positive(),
});

export type UnitConversionCreateRequest = z.infer<typeof unitConversionCreateRequestSchema>;

export const preparePrepItemResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  previousStock: z.number(),
  newStock: z.number(),
  ingredientDeducted: z.number(),
});

export type PreparePrepItemResponse = z.infer<typeof preparePrepItemResponseSchema>;

export const stockMovementTypeSchema = z.enum([
  "order_deduction",
  "order_reversal",
  "manual_adjustment",
  "purchase_receipt",
  "prep_consumption",
  "prep_restoration",
]);

export const stockMovementSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  ingredientId: z.string().nullable().optional(),
  prepItemId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
  movementType: stockMovementTypeSchema,
  quantity: z.number(),
  previousQuantity: z.number(),
  newQuantity: z.number(),
  notes: z.string().nullable().optional(),
  staffId: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const stockMovementsQuerySchema = z.object({
  ingredientId: z.string().optional(),
  orderId: z.string().optional(),
  movementType: stockMovementTypeSchema.optional(),
  limit: z.number().min(1).max(200).default(50),
  offset: z.number().min(0).default(0),
});

export const reorderSuggestionSchema = z.object({
  ingredientId: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  currentQty: z.number(),
  minThreshold: z.number(),
  unit: z.string(),
  deficit: z.number(),
  preferredSupplierName: z.string().optional(),
  lastUnitCost: z.number().optional(),
});

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

export const bomComponentTypeSchema = z.enum(["ingredient", "bom", "prep"]);

export const bomComponentSchema = z.object({
  id: z.string(),
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string(),
});

export const bomItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  yieldQuantity: z.number().positive(),
  isActive: z.boolean(),
  categoryId: z.string().optional(),
  components: z.array(bomComponentSchema),
  isContainer: z.number().default(0),
});

export const bomListResponseSchema = z.array(bomItemSchema);

export const modifierOptionOverrideSchema = z.object({
  ingredientId: z.string().min(1),
  action: z.enum(["add", "remove", "replace"]),
});

export const modifierOptionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  inventoryItemId: z.string().optional(),
  bomId: z.string().optional(),
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
  bomId: z.string().optional(),
  priceDelta: z.number().default(0),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  ingredientOverrides: z.array(modifierOptionOverrideInputSchema).default([]),
});

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

export const menuRecipeComponentSchema = z.object({
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
  componentName: z.string().min(1).optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

export const menuItemModifierSchema = z.object({
  id: z.string(),
  inventoryItemId: z.string(),
  name: z.string().optional(),
  priceDelta: z.number().default(0),
  effectivePrice: z.number().optional(),
});

export const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  category: z.string(),
  categoryId: z.string().optional(),
  defaultContainerId: z.string().nullable().optional(),
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
  defaultContainerId: z.string().nullable().optional(),
  printAreas: z.array(printAreaSchema),
  isActive: z.boolean(),
  recipe: z.array(menuRecipeComponentSchema),
  modifiers: z.array(menuItemModifierSchema).default([]),
  modifierGroups: z.array(modifierGroupSchema).default([]),
});

export const menuItemAdminListResponseSchema = z.array(menuItemAdminSchema);

export const menuItemCreateRequestSchema = z.object({
  name: z.string().min(2),
  price: z.number().positive(),
  category: z.string().min(2),
  categoryId: z.string().optional(),
  defaultContainerId: z.string().nullable().optional(),
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
  defaultContainerId: z.string().nullable().optional(),
  printAreas: z.array(printAreaSchema).optional(),
  modifiers: z.array(menuItemModifierSchema.omit({ id: true, name: true, effectivePrice: true })).optional(),
  modifierGroups: z.array(modifierGroupInputSchema).optional(),
});

export const menuItemReplaceRecipeRequestSchema = z.object({
  recipe: z.array(menuRecipeComponentSchema).default([]),
});

export const orderItemSchema = z.object({
  id: z.string().min(1),
  orderItemId: z.number().int().positive().optional(),
  name: z.string().min(1),
  price: z.number().nonnegative('Price cannot be negative'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  notes: z.string().max(200).optional(),
  ingredientOverrides: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        action: z.enum(["add", "remove"]),
      }),
    )
    .optional(),
  selectedModifiers: z
    .array(
      z.object({
        groupId: z.string().min(1),
        optionId: z.string().min(1),
      }),
    )
    .optional(),
});

export const orderSchema = z.object({
  id: z.string(),
  orderType: orderTypeSchema,
  table: z.string().optional(),
  ticketNumber: z.string().optional(),
  customerName: z.string().optional(),
  customerId: z.string().optional(),
  customerPhone: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  items: z.array(orderItemSchema),
  total: z.number().nonnegative(),
  status: orderStatusSchema,
  timestamp: z.string(),
  staffId: z.string().min(1),
});

export const staffSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  role: staffRoleSchema,
  enabledModules: z.array(moduleKeySchema).optional(),
  permissions: z.array(z.string()).optional(),
  customPermissions: z.array(z.string()).optional(),
});

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

// QZ Tray configuration (stored under moduleKey: "printing")
export const qzTrayConfigSchema = z.object({
  hosts: z.array(z.string()).default(["localhost", "localhost.qz.io"]),
  securePorts: z.array(z.number()).default([8181, 8282, 8383, 8484]),
  insecurePorts: z.array(z.number()).default([8182, 8283, 8384, 8385]),
  useSecure: z.boolean().default(true),
});

export type QzTrayConfig = z.infer<typeof qzTrayConfigSchema>;

export const publicMenuCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  printAreas: z.array(printAreaSchema),
});

export const publicMenuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  categoryId: z.string().optional(),
  category: z.string(),
  ingredients: z.array(z.string()),
  bomIds: z.array(z.string()),
  printAreas: z.array(printAreaSchema),
  isFeatured: z.boolean().default(false),
  isSoldOut: z.boolean().default(false),
});

export const publicMenuBrandingSchema = z.object({
  preset: z.enum(["minimal_elegant", "rich_visual", "modern_bistro"]).default("minimal_elegant"),
  logoUrl: z
    .string()
    .refine((value) => /^https?:\/\//.test(value) || /^data:image\//.test(value), "Invalid logo URL")
    .optional(),
  heroImageUrl: z
    .string()
    .refine((value) => /^https?:\/\//.test(value) || /^data:image\//.test(value), "Invalid hero image URL")
    .optional(),
  brandTagline: z.string().max(120).optional(),
  showIngredients: z.boolean().default(true),
  showPrices: z.boolean().default(true),
  currency: z.string().max(8).default("EUR"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f172a"),
});

export const publicMenuModuleConfigSchema = publicMenuBrandingSchema.extend({
  categoryOrder: z.array(z.string()).default([]),
  hiddenCategoryIds: z.array(z.string()).default([]),
  featuredItemIds: z.array(z.string()).default([]),
  soldOutItemIds: z.array(z.string()).default([]),
});

export const publicMenuResponseSchema = z.object({
  tenant: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  branding: publicMenuBrandingSchema,
  capabilities: z.object({
    takeawayOrder: z.boolean().default(false),
    groupOrder: z.boolean().default(false),
    takeawayConfig: z.object({
      minOrderAmount: z.number().nonnegative().default(0),
      maxItems: z.number().int().positive().default(20),
      pickupEtaRequired: z.boolean().default(false),
      allowNotes: z.boolean().default(true),
    }),
  }),
  categories: z.array(publicMenuCategorySchema),
  items: z.array(publicMenuItemSchema),
  generatedAt: z.string(),
});

export const publicTakeawayCreateRequestSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  total: z.number().positive(),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().max(30).optional(),
  pickupEta: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const publicTakeawayCreateResponseSchema = z.object({
  order: orderSchema,
  trackingToken: z.string(),
  trackingUrl: z.string(),
});

export const publicTakeawayTrackingResponseSchema = z.object({
  order: orderSchema,
});

export const groupOrderSessionStatusSchema = z.enum(["open", "locked", "submitted", "expired"]);

export const groupOrderParticipantRoleSchema = z.enum(["master", "guest"]);

export const groupOrderCartItemSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  menuItemId: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  category: z.string(),
  ingredients: z.array(z.string()),
  updatedByParticipantId: z.string().optional(),
  updatedAt: z.string(),
});

export const groupOrderParticipantSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  displayName: z.string().min(2).max(120),
  role: groupOrderParticipantRoleSchema,
  isOnline: z.boolean().default(false),
  joinedAt: z.string(),
  lastSeenAt: z.string(),
});

export const groupOrderSessionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  tenantSlug: z.string(),
  joinCode: z.string(),
  status: groupOrderSessionStatusSchema,
  version: z.number().int().nonnegative(),
  masterParticipantId: z.string(),
  expiresAt: z.string(),
  submittedOrderId: z.string().optional(),
  participants: z.array(groupOrderParticipantSchema),
  items: z.array(groupOrderCartItemSchema),
  total: z.number().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const groupOrderCreateSessionRequestSchema = z.object({
  displayName: z.string().min(2).max(120),
});

export const groupOrderCreateSessionResponseSchema = z.object({
  session: groupOrderSessionSchema,
  participant: groupOrderParticipantSchema,
  participantToken: z.string().min(24),
  joinUrl: z.string(),
});

export const groupOrderJoinSessionRequestSchema = z.object({
  displayName: z.string().min(2).max(120),
});

export const groupOrderJoinSessionResponseSchema = z.object({
  session: groupOrderSessionSchema,
  participant: groupOrderParticipantSchema,
  participantToken: z.string().min(24),
});

export const groupOrderPatchCartRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      menuItemId: z.string().min(1),
      quantity: z.number().int().min(0),
    }),
  ),
});

export const groupOrderPatchCartResponseSchema = z.object({
  session: groupOrderSessionSchema,
  reconciled: z.boolean().default(false),
});

export const groupOrderSubmitRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(8).optional(),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().max(30).optional(),
  pickupEta: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const groupOrderSubmitResponseSchema = z.object({
  session: groupOrderSessionSchema,
  order: orderSchema,
});

export const groupOrderRealtimeJoinedSchema = z.object({
  session: groupOrderSessionSchema,
  participant: groupOrderParticipantSchema,
});

export const groupOrderRealtimeCartUpdatedSchema = z.object({
  session: groupOrderSessionSchema,
  byParticipantId: z.string(),
  reconciled: z.boolean().default(false),
});

export const groupOrderRealtimeMasterChangedSchema = z.object({
  sessionId: z.string(),
  masterParticipantId: z.string(),
});

export const groupOrderRealtimeSubmittedSchema = z.object({
  session: groupOrderSessionSchema,
  order: orderSchema,
});

export const publicFunnelEventRequestSchema = z.object({
  event: z.enum([
    "public_menu_view",
    "public_menu_add_to_cart",
    "public_menu_checkout_start",
    "public_takeaway_submit_success",
    "public_takeaway_tracking_view",
  ]),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const publicFunnelEventResponseSchema = z.object({
  success: z.literal(true),
});

export const selfOrderSessionSchema = z.object({
  tableId: z.string(),
  tableNumber: z.string(),
  expiresAt: z.string(),
});

export const selfOrderResolveResponseSchema = z.object({
  session: selfOrderSessionSchema,
  menu: publicMenuResponseSchema,
});

export const selfOrderCreateRequestSchema = z.object({
  token: z.string().min(12),
  items: z.array(orderItemSchema).min(1),
  total: z.number().positive(),
  customerName: z.string().min(2).max(120).optional(),
  customerPhone: z.string().max(30).optional(),
  notes: z.string().max(500).optional(),
});

export const selfOrderCreateResponseSchema = z.object({
  order: orderSchema,
  sessionExpiresAt: z.string(),
});

export const selfOrderSessionRotateResponseSchema = z.object({
  tableId: z.string(),
  tableNumber: z.string(),
  token: z.string(),
  expiresAt: z.string(),
  publicUrl: z.string(),
});

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

export const staffAdminSchema = staffSchema.extend({
  isActive: z.boolean(),
  customPermissions: z.array(z.string()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const tableSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: tableStatusSchema,
  currentOrderId: z.string().optional(),
});

export const tableCreateRequestSchema = z.object({
  number: z.string().min(1).max(20),
});

export const tableUpdateRequestSchema = z.object({
  number: z.string().min(1).max(20).optional(),
});

export const tableBulkCreateRequestSchema = z.object({
  count: z.number().int().min(1).max(100),
  prefix: z.string().max(10).optional(),
});

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

export const loginRequestSchema = z.object({
  staffId: z.string(),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: staffSchema,
});

export const consumerUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  fullName: z.string().min(2),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const consumerRegisterRequestSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  password: z.string().min(6).max(120),
}).refine((payload) => Boolean(payload.email || payload.phone), {
  message: "Either email or phone is required",
});

export const consumerLoginRequestSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  password: z.string().min(6).max(120),
}).refine((payload) => Boolean(payload.email || payload.phone), {
  message: "Either email or phone is required",
});

export const consumerAuthResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: consumerUserSchema,
});

export const consumerRefreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export const consumerRefreshResponseSchema = consumerAuthResponseSchema;

export const consumerAccountsConfigSchema = z.object({
  registrationEnabled: z.boolean().default(true),
  requireAccountForTakeaway: z.boolean().default(false),
  requireAccountForSelfOrder: z.boolean().default(false),
});

export const consumerOrderHistoryItemSchema = z.object({
  order: orderSchema,
});

export const consumerOrderHistoryResponseSchema = z.array(consumerOrderHistoryItemSchema);

export const refreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export const refreshResponseSchema = loginResponseSchema;

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

export const createOrderRequestSchema = z.object({
  orderType: orderTypeSchema.optional(),
  table: z.string().optional(),
  customerName: z.string().min(2).max(120).optional(),
  customerId: z.string().optional(),
  customerPhone: z.string().max(30).optional(),
  pickupEta: z.string().datetime().optional(),
  items: z.array(orderItemSchema).min(1, 'Order must have at least 1 item'),
  total: z.number().positive('Order total must be positive'),
  staffId: z.string().min(1, 'Staff ID is required'),
});

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

export const reservationSchema = z.object({
  id: z.string(),
  tableId: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  partySize: z.number().int().positive(),
  reservedFor: z.string(),
  status: reservationStatusSchema,
  noShowReason: z.string().optional(),
  notes: z.string().optional(),
  source: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const reservationListResponseSchema = z.array(reservationSchema);

export const reservationCreateRequestSchema = z.object({
  tableId: z.string().optional(),
  customerName: z.string().min(2).max(120),
  customerPhone: z.string().max(30).optional(),
  partySize: z.number().int().min(1).max(50),
  reservedFor: z.string().datetime(),
  notes: z.string().max(500).optional(),
  source: z.enum(["walk_in", "phone", "online", "manual"]).default("manual"),
});

export const reservationUpdateRequestSchema = z.object({
  tableId: z.string().optional(),
  customerName: z.string().min(2).max(120).optional(),
  customerPhone: z.string().max(30).optional(),
  partySize: z.number().int().min(1).max(50).optional(),
  reservedFor: z.string().datetime().optional(),
  status: reservationStatusSchema.optional(),
  noShowReason: z.string().min(3).max(160).optional(),
  notes: z.string().max(500).optional(),
  source: z.enum(["walk_in", "phone", "online", "manual"]).optional(),
});

export const reservationNoShowRequestSchema = z.object({
  reason: z.string().min(3).max(160),
});

export const reservationsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: reservationStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

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

export const loyaltyBalanceSchema = z.object({
  customerId: z.string(),
  points: z.number().int().nonnegative(),
  totalEarned: z.number().int().nonnegative(),
  totalRedeemed: z.number().int().nonnegative(),
});

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

export const orderHistoryFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: orderStatusSchema.optional(),
  orderType: orderTypeSchema.optional(),
  staffId: z.string().optional(),
  table: z.string().optional(),
  customerId: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const orderHistoryListResponseSchema = z.array(orderSchema);

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

export const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  vatNumber: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const supplierCreateRequestSchema = z.object({
  name: z.string().min(2).max(140),
  vatNumber: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(180).optional(),
});

export const supplierUpdateRequestSchema = z.object({
  name: z.string().min(2).max(140).optional(),
  vatNumber: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(180).optional(),
  isActive: z.boolean().optional(),
});

export const suppliersQuerySchema = z.object({
  active: z.boolean().optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const supplierIngredientSchema = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  ingredientId: z.string(),
  ingredientName: z.string(),
  brandName: z.string().nullable(),
  unitCost: z.number().nullable(),
  isPreferred: z.boolean(),
});

export const supplierIngredientCreateSchema = z.object({
  supplierId: z.string().min(1),
  ingredientId: z.string().min(1),
  brandName: z.string().max(140).optional(),
  unitCost: z.number().min(0).optional(),
  isPreferred: z.boolean().optional(),
});

export const supplierIngredientUpdateSchema = z.object({
  brandName: z.string().max(140).optional(),
  unitCost: z.number().min(0).optional(),
  isPreferred: z.boolean().optional(),
});

export const supplierPoItemSchema = z.object({
  ingredientId: z.string(),
  name: z.string(),
  brandName: z.string().nullable(),
  supplierCost: z.number().nullable(),
  currentCost: z.number(),
  currentStock: z.number(),
  unit: z.string(),
});

export const purchaseOrderStatusSchema = z.enum(["draft", "sent", "partial_received", "received", "cancelled"]);

export const purchaseOrderItemSchema = z.object({
  id: z.string(),
  inventoryId: z.string().optional(),
  itemName: z.string().min(1),
  unit: z.string().min(1),
  orderedQty: z.number().positive(),
  unitCost: z.number().nonnegative(),
  receivedQty: z.number().nonnegative(),
});

export const purchaseOrderSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  status: purchaseOrderStatusSchema,
  expectedAt: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const purchaseOrderCreateRequestSchema = z.object({
  supplierId: z.string().min(1),
  expectedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        inventoryId: z.string().optional(),
        itemName: z.string().min(1).max(180),
        unit: z.string().min(1).max(20),
        orderedQty: z.number().positive(),
        unitCost: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export const purchaseOrderStatusUpdateRequestSchema = z.object({
  status: purchaseOrderStatusSchema,
});

export const purchaseOrdersQuerySchema = z.object({
  supplierId: z.string().optional(),
  status: purchaseOrderStatusSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const goodsReceiptItemSchema = z.object({
  purchaseOrderItemId: z.string(),
  receivedQty: z.number().positive(),
  unitCost: z.number().nonnegative(),
});

export const goodsReceiptSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  receivedAt: z.string(),
  notes: z.string().optional(),
  items: z.array(goodsReceiptItemSchema),
  createdAt: z.string(),
});

export const goodsReceiptCreateRequestSchema = z.object({
  receivedAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
  items: z.array(goodsReceiptItemSchema).min(1),
});

export const shiftStatusSchema = z.enum(["scheduled", "completed", "cancelled"]);
export const timeEntryStatusSchema = z.enum(["open", "closed", "anomaly"]);
export const timeEntrySourceSchema = z.enum(["web", "kiosk"]);

export const shiftSchema = z.object({
  id: z.string(),
  staffId: z.string(),
  shiftDate: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  toleranceEarlyMin: z.number().int().min(0).max(180),
  toleranceLateMin: z.number().int().min(0).max(180),
  status: shiftStatusSchema,
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const shiftCreateRequestSchema = z.object({
  staffId: z.string().min(1),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  toleranceEarlyMin: z.number().int().min(0).max(180).default(15),
  toleranceLateMin: z.number().int().min(0).max(180).default(15),
  notes: z.string().max(500).optional(),
});

export const shiftUpdateRequestSchema = z.object({
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  toleranceEarlyMin: z.number().int().min(0).max(180).optional(),
  toleranceLateMin: z.number().int().min(0).max(180).optional(),
  status: shiftStatusSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const shiftsQuerySchema = z.object({
  staffId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: shiftStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const timeEntrySchema = z.object({
  id: z.string(),
  staffId: z.string(),
  shiftId: z.string().optional(),
  clockInAt: z.string(),
  clockOutAt: z.string().nullable(),
  status: timeEntryStatusSchema,
  source: timeEntrySourceSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const clockInRequestSchema = z.object({
  staffId: z.string().min(1),
  shiftId: z.string().optional(),
  source: timeEntrySourceSchema.default("web"),
  at: z.string().datetime(),
});

export const clockOutRequestSchema = z.object({
  staffId: z.string().min(1),
  at: z.string().datetime(),
});

export const timeReportQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  staffId: z.string().optional(),
});

export const timeReportEntrySchema = z.object({
  staffId: z.string(),
  minutes: z.number().int().nonnegative(),
  date: z.string(),
  anomaly: z.boolean(),
});

export const timeReportResponseSchema = z.object({
  totalMinutes: z.number().int().nonnegative(),
  totalHours: z.number().nonnegative(),
  entries: z.array(timeReportEntrySchema),
});

export const fiscalClosureSchema = z.object({
  id: z.string(),
  businessDate: z.string(),
  closedByStaffId: z.string(),
  totals: z.object({
    gross: z.number(),
    refunds: z.number(),
    net: z.number(),
    cash: z.number(),
    card: z.number(),
  }),
  closedAt: z.string(),
  notes: z.string().optional(),
});

export const fiscalCloseRequestSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).optional(),
});

export const fiscalExportStatusSchema = z.enum(["pending", "ready", "failed"]);
export const fiscalExportFormatSchema = z.enum(["csv"]);

export const fiscalExportSchema = z.object({
  id: z.string(),
  businessDate: z.string(),
  format: fiscalExportFormatSchema,
  status: fiscalExportStatusSchema,
  path: z.string(),
  generatedByStaffId: z.string(),
  generatedAt: z.string(),
  checksum: z.string().optional(),
});

export const fiscalExportCreateRequestSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: fiscalExportFormatSchema.default("csv"),
});

export const fiscalExportsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: fiscalExportStatusSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const bomCreateRequestSchema = z.object({
  name: z.string().min(2),
  unit: z.string().min(1),
  yieldQuantity: z.number().positive(),
  categoryId: z.string().optional(),
  isContainer: z.number().optional().default(0),
  components: z.array(
    z.object({
      componentType: bomComponentTypeSchema,
      componentId: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
    }),
  ).min(1, 'BoM must have at least 1 component'),
});

export const bomUpdateRequestSchema = z.object({
  name: z.string().min(2).optional(),
  unit: z.string().min(1).optional(),
  yieldQuantity: z.number().positive().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().optional(),
  isContainer: z.number().optional(),
});

export const bomUpsertComponentsRequestSchema = z.object({
  components: z.array(
    z.object({
      componentType: bomComponentTypeSchema,
      componentId: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
    }),
  ).min(1, 'BoM must have at least 1 component'),
});

export const bomAddComponentRequestSchema = z.object({
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
});

export const bomRemoveComponentRequestSchema = z.object({
  componentType: bomComponentTypeSchema,
  componentId: z.string().min(1),
});

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

export const updateOrderRequestSchema = z.object({
  status: orderStatusSchema.optional(),
});

export const voidOrderRequestSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const voidOrderResponseSchema = z.object({
  success: z.boolean(),
  order: orderSchema,
});

export const payTableResponseSchema = z.object({
  success: z.boolean(),
});

export const paymentMethodSchema = z.enum(["cash", "card", "mixed"]);
export const paymentKindSchema = z.enum(["sale", "refund"]);
export const paymentStatusSchema = z.enum(["pending", "captured", "failed", "voided"]);

export const closeTableRequestSchema = z.object({
  method: paymentMethodSchema,
  paidAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  surchargeAmount: z.number().nonnegative().optional(),
  gatewayReference: z.string().min(3).max(120).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const paymentItemSchema = z.object({
  orderItemId: z.number().int().positive(),
  menuItemId: z.string().min(1),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});

export const paymentSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  tableNumber: z.string(),
  subtotal: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  surchargeAmount: z.number().nonnegative(),
  total: z.number().nonnegative(),
  method: paymentMethodSchema,
  kind: paymentKindSchema,
  paymentStatus: paymentStatusSchema,
  paidAmount: z.number().nonnegative(),
  changeAmount: z.number().nonnegative(),
  reference: z.string().optional(),
  gatewayReference: z.string().optional(),
  capturedAt: z.string().optional(),
  refundedPaymentId: z.string().optional(),
  refundReason: z.string().optional(),
  notes: z.string().optional(),
  shareIndex: z.number().int().nonnegative().optional(),
  staffId: z.string().min(1),
  createdAt: z.string(),
  items: z.array(paymentItemSchema).optional(),
});

export const closeTableResponseSchema = z.object({
  success: z.boolean(),
  payment: paymentSchema,
});

export const splitBillRequestSchema = z.object({
  people: z.number().int().min(2).max(20),
  persist: z.boolean().optional(),
  method: paymentMethodSchema.optional(),
  paidAmounts: z.array(z.number().nonnegative()).optional(),
  splitReference: z.string().min(3).max(120).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  discountAmount: z.number().nonnegative().optional(),
  surchargeAmount: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export const paySelectedItemsRequestSchema = z.object({
  items: z.array(z.object({
    orderItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).min(1),
  method: paymentMethodSchema,
  gatewayReference: z.string().min(3).max(120).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const paySelectedItemsResponseSchema = z.object({
  payment: paymentSchema,
  paidItems: z.array(z.object({
    orderItemId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })),
  allItemsPaid: z.boolean(),
});

export const markShareAsPaidRequestSchema = z.object({
  method: paymentMethodSchema,
  gatewayReference: z.string().min(3).max(120).optional(),
});

export const markShareAsPaidResponseSchema = z.object({
  payment: paymentSchema,
  allSharesPaid: z.boolean(),
});

export const splitBillResponseSchema = z.object({
  tableId: z.string(),
  tableNumber: z.string(),
  total: z.number(),
  people: z.number().int(),
  shares: z.array(z.number()),
  persisted: z.boolean().optional(),
  payments: z.array(paymentSchema).optional(),
});

export const transferTableRequestSchema = z.object({
  targetTableId: z.string().min(1),
});

export const transferTableResponseSchema = z.object({
  success: z.boolean(),
  sourceTableId: z.string(),
  targetTableId: z.string(),
  movedOrders: z.number().int(),
});

export const paymentFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  method: paymentMethodSchema.optional(),
  kind: paymentKindSchema.optional(),
  staffId: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const paymentsListResponseSchema = z.array(paymentSchema);

export const refundPaymentRequestSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().min(3).max(500),
  notes: z.string().max(500).optional(),
});

export const refundPaymentResponseSchema = z.object({
  success: z.boolean(),
  payment: paymentSchema,
  refundedAmount: z.number(),
  remainingAmount: z.number(),
});

export const printJobSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  area: printAreaSchema,
  protocol: z.enum(["escpos", "disabled"]),
  status: z.enum(["pending", "dispatched", "completed", "failed"]),
  payload: z.string(),
  error: z.string().optional(),
  bridgeId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dispatchedAt: z.string().optional(),
});

export const printJobsListResponseSchema = z.array(printJobSchema);

export const printJobsQuerySchema = z.object({
  status: z.enum(["pending", "dispatched", "completed", "failed"]).optional(),
  area: printAreaSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const dispatchPrintJobRequestSchema = z.object({
  endpoint: z.string().url().optional(),
});

export const printJobsPollQuerySchema = z.object({
  areas: z.string().min(1), // comma-separated: "kitchen,bar,cashier"
});

export const printBridgeStatusSchema = z.enum(["active", "offline"]);

export const printBridgePrinterSchema = z.object({
  area: printAreaSchema,
  name: z.string().min(1),
  ip: z.string().nullable().optional(),
  port: z.number().int().min(1).max(65535).optional(),
});

export const printBridgePrinterMappingSchema = z.object({
  area: printAreaSchema,
  name: z.string().min(1),
  ip: z.string().nullable().optional(),
  port: z.number().int().positive().nullable().optional(),
});

export const printBridgeUpdateMappingsRequestSchema = z.object({
  mappings: z.array(printBridgePrinterMappingSchema).default([]),
});

export const printBridgeUpdateClaimedAreasRequestSchema = z.object({
  claimedAreas: z.array(printAreaSchema).min(1),
});

export const printBridgeTestPrintRequestSchema = z.object({
  area: printAreaSchema,
  message: z.string().max(200).optional(),
});

export const printBridgeTestPrintResponseSchema = z.object({
  jobId: z.string(),
  bridgeId: z.string(),
  area: printAreaSchema,
  orderId: z.string(),
});

export const printBridgeSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  host: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  status: printBridgeStatusSchema,
  areas: z.array(printAreaSchema),
  printers: z.array(printBridgePrinterSchema),
  mappings: z.array(printBridgePrinterMappingSchema).default([]),
  claimedAreas: z.array(printAreaSchema).default([]),
  lastHeartbeatAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const printBridgeListResponseSchema = z.array(printBridgeSchema);

export const printBridgeHeartbeatRequestSchema = z.object({
  bridgeId: z.string().min(1),
  name: z.string().min(1).optional(),
  host: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  areas: z.array(printAreaSchema).min(1),
  printers: z.array(printBridgePrinterSchema).default([]),
});

export const printBridgeHeartbeatResponseSchema = z.object({
  bridge: printBridgeSchema,
  serverTime: z.string(),
});

export const printBridgeClaimRequestSchema = z.object({
  bridgeId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const printBridgeClaimResponseSchema = z.object({
  jobs: z.array(printJobSchema),
});

export const printBridgeJobCompleteRequestSchema = z.object({
  bridgeId: z.string().min(1),
  notes: z.string().max(500).optional(),
});

export const printBridgeJobFailRequestSchema = z.object({
  bridgeId: z.string().min(1),
  error: z.string().min(1).max(500),
});

export const printBridgeOnboardingSecretSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  suggestedBridgeId: z.string(),
  boundBridgeId: z.string().nullable().optional(),
  lastUsedAt: z.string().nullable().optional(),
  revokedAt: z.string().nullable().optional(),
  createdByStaffId: z.string().nullable().optional(),
  createdAt: z.string(),
  isActive: z.boolean(),
});

export const printBridgeOnboardingSecretCreateRequestSchema = z.object({
  bridgeIdHint: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, underscore, hyphen")
    .optional(),
});

export const printBridgeOnboardingSecretCreateResponseSchema = z.object({
  secret: printBridgeOnboardingSecretSchema,
  plaintext: z.string(),
  suggestedBridgeId: z.string(),
  bootstrapSnippet: z.string(),
});

export const localBridgeArea = z.enum(["kitchen", "bar", "cashier"]);
export const localBridgePrinterPerAreaSchema = z.object({
  area: localBridgeArea,
  printerName: z.string().min(1),
});
export const localBridgeConfigSchema = z.object({
  enabled: z.boolean(),
  bridgeId: z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/),
  deviceName: z.string().min(1).max(80),
  areas: z.array(localBridgeArea).min(1),
  printersPerArea: z.array(localBridgePrinterPerAreaSchema).default([]),
  enableWakeLock: z.boolean().default(true),
  enableKeepaliveWorker: z.boolean().default(true),
  heartbeatIntervalMs: z.number().int().min(5000).max(120000).default(15000),
  claimIntervalMs: z.number().int().min(1000).max(60000).default(3000),
  enabledAt: z.string().nullable().optional(),
});
export type LocalBridgeArea = z.infer<typeof localBridgeArea>;
export type LocalBridgePrinterPerArea = z.infer<typeof localBridgePrinterPerAreaSchema>;
export type LocalBridgeConfig = z.infer<typeof localBridgeConfigSchema>;

export const printBridgeOnboardingSecretsListResponseSchema = z.array(printBridgeOnboardingSecretSchema);

export const failPrintJobRequestSchema = z.object({
  error: z.string().min(1).max(500),
});

export const confirmPrintJobRequestSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const retryPrintJobRequestSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const uiThemeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  success: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  warning: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  danger: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  bg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  border: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textMain: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  textMuted: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const uiSettingsSchema = z.object({
  brandName: z.string().min(2).max(40),
  taxRate: z.number().min(0).max(1).default(0.10),
  theme: uiThemeSchema,
  printing: z.object({
    kitchenPrinterName: z.string().max(80),
    kitchenPrinterIp: z.string().max(45).optional(),
    kitchenPrinterPort: z.number().int().min(1).max(65535).optional(),
    cashierPrinterName: z.string().max(80),
    cashierPrinterIp: z.string().max(45).optional(),
    cashierPrinterPort: z.number().int().min(1).max(65535).optional(),
    barPrinterName: z.string().max(80),
    barPrinterIp: z.string().max(45).optional(),
    barPrinterPort: z.number().int().min(1).max(65535).optional(),
    protocol: z.enum(["escpos", "disabled"]),
    activeAreas: z.array(printAreaSchema),
    autoPrintKitchen: z.boolean(),
    autoPrintOnClose: z.boolean(),
    logoMode: z.enum(["none", "bitmap"]),
    logoBitmap: z.string().optional(),
    logoWidth: z.number().int().min(128).max(576),
    logoThreshold: z.number().int().min(0).max(255),
    receiptFooter: z.string().max(200),
  }),
});

export const updateUiSettingsRequestSchema = uiSettingsSchema;

export const updatePrintingSettingsRequestSchema = z.object({
  printing: uiSettingsSchema.shape.printing.partial(),
});

export const logoutResponseSchema = z.object({
  success: z.boolean(),
});

export const defaultUiSettings: UiSettings = {
  brandName: "GUSTOPOS",
  taxRate: 0.10,
  theme: {
    primary: "#1a365d",
    secondary: "#2d3748",
    accent: "#3182ce",
    success: "#38a169",
    warning: "#dd6b20",
    danger: "#e53e3e",
    bg: "#f7fafc",
    border: "#e2e8f0",
    textMain: "#2d3748",
    textMuted: "#718096",
  },
  printing: {
    kitchenPrinterName: "Kitchen-01",
    kitchenPrinterIp: undefined,
    kitchenPrinterPort: undefined,
    cashierPrinterName: "Cashier-01",
    cashierPrinterIp: undefined,
    cashierPrinterPort: undefined,
    barPrinterName: "Bar-01",
    barPrinterIp: undefined,
    barPrinterPort: undefined,
    protocol: "escpos",
    activeAreas: ["kitchen", "cashier"],
    autoPrintKitchen: true,
    autoPrintOnClose: false,
    logoMode: "none",
    logoBitmap: undefined,
    logoWidth: 384,
    logoThreshold: 160,
    receiptFooter: "Grazie per aver scelto GustoPOS",
  },
};

export type Ingredient = z.infer<typeof ingredientSchema>;
export type IngredientCreateRequest = z.infer<typeof ingredientCreateRequestSchema>;
export type IngredientUpdateRequest = z.infer<typeof ingredientUpdateRequestSchema>;
export type IngredientAdjustRequest = z.infer<typeof ingredientAdjustRequestSchema>;
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;
export type StockMovement = z.infer<typeof stockMovementSchema>;
export type StockMovementsQuery = z.infer<typeof stockMovementsQuerySchema>;
export type BomComponentType = z.infer<typeof bomComponentTypeSchema>;
export type CategoryScope = z.infer<typeof categoryScopeSchema>;
export type PrintArea = z.infer<typeof printAreaSchema>;
export type Category = z.infer<typeof categorySchema>;
export type CategoriesListResponse = z.infer<typeof categoriesListResponseSchema>;
export type CategoryCreateRequest = z.infer<typeof categoryCreateRequestSchema>;
export type CategoryUpdateRequest = z.infer<typeof categoryUpdateRequestSchema>;
export type CategoryModifierPool = z.infer<typeof categoryModifierPoolSchema>;
export type CategoryModifierPoolOption = z.infer<typeof categoryModifierPoolOptionSchema>;
export type CategoryModifierPoolCreateRequest = z.infer<typeof categoryModifierPoolCreateRequestSchema>;
export type CategoryModifierPoolUpdateRequest = z.infer<typeof categoryModifierPoolUpdateRequestSchema>;
export type BomComponent = z.infer<typeof bomComponentSchema>;
export type BomItem = z.infer<typeof bomItemSchema>;
export type BomListResponse = z.infer<typeof bomListResponseSchema>;
export type MenuItemModifier = z.infer<typeof menuItemModifierSchema>;
export type MenuItem = z.infer<typeof menuItemSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Staff = z.infer<typeof staffSchema>;
export type StaffAdmin = z.infer<typeof staffAdminSchema>;
export type ModuleKey = z.infer<typeof moduleKeySchema>;
export type Tenant = z.infer<typeof tenantSchema>;
export type TenantModule = z.infer<typeof tenantModuleSchema>;
export type TenantModuleConfig = z.infer<typeof tenantModuleConfigSchema>;
export type TenantCreateRequest = z.infer<typeof tenantCreateRequestSchema>;
export type TenantUpdateRequest = z.infer<typeof tenantUpdateRequestSchema>;
export type TenantModuleToggleRequest = z.infer<typeof tenantModuleToggleRequestSchema>;
export type TenantModuleConfigUpsertRequest = z.infer<typeof tenantModuleConfigUpsertRequestSchema>;
export type PublicMenuResponse = z.infer<typeof publicMenuResponseSchema>;
export type PublicTakeawayCreateRequest = z.infer<typeof publicTakeawayCreateRequestSchema>;
export type PublicTakeawayCreateResponse = z.infer<typeof publicTakeawayCreateResponseSchema>;
export type PublicTakeawayTrackingResponse = z.infer<typeof publicTakeawayTrackingResponseSchema>;
export type GroupOrderSessionStatus = z.infer<typeof groupOrderSessionStatusSchema>;
export type GroupOrderParticipantRole = z.infer<typeof groupOrderParticipantRoleSchema>;
export type GroupOrderCartItem = z.infer<typeof groupOrderCartItemSchema>;
export type GroupOrderParticipant = z.infer<typeof groupOrderParticipantSchema>;
export type GroupOrderSession = z.infer<typeof groupOrderSessionSchema>;
export type GroupOrderCreateSessionRequest = z.infer<typeof groupOrderCreateSessionRequestSchema>;
export type GroupOrderCreateSessionResponse = z.infer<typeof groupOrderCreateSessionResponseSchema>;
export type GroupOrderJoinSessionRequest = z.infer<typeof groupOrderJoinSessionRequestSchema>;
export type GroupOrderJoinSessionResponse = z.infer<typeof groupOrderJoinSessionResponseSchema>;
export type GroupOrderPatchCartRequest = z.infer<typeof groupOrderPatchCartRequestSchema>;
export type GroupOrderPatchCartResponse = z.infer<typeof groupOrderPatchCartResponseSchema>;
export type GroupOrderSubmitRequest = z.infer<typeof groupOrderSubmitRequestSchema>;
export type GroupOrderSubmitResponse = z.infer<typeof groupOrderSubmitResponseSchema>;
export type GroupOrderRealtimeJoined = z.infer<typeof groupOrderRealtimeJoinedSchema>;
export type GroupOrderRealtimeCartUpdated = z.infer<typeof groupOrderRealtimeCartUpdatedSchema>;
export type GroupOrderRealtimeMasterChanged = z.infer<typeof groupOrderRealtimeMasterChangedSchema>;
export type GroupOrderRealtimeSubmitted = z.infer<typeof groupOrderRealtimeSubmittedSchema>;
export type PublicFunnelEventRequest = z.infer<typeof publicFunnelEventRequestSchema>;
export type PublicFunnelEventResponse = z.infer<typeof publicFunnelEventResponseSchema>;
export type SelfOrderSession = z.infer<typeof selfOrderSessionSchema>;
export type SelfOrderResolveResponse = z.infer<typeof selfOrderResolveResponseSchema>;
export type SelfOrderCreateRequest = z.infer<typeof selfOrderCreateRequestSchema>;
export type SelfOrderCreateResponse = z.infer<typeof selfOrderCreateResponseSchema>;
export type SelfOrderSessionRotateResponse = z.infer<typeof selfOrderSessionRotateResponseSchema>;
export type SuperadminLoginRequest = z.infer<typeof superadminLoginRequestSchema>;
export type SuperadminUser = z.infer<typeof superadminUserSchema>;
export type SuperadminAuthResponse = z.infer<typeof superadminAuthResponseSchema>;
export type SuperadminRefreshRequest = z.infer<typeof superadminRefreshRequestSchema>;
export type Table = z.infer<typeof tableSchema>;
export type TableCreateRequest = z.infer<typeof tableCreateRequestSchema>;
export type TableUpdateRequest = z.infer<typeof tableUpdateRequestSchema>;
export type TableBulkCreateRequest = z.infer<typeof tableBulkCreateRequestSchema>;
export type OrderType = z.infer<typeof orderTypeSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type AppData = z.infer<typeof appDataSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type ConsumerUser = z.infer<typeof consumerUserSchema>;
export type ConsumerRegisterRequest = z.infer<typeof consumerRegisterRequestSchema>;
export type ConsumerLoginRequest = z.infer<typeof consumerLoginRequestSchema>;
export type ConsumerAuthResponse = z.infer<typeof consumerAuthResponseSchema>;
export type ConsumerRefreshRequest = z.infer<typeof consumerRefreshRequestSchema>;
export type ConsumerRefreshResponse = z.infer<typeof consumerRefreshResponseSchema>;
export type ConsumerAccountsConfig = z.infer<typeof consumerAccountsConfigSchema>;
export type ConsumerOrderHistoryResponse = z.infer<typeof consumerOrderHistoryResponseSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type StaffListResponse = z.infer<typeof staffListResponseSchema>;
export type StaffAdminListResponse = z.infer<typeof staffAdminListResponseSchema>;
export type StaffCreateRequest = z.infer<typeof staffCreateRequestSchema>;
export type StaffUpdateRequest = z.infer<typeof staffUpdateRequestSchema>;
export type StaffResetPinRequest = z.infer<typeof staffResetPinRequestSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type CustomerListResponse = z.infer<typeof customerListResponseSchema>;
export type CustomerCreateRequest = z.infer<typeof customerCreateRequestSchema>;
export type CustomerUpdateRequest = z.infer<typeof customerUpdateRequestSchema>;
export type CustomerAddress = z.infer<typeof customerSchema>['addresses'] extends (infer T)[] | undefined ? T : never;
export type CustomerAddressCreateRequest = z.infer<typeof customerAddressCreateRequestSchema>;
export type CustomerAddressUpdateRequest = z.infer<typeof customerAddressUpdateRequestSchema>;
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;
export type Reservation = z.infer<typeof reservationSchema>;
export type ReservationListResponse = z.infer<typeof reservationListResponseSchema>;
export type ReservationCreateRequest = z.infer<typeof reservationCreateRequestSchema>;
export type ReservationUpdateRequest = z.infer<typeof reservationUpdateRequestSchema>;
export type ReservationNoShowRequest = z.infer<typeof reservationNoShowRequestSchema>;
export type ReservationsQuery = z.infer<typeof reservationsQuerySchema>;
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;
export type DeliveryOrder = z.infer<typeof deliveryOrderSchema>;
export type DeliveryOrdersListResponse = z.infer<typeof deliveryOrdersListResponseSchema>;
export type DeliveryUpsertRequest = z.infer<typeof deliveryUpsertRequestSchema>;
export type DeliveryStatusUpdateRequest = z.infer<typeof deliveryStatusUpdateRequestSchema>;
export type DeliveryOrdersQuery = z.infer<typeof deliveryOrdersQuerySchema>;
export type CustomersQuery = z.infer<typeof customersQuerySchema>;
export type OrderHistoryFilters = z.infer<typeof orderHistoryFiltersSchema>;
export type OrderHistoryListResponse = z.infer<typeof orderHistoryListResponseSchema>;
export type CustomerAnalytics = z.infer<typeof customerAnalyticsSchema>;
export type CustomerAnalyticsRequest = z.infer<typeof customerAnalyticsRequestSchema>;
export type OperationalSummaryQuery = z.infer<typeof operationalSummaryQuerySchema>;
export type ReservationsSummary = z.infer<typeof reservationsSummarySchema>;
export type DeliverySummary = z.infer<typeof deliverySummarySchema>;
export type Supplier = z.infer<typeof supplierSchema>;
export type SupplierCreateRequest = z.infer<typeof supplierCreateRequestSchema>;
export type SupplierUpdateRequest = z.infer<typeof supplierUpdateRequestSchema>;
export type SuppliersQuery = z.infer<typeof suppliersQuerySchema>;
export type SupplierIngredient = z.infer<typeof supplierIngredientSchema>;
export type SupplierIngredientCreate = z.infer<typeof supplierIngredientCreateSchema>;
export type SupplierIngredientUpdate = z.infer<typeof supplierIngredientUpdateSchema>;
export type SupplierPoItem = z.infer<typeof supplierPoItemSchema>;
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>;
export type PurchaseOrderItem = z.infer<typeof purchaseOrderItemSchema>;
export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;
export type PurchaseOrderCreateRequest = z.infer<typeof purchaseOrderCreateRequestSchema>;
export type PurchaseOrderStatusUpdateRequest = z.infer<typeof purchaseOrderStatusUpdateRequestSchema>;
export type PurchaseOrdersQuery = z.infer<typeof purchaseOrdersQuerySchema>;
export type GoodsReceiptItem = z.infer<typeof goodsReceiptItemSchema>;
export type GoodsReceipt = z.infer<typeof goodsReceiptSchema>;
export type GoodsReceiptCreateRequest = z.infer<typeof goodsReceiptCreateRequestSchema>;
export type ShiftStatus = z.infer<typeof shiftStatusSchema>;
export type TimeEntryStatus = z.infer<typeof timeEntryStatusSchema>;
export type TimeEntrySource = z.infer<typeof timeEntrySourceSchema>;
export type Shift = z.infer<typeof shiftSchema>;
export type ShiftCreateRequest = z.infer<typeof shiftCreateRequestSchema>;
export type ShiftUpdateRequest = z.infer<typeof shiftUpdateRequestSchema>;
export type ShiftsQuery = z.infer<typeof shiftsQuerySchema>;
export type TimeEntry = z.infer<typeof timeEntrySchema>;
export type ClockInRequest = z.infer<typeof clockInRequestSchema>;
export type ClockOutRequest = z.infer<typeof clockOutRequestSchema>;
export type TimeReportQuery = z.infer<typeof timeReportQuerySchema>;
export type TimeReportEntry = z.infer<typeof timeReportEntrySchema>;
export type TimeReportResponse = z.infer<typeof timeReportResponseSchema>;
export type FiscalClosure = z.infer<typeof fiscalClosureSchema>;
export type FiscalCloseRequest = z.infer<typeof fiscalCloseRequestSchema>;
export type FiscalExportStatus = z.infer<typeof fiscalExportStatusSchema>;
export type FiscalExportFormat = z.infer<typeof fiscalExportFormatSchema>;
export type FiscalExport = z.infer<typeof fiscalExportSchema>;
export type FiscalExportCreateRequest = z.infer<typeof fiscalExportCreateRequestSchema>;
export type FiscalExportsQuery = z.infer<typeof fiscalExportsQuerySchema>;
export type BomCreateRequest = z.infer<typeof bomCreateRequestSchema>;
export type BomUpdateRequest = z.infer<typeof bomUpdateRequestSchema>;
export type BomUpsertComponentsRequest = z.infer<typeof bomUpsertComponentsRequestSchema>;
export type MenuRecipeComponent = z.infer<typeof menuRecipeComponentSchema>;
export type ModifierOption = z.infer<typeof modifierOptionSchema>;
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;
export type ModifierOptionInput = z.infer<typeof modifierOptionInputSchema>;
export type ModifierGroupInput = z.infer<typeof modifierGroupInputSchema>;
export type MenuItemAdmin = z.infer<typeof menuItemAdminSchema>;
export type MenuItemAdminListResponse = z.infer<typeof menuItemAdminListResponseSchema>;
export type MenuItemCreateRequest = z.infer<typeof menuItemCreateRequestSchema>;
export type MenuItemUpdateRequest = z.infer<typeof menuItemUpdateRequestSchema>;
export type MenuItemReplaceRecipeRequest = z.infer<typeof menuItemReplaceRecipeRequestSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderRequestSchema>;
export type VoidOrderRequest = z.infer<typeof voidOrderRequestSchema>;
export type VoidOrderResponse = z.infer<typeof voidOrderResponseSchema>;
export type PayTableResponse = z.infer<typeof payTableResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentKind = z.infer<typeof paymentKindSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type CloseTableRequest = z.infer<typeof closeTableRequestSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type CloseTableResponse = z.infer<typeof closeTableResponseSchema>;
export type SplitBillRequest = z.infer<typeof splitBillRequestSchema>;
export type SplitBillResponse = z.infer<typeof splitBillResponseSchema>;
export type PaySelectedItemsRequest = z.infer<typeof paySelectedItemsRequestSchema>;
export type PaySelectedItemsResponse = z.infer<typeof paySelectedItemsResponseSchema>;
export type MarkShareAsPaidRequest = z.infer<typeof markShareAsPaidRequestSchema>;
export type MarkShareAsPaidResponse = z.infer<typeof markShareAsPaidResponseSchema>;
export type TransferTableRequest = z.infer<typeof transferTableRequestSchema>;
export type TransferTableResponse = z.infer<typeof transferTableResponseSchema>;
export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;
export type PaymentsListResponse = z.infer<typeof paymentsListResponseSchema>;
export type RefundPaymentRequest = z.infer<typeof refundPaymentRequestSchema>;
export type RefundPaymentResponse = z.infer<typeof refundPaymentResponseSchema>;
export type PrintJob = z.infer<typeof printJobSchema>;
export type PrintJobsListResponse = z.infer<typeof printJobsListResponseSchema>;
export type PrintJobsQuery = z.infer<typeof printJobsQuerySchema>;
export type PrintBridgeStatus = z.infer<typeof printBridgeStatusSchema>;
export type PrintBridgePrinter = z.infer<typeof printBridgePrinterSchema>;
export type PrintBridge = z.infer<typeof printBridgeSchema>;
export type PrintBridgePrinterMapping = z.infer<typeof printBridgePrinterMappingSchema>;
export type PrintBridgeUpdateMappingsRequest = z.infer<typeof printBridgeUpdateMappingsRequestSchema>;
export type PrintBridgeUpdateClaimedAreasRequest = z.infer<typeof printBridgeUpdateClaimedAreasRequestSchema>;
export type PrintBridgeTestPrintRequest = z.infer<typeof printBridgeTestPrintRequestSchema>;
export type PrintBridgeTestPrintResponse = z.infer<typeof printBridgeTestPrintResponseSchema>;
export type PrintBridgeListResponse = z.infer<typeof printBridgeListResponseSchema>;
export type PrintBridgeHeartbeatRequest = z.infer<typeof printBridgeHeartbeatRequestSchema>;
export type PrintBridgeHeartbeatResponse = z.infer<typeof printBridgeHeartbeatResponseSchema>;
export type PrintBridgeClaimRequest = z.infer<typeof printBridgeClaimRequestSchema>;
export type PrintBridgeClaimResponse = z.infer<typeof printBridgeClaimResponseSchema>;
export type PrintBridgeJobCompleteRequest = z.infer<typeof printBridgeJobCompleteRequestSchema>;
export type PrintBridgeJobFailRequest = z.infer<typeof printBridgeJobFailRequestSchema>;
export type PrintBridgeOnboardingSecret = z.infer<typeof printBridgeOnboardingSecretSchema>;
export type PrintBridgeOnboardingSecretCreateRequest = z.infer<typeof printBridgeOnboardingSecretCreateRequestSchema>;
export type PrintBridgeOnboardingSecretCreateResponse = z.infer<typeof printBridgeOnboardingSecretCreateResponseSchema>;
export type PrintBridgeOnboardingSecretsListResponse = z.infer<typeof printBridgeOnboardingSecretsListResponseSchema>;
export type DispatchPrintJobRequest = z.infer<typeof dispatchPrintJobRequestSchema>;
export type ConfirmPrintJobRequest = z.infer<typeof confirmPrintJobRequestSchema>;
export type RetryPrintJobRequest = z.infer<typeof retryPrintJobRequestSchema>;
export type UiTheme = z.infer<typeof uiThemeSchema>;
export type UiSettings = z.infer<typeof uiSettingsSchema>;
export type UpdateUiSettingsRequest = z.infer<typeof updateUiSettingsRequestSchema>;
export type UpdatePrintingSettingsRequest = z.infer<typeof updatePrintingSettingsRequestSchema>;
export type LoyaltyBalance = z.infer<typeof loyaltyBalanceSchema>;
export type LoyaltyTransaction = z.infer<typeof loyaltyTransactionSchema>;
export type LoyaltyTransactionsList = z.infer<typeof loyaltyTransactionsListSchema>;
export type LoyaltyRedeemRequest = z.infer<typeof loyaltyRedeemRequestSchema>;
export type LoyaltyEarnRequest = z.infer<typeof loyaltyEarnRequestSchema>;

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

export type Coupon = z.infer<typeof couponSchema>;
export type CouponCreateRequest = z.infer<typeof couponCreateRequestSchema>;
export type CouponUpdateRequest = z.infer<typeof couponUpdateRequestSchema>;
export type CouponValidateRequest = z.infer<typeof couponValidateRequestSchema>;
export type CouponValidateResponse = z.infer<typeof couponValidateResponseSchema>;
export type BomAddComponentRequest = z.infer<typeof bomAddComponentRequestSchema>;
export type BomRemoveComponentRequest = z.infer<typeof bomRemoveComponentRequestSchema>;
export type MenuItemAddRecipeComponentRequest = z.infer<typeof menuItemAddRecipeComponentRequestSchema>;
export type MenuItemRemoveRecipeComponentRequest = z.infer<typeof menuItemRemoveRecipeComponentRequestSchema>;

// ─── Cart Item (POS client-side) ───────────────────────────────────────
export const cartItemSchema = z.object({
  cartItemId: z.string(),
  menuItemId: z.string(),
  name: z.string(),
  basePrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
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

export type FoodCostMatrixRow = z.infer<typeof foodCostMatrixRowSchema>;

export const foodCostMatrixCellSchema = z.object({
  menuItemId: z.string(),
  ingredientId: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
});

export type FoodCostMatrixCell = z.infer<typeof foodCostMatrixCellSchema>;

export const foodCostMatrixUpdateSchema = z.object({
  menuItemId: z.string().min(1),
  ingredientId: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
});

export type FoodCostMatrixUpdate = z.infer<typeof foodCostMatrixUpdateSchema>;

export const foodCostMatrixImportRowSchema = z.object({
  ingredientName: z.string(),
  menuItemName: z.string(),
  quantity: z.number().nonnegative(),
  unit: z.string(),
});

export type FoodCostMatrixImportRow = z.infer<typeof foodCostMatrixImportRowSchema>;

export const foodCostMatrixImportSchema = z.object({
  rows: z.array(foodCostMatrixImportRowSchema),
});

export type FoodCostMatrixImport = z.infer<typeof foodCostMatrixImportSchema>;

export const ingredientCostImportSchema = z.object({
  name: z.string(),
  costPerKg: z.number().nonnegative().default(0),
  costPerPiece: z.number().nonnegative().default(0),
  gramsPerPortion: z.number().nonnegative().default(0),
  piecesPerPortion: z.number().nonnegative().default(0),
});

export type IngredientCostImport = z.infer<typeof ingredientCostImportSchema>;

export const foodCostFullImportSchema = z.object({
  ingredientCosts: z.array(ingredientCostImportSchema).default([]),
  recipeRows: z.array(foodCostMatrixImportRowSchema).default([]),
});

export type FoodCostFullImport = z.infer<typeof foodCostFullImportSchema>;

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

export type FoodCostAnalysis = z.infer<typeof foodCostAnalysisSchema>;
