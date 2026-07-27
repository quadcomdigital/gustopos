import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const staff = pgTable("staff", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  name: text("name").notNull(),
  role: text("role").notNull(),
  pin: text("pin").notNull(),
  customPermissions: jsonb("custom_permissions").notNull().default([]),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tables = pgTable(
  "tables",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    number: text("number").notNull(),
    status: text("status").notNull(),
    currentOrderId: text("current_order_id"),
  },
  (table) => ({
    numberIdx: uniqueIndex("tables_tenant_number_idx").on(table.tenantId, table.number),
  }),
);

export const inventory = pgTable(
  "inventory",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    name: text("name").notNull(),
    sku: text("sku"),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit: text("unit").notNull(),
    minThreshold: numeric("min_threshold", { precision: 12, scale: 3 }).notNull(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    unitCost: numeric("unit_cost", { precision: 12, scale: 3 }).notNull().default("0"),
    salePrice: numeric("sale_price", { precision: 12, scale: 3 }),
    isActive: integer("is_active").notNull().default(1),
    isContainer: integer("is_container").notNull().default(0),
  },
  (t) => [
    index("inventory_tenant_idx").on(t.tenantId),
    index("inventory_category_idx").on(t.categoryId),
    uniqueIndex("inventory_tenant_name_idx").on(t.tenantId, t.name),
  ],
);

export const menuItems = pgTable("menu_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  name: text("name").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull(),
  categoryId: text("category_id"),
  printAreas: text("print_areas").notNull().default('["kitchen"]'),
  isActive: integer("is_active").notNull().default(1),
  defaultContainerId: text("default_container_id"),
});

export const menuItemIngredients = pgTable(
  "menu_item_ingredients",
  {
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => inventory.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
    unit: text("unit").notNull().default("pz"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.menuItemId, table.ingredientId] }),
  }),
);

export const menuItemBomRequirements = pgTable(
  "menu_item_bom_requirements",
  {
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    bomId: text("bom_id")
      .notNull()
      .references(() => bomItems.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unit: text("unit").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.menuItemId, table.bomId] }),
  }),
);

export const menuItemModifiers = pgTable("menu_item_modifiers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  menuItemId: text("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  inventoryItemId: text("inventory_item_id")
    .notNull()
    .references(() => inventory.id, { onDelete: "cascade" }),
  priceDelta: numeric("price_delta", { precision: 12, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniq: primaryKey({ columns: [table.menuItemId, table.inventoryItemId] }),
}));

