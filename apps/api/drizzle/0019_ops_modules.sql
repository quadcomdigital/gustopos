CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "name" text NOT NULL,
  "vat_number" text,
  "phone" text,
  "email" text,
  "is_active" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "supplier_id" text NOT NULL REFERENCES "suppliers"("id") ON DELETE restrict,
  "status" text NOT NULL DEFAULT 'draft',
  "expected_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "purchase_order_id" text NOT NULL REFERENCES "purchase_orders"("id") ON DELETE cascade,
  "inventory_id" text REFERENCES "inventory"("id") ON DELETE set null,
  "item_name" text NOT NULL,
  "unit" text NOT NULL,
  "ordered_qty" numeric(14, 3) NOT NULL,
  "unit_cost" numeric(12, 3) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "goods_receipts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "purchase_order_id" text NOT NULL REFERENCES "purchase_orders"("id") ON DELETE cascade,
  "received_at" timestamp with time zone NOT NULL,
  "staff_id" text REFERENCES "staff"("id") ON DELETE set null,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "goods_receipt_items" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "goods_receipt_id" text NOT NULL REFERENCES "goods_receipts"("id") ON DELETE cascade,
  "purchase_order_item_id" text NOT NULL REFERENCES "purchase_order_items"("id") ON DELETE cascade,
  "received_qty" numeric(14, 3) NOT NULL,
  "unit_cost" numeric(12, 3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_shifts" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "staff_id" text NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "shift_date" date NOT NULL,
  "start_at" timestamp with time zone NOT NULL,
  "end_at" timestamp with time zone NOT NULL,
  "tolerance_early_min" integer NOT NULL DEFAULT 15,
  "tolerance_late_min" integer NOT NULL DEFAULT 15,
  "status" text NOT NULL DEFAULT 'scheduled',
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "time_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "staff_id" text NOT NULL REFERENCES "staff"("id") ON DELETE cascade,
  "shift_id" text REFERENCES "staff_shifts"("id") ON DELETE set null,
  "clock_in_at" timestamp with time zone NOT NULL,
  "clock_out_at" timestamp with time zone,
  "status" text NOT NULL DEFAULT 'open',
  "source" text NOT NULL DEFAULT 'web',
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "fiscal_closures" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "business_date" date NOT NULL,
  "closed_by_staff_id" text NOT NULL REFERENCES "staff"("id") ON DELETE restrict,
  "totals_json" text NOT NULL,
  "closed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "notes" text
);

CREATE TABLE IF NOT EXISTS "fiscal_exports" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "business_date" date NOT NULL,
  "format" text NOT NULL DEFAULT 'csv',
  "status" text NOT NULL DEFAULT 'pending',
  "path" text NOT NULL,
  "generated_by_staff_id" text NOT NULL REFERENCES "staff"("id") ON DELETE restrict,
  "generated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "checksum" text
);

CREATE INDEX IF NOT EXISTS "suppliers_tenant_idx" ON "suppliers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_status_idx" ON "purchase_orders" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_created_idx" ON "purchase_orders" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "purchase_order_items_tenant_po_idx" ON "purchase_order_items" ("tenant_id", "purchase_order_id");
CREATE INDEX IF NOT EXISTS "goods_receipts_tenant_po_idx" ON "goods_receipts" ("tenant_id", "purchase_order_id");
CREATE INDEX IF NOT EXISTS "goods_receipt_items_tenant_receipt_idx" ON "goods_receipt_items" ("tenant_id", "goods_receipt_id");
CREATE INDEX IF NOT EXISTS "staff_shifts_tenant_date_idx" ON "staff_shifts" ("tenant_id", "shift_date");
CREATE INDEX IF NOT EXISTS "staff_shifts_tenant_staff_idx" ON "staff_shifts" ("tenant_id", "staff_id");
CREATE INDEX IF NOT EXISTS "time_entries_tenant_staff_idx" ON "time_entries" ("tenant_id", "staff_id");
CREATE INDEX IF NOT EXISTS "time_entries_tenant_clockin_idx" ON "time_entries" ("tenant_id", "clock_in_at");
CREATE INDEX IF NOT EXISTS "fiscal_closures_tenant_date_idx" ON "fiscal_closures" ("tenant_id", "business_date");
CREATE INDEX IF NOT EXISTS "fiscal_exports_tenant_date_idx" ON "fiscal_exports" ("tenant_id", "business_date");

CREATE OR REPLACE FUNCTION apply_tenant_id_rls_ops(table_name text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
  EXECUTE format(
    'CREATE POLICY tenant_isolation_policy ON %I USING (tenant_id = COALESCE(current_setting(''app.current_tenant_id'', true), tenant_id)) WITH CHECK (tenant_id = COALESCE(current_setting(''app.current_tenant_id'', true), tenant_id))',
    table_name
  );
END;
$$ LANGUAGE plpgsql;

SELECT apply_tenant_id_rls_ops('suppliers');
SELECT apply_tenant_id_rls_ops('purchase_orders');
SELECT apply_tenant_id_rls_ops('purchase_order_items');
SELECT apply_tenant_id_rls_ops('goods_receipts');
SELECT apply_tenant_id_rls_ops('goods_receipt_items');
SELECT apply_tenant_id_rls_ops('staff_shifts');
SELECT apply_tenant_id_rls_ops('time_entries');
SELECT apply_tenant_id_rls_ops('fiscal_closures');
SELECT apply_tenant_id_rls_ops('fiscal_exports');

DROP FUNCTION apply_tenant_id_rls_ops(text);

INSERT INTO "tenant_modules" ("id", "tenant_id", "module_key", "enabled", "created_at", "updated_at")
SELECT 'tm_' || md5(t.id || ':purchasing_suppliers'), t.id, 'purchasing_suppliers', 1, now(), now()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "tenant_modules" tm WHERE tm."tenant_id" = t.id AND tm."module_key" = 'purchasing_suppliers'
);

INSERT INTO "tenant_modules" ("id", "tenant_id", "module_key", "enabled", "created_at", "updated_at")
SELECT 'tm_' || md5(t.id || ':staff_shifts_timeclock'), t.id, 'staff_shifts_timeclock', 1, now(), now()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "tenant_modules" tm WHERE tm."tenant_id" = t.id AND tm."module_key" = 'staff_shifts_timeclock'
);

INSERT INTO "tenant_modules" ("id", "tenant_id", "module_key", "enabled", "created_at", "updated_at")
SELECT 'tm_' || md5(t.id || ':fiscal_exports'), t.id, 'fiscal_exports', 1, now(), now()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "tenant_modules" tm WHERE tm."tenant_id" = t.id AND tm."module_key" = 'fiscal_exports'
);
