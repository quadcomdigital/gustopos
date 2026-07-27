CREATE TABLE IF NOT EXISTS "reservations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "table_id" text REFERENCES "tables"("id") ON DELETE set null,
  "customer_name" text NOT NULL,
  "customer_phone" text,
  "party_size" integer NOT NULL,
  "reserved_for" timestamp with time zone NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "notes" text,
  "source" text NOT NULL DEFAULT 'manual',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "delivery_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "order_id" text NOT NULL REFERENCES "orders"("id") ON DELETE cascade,
  "customer_address" text NOT NULL,
  "courier_name" text,
  "courier_phone" text,
  "eta" timestamp with time zone,
  "status" text NOT NULL DEFAULT 'new',
  "delivery_fee" numeric(12, 2) NOT NULL DEFAULT '0',
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "reservations_tenant_reserved_for_idx" ON "reservations" ("tenant_id", "reserved_for");
CREATE INDEX IF NOT EXISTS "reservations_tenant_status_idx" ON "reservations" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "delivery_orders_tenant_order_idx" ON "delivery_orders" ("tenant_id", "order_id");
CREATE INDEX IF NOT EXISTS "delivery_orders_tenant_status_idx" ON "delivery_orders" ("tenant_id", "status");

CREATE OR REPLACE FUNCTION apply_tenant_id_rls_delivery(table_name text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
  EXECUTE format(
    'CREATE POLICY tenant_isolation_policy ON %I USING (tenant_id = COALESCE(current_setting(''app.current_tenant_id'', true), tenant_id)) WITH CHECK (tenant_id = COALESCE(current_setting(''app.current_tenant_id'', true), tenant_id))',
    table_name
  );
END;
$$ LANGUAGE plpgsql;

SELECT apply_tenant_id_rls_delivery('reservations');
SELECT apply_tenant_id_rls_delivery('delivery_orders');

DROP FUNCTION apply_tenant_id_rls_delivery(text);

INSERT INTO "tenant_modules" ("id", "tenant_id", "module_key", "enabled", "created_at", "updated_at")
SELECT 'tm_' || md5(t.id || ':reservations'), t.id, 'reservations', 1, now(), now()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "tenant_modules" tm WHERE tm."tenant_id" = t.id AND tm."module_key" = 'reservations'
);

INSERT INTO "tenant_modules" ("id", "tenant_id", "module_key", "enabled", "created_at", "updated_at")
SELECT 'tm_' || md5(t.id || ':delivery'), t.id, 'delivery', 1, now(), now()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "tenant_modules" tm WHERE tm."tenant_id" = t.id AND tm."module_key" = 'delivery'
);