export const menuModifierGroups = pgTable("menu_item_modifier_groups", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  menuItemId: text("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  required: integer("required").notNull().default(0),
  minSelections: integer("min_selections").notNull().default(0),
  maxSelections: integer("max_selections").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const menuModifierOptions = pgTable("menu_item_modifier_options", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  groupId: text("group_id")
    .notNull()
    .references(() => menuModifierGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  inventoryItemId: text("inventory_item_id").references(() => inventory.id, { onDelete: "set null" }),
  bomId: text("bom_id").references(() => bomItems.id, { onDelete: "set null" }),
  priceDelta: numeric("price_delta", { precision: 12, scale: 2 }).notNull().default("0"),
  isDefault: integer("is_default").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const menuModifierOptionOverrides = pgTable("menu_item_modifier_option_overrides", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  optionId: text("option_id")
    .notNull()
    .references(() => menuModifierOptions.id, { onDelete: "cascade" }),
  ingredientId: text("ingredient_id").notNull(),
  action: text("action").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categoryModifierPools = pgTable("category_modifier_pools", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categoryModifierPoolOptions = pgTable("category_modifier_pool_options", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  poolId: text("pool_id")
    .notNull()
    .references(() => categoryModifierPools.id, { onDelete: "cascade" }),
  name: text("name"),
  inventoryItemId: text("inventory_item_id")
    .references(() => inventory.id, { onDelete: "set null" }),
  priceDelta: numeric("price_delta", { precision: 12, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categoryModifierPoolCategories = pgTable("category_modifier_pool_categories", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  poolId: text("pool_id")
    .notNull()
    .references(() => categoryModifierPools.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bomItems = pgTable("bom_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  yieldQuantity: numeric("yield_quantity", { precision: 12, scale: 3 }).notNull(),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  isActive: integer("is_active").notNull().default(1),
  isContainer: integer("is_container").notNull().default(0),
});

export const bomComponents = pgTable("bom_components", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  bomId: text("bom_id")
    .notNull()
    .references(() => bomItems.id, { onDelete: "cascade" }),
  componentType: text("component_type").notNull(),
  componentId: text("component_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  orderType: text("order_type").notNull().default("dine_in"),
  tableNumber: text("table_number"),
  ticketNumber: text("ticket_number"),
  customerName: text("customer_name"),
  customerId: text("customer_id"),
  customerPhone: text("customer_phone"),
  cancelReason: text("cancel_reason"),
  cancelledByStaffId: text("cancelled_by_staff_id"),
  pickupEta: timestamp("pickup_eta", { withTimezone: true }),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "restrict" }),
});

export const orderItems = pgTable("order_items", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: text("menu_item_id").notNull(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  ingredientOverrides: text("ingredient_overrides").notNull().default("[]"),
  notes: text("notes"),
  selectedModifiers: text("selected_modifiers").notNull().default("[]"),
});

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    refreshTokenHashIdx: uniqueIndex("auth_sessions_refresh_token_hash_idx").on(table.refreshTokenHash),
  }),
);

export const consumerUsers = pgTable("consumer_users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  fullName: text("full_name").notNull(),
  fullNameNormalized: text("full_name_normalized").notNull(),
  email: text("email"),
  emailNormalized: text("email_normalized"),
  phone: text("phone"),
  phoneNormalized: text("phone_normalized"),
  passwordHash: text("password_hash").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const consumerSessions = pgTable(
  "consumer_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    consumerUserId: text("consumer_user_id")
      .notNull()
      .references(() => consumerUsers.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    refreshTokenHashIdx: uniqueIndex("consumer_sessions_refresh_token_hash_idx").on(table.refreshTokenHash),
  }),
);

export const consumerOrderLinks = pgTable(
  "consumer_order_links",
  {
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    consumerUserId: text("consumer_user_id")
      .notNull()
      .references(() => consumerUsers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.orderId, table.consumerUserId] }),
  }),
);

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  tableId: text("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "restrict" }),
  tableNumber: text("table_number").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  surchargeAmount: numeric("surcharge_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  method: text("method").notNull(),
  kind: text("kind").notNull().default("sale"),
  paymentStatus: text("payment_status").notNull().default("captured"),
  paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull(),
  changeAmount: numeric("change_amount", { precision: 12, scale: 2 }).notNull(),
  reference: text("reference"),
  gatewayReference: text("gateway_reference"),
  capturedAt: timestamp("captured_at", { withTimezone: true }),
  refundedPaymentId: text("refunded_payment_id"),
  refundReason: text("refund_reason"),
  notes: text("notes"),
  shareIndex: integer("share_index"),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentItems = pgTable("payment_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  paymentId: text("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "cascade" }),
  orderItemId: integer("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentsRelations = relations(payments, ({ many }) => ({
  items: many(paymentItems),
}));

export const paymentItemsRelations = relations(paymentItems, ({ one }) => ({
  payment: one(payments, {
    fields: [paymentItems.paymentId],
    references: [payments.id],
  }),
  orderItem: one(orderItems, {
    fields: [paymentItems.orderItemId],
    references: [orderItems.id],
  }),
}));

export const appSettings = pgTable(
  "app_settings",
  {
    key: text("key").notNull(),
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.key] }),
  }),
);

export const printJobs = pgTable("print_jobs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  orderId: text("order_id").notNull(),
  area: text("area").notNull(),
  protocol: text("protocol").notNull(),
  status: text("status").notNull(),
  payload: text("payload").notNull(),
  error: text("error"),
  bridgeId: text("bridge_id").references(() => printBridges.id, { onDelete: "set null" }),
  claimedByInstanceId: text("claimed_by_instance_id"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
});


export const customerAddresses = pgTable("customer_addresses", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  customerId: text("customer_id").notNull(),
  label: text("label"),
  address: text("address").notNull(),
  isDefault: integer("is_default").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  name: text("name").notNull(),
  scope: text("scope").notNull(),
  printAreas: text("print_areas").notNull().default('["kitchen"]'),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reservations = pgTable("reservations", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  tableId: text("table_id").references(() => tables.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  partySize: integer("party_size").notNull(),
  reservedFor: timestamp("reserved_for", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  noShowReason: text("no_show_reason"),
  notes: text("notes"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deliveryOrders = pgTable("delivery_orders", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerAddress: text("customer_address").notNull(),
  courierName: text("courier_name"),
  courierPhone: text("courier_phone"),
  eta: timestamp("eta", { withTimezone: true }),
  status: text("status").notNull().default("new"),
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  deliveryFee: numeric("delivery_fee", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  name: text("name").notNull(),
  vatNumber: text("vat_number"),
  phone: text("phone"),
  email: text("email"),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const supplierIngredients = pgTable(
  "supplier_ingredients",
  {
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => inventory.id, { onDelete: "cascade" }),
    brandName: text("brand_name"),
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 }),
    isPreferred: integer("is_preferred").notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.supplierId, table.ingredientId] }),
  }),
);

export const purchaseOrders = pgTable("purchase_orders", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  supplierId: text("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("draft"),
  expectedAt: timestamp("expected_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  purchaseOrderId: text("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  inventoryId: text("inventory_id").references(() => inventory.id, { onDelete: "set null" }),
  itemName: text("item_name").notNull(),
  unit: text("unit").notNull(),
  orderedQty: numeric("ordered_qty", { precision: 14, scale: 3 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const goodsReceipts = pgTable("goods_receipts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  purchaseOrderId: text("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  staffId: text("staff_id").references(() => staff.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const goodsReceiptItems = pgTable("goods_receipt_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  goodsReceiptId: text("goods_receipt_id")
    .notNull()
    .references(() => goodsReceipts.id, { onDelete: "cascade" }),
  purchaseOrderItemId: text("purchase_order_item_id")
    .notNull()
    .references(() => purchaseOrderItems.id, { onDelete: "cascade" }),
  receivedQty: numeric("received_qty", { precision: 14, scale: 3 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 3 }).notNull(),
});

export const staffShifts = pgTable("staff_shifts", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  shiftDate: date("shift_date").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  toleranceEarlyMin: integer("tolerance_early_min").notNull().default(15),
  toleranceLateMin: integer("tolerance_late_min").notNull().default(15),
  status: text("status").notNull().default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const timeEntries = pgTable("time_entries", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  staffId: text("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  shiftId: text("shift_id").references(() => staffShifts.id, { onDelete: "set null" }),
  clockInAt: timestamp("clock_in_at", { withTimezone: true }).notNull(),
  clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
  status: text("status").notNull().default("open"),
  source: text("source").notNull().default("web"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fiscalClosures = pgTable("fiscal_closures", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  businessDate: date("business_date").notNull(),
  closedByStaffId: text("closed_by_staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "restrict" }),
  totalsJson: text("totals_json").notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
});

export const fiscalExports = pgTable("fiscal_exports", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  businessDate: date("business_date").notNull(),
  format: text("format").notNull().default("csv"),
  status: text("status").notNull().default("pending"),
  path: text("path").notNull(),
  generatedByStaffId: text("generated_by_staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "restrict" }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  checksum: text("checksum"),
});

export const selfOrderSessions = pgTable("self_order_sessions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  tableId: text("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const publicTakeawayTrackingSessions = pgTable(
  "public_takeaway_tracking_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("public_takeaway_tracking_token_hash_idx").on(table.tokenHash),
  }),
);

export const groupOrderSessions = pgTable(
  "group_order_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    tenantSlug: text("tenant_slug").notNull(),
    joinCodeHash: text("join_code_hash").notNull(),
    status: text("status").notNull().default("open"),
    version: integer("version").notNull().default(0),
    masterParticipantId: text("master_participant_id").notNull(),
    submittedOrderId: text("submitted_order_id"),
    submitIdempotencyKeyHash: text("submit_idempotency_key_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    joinCodeHashIdx: uniqueIndex("group_order_sessions_join_code_hash_idx").on(table.joinCodeHash),
  }),
);

export const groupOrderParticipants = pgTable("group_order_participants", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  sessionId: text("session_id")
    .notNull()
    .references(() => groupOrderSessions.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("guest"),
  participantTokenHash: text("participant_token_hash").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
});

export const groupOrderCartItems = pgTable(
  "group_order_cart_items",
  {
    tenantId: text("tenant_id").notNull().default("tenant_legacy"),
    sessionId: text("session_id")
      .notNull()
      .references(() => groupOrderSessions.id, { onDelete: "cascade" }),
    menuItemId: text("menu_item_id").notNull(),
    name: text("name").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    quantity: integer("quantity").notNull(),
    category: text("category").notNull(),
    ingredientsJson: text("ingredients_json").notNull().default("[]"),
    updatedByParticipantId: text("updated_by_participant_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.sessionId, table.menuItemId] }),
  }),
);

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  subdomain: text("subdomain"),
  domain: text("domain"),
  isActive: integer("is_active").notNull().default(1),
  resolutionOrder: text("resolution_order").notNull().default("subdomain,slug,header,jwt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantModules = pgTable("tenant_modules", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(),
  enabled: integer("enabled").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantModuleConfigs = pgTable("tenant_module_configs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(),
  config: text("config").notNull().default("{}"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: text("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

export const tenantAuditLogs = pgTable("tenant_audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  actor: text("actor").notNull().default("system"),
  event: text("event").notNull(),
  payload: text("payload").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const superadminUsers = pgTable("superadmin_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const superadminSessions = pgTable("superadmin_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => superadminUsers.id, { onDelete: "cascade" }),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const loyaltyPoints = pgTable("loyalty_points", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  customerId: text("customer_id").notNull(),
  points: integer("points").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  totalRedeemed: integer("total_redeemed").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  customerId: text("customer_id").notNull(),
  type: text("type").notNull(),
  points: integer("points").notNull(),
  orderId: text("order_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  code: text("code").notNull(),
  type: text("type").notNull(),
  value: integer("value").notNull(),
  minOrderAmount: integer("min_order_amount").notNull().default(0),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  ingredientId: text("ingredient_id")
    .references(() => inventory.id, { onDelete: "cascade" }),
  prepItemId: text("prep_item_id")
    .references(() => prepItems.id, { onDelete: "cascade" }),
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  movementType: text("movement_type").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  previousQuantity: numeric("previous_quantity", { precision: 12, scale: 3 }).notNull(),
  newQuantity: numeric("new_quantity", { precision: 12, scale: 3 }).notNull(),
  notes: text("notes"),
  staffId: text("staff_id").references(() => staff.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryAudit = pgTable("inventory_audit", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  inventoryId: text("inventory_id").notNull().references(() => inventory.id, { onDelete: "cascade" }),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: text("changed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("inventory_audit_tenant_idx").on(t.tenantId),
  index("inventory_audit_item_idx").on(t.inventoryId),
]);

export const prepItems = pgTable("prep_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default("tenant_legacy"),
  ingredientId: text("ingredient_id")
    .notNull()
    .references(() => inventory.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantityPerUnit: numeric("quantity_per_unit", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  stockQuantity: numeric("stock_quantity", { precision: 12, scale: 3 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("prep_items_tenant_idx").on(t.tenantId),
  index("prep_items_ingredient_idx").on(t.ingredientId),
]);

