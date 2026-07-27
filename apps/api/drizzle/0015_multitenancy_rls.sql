CREATE TABLE "tenants" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "subdomain" text,
  "domain" text,
  "is_active" integer NOT NULL DEFAULT 1,
  "resolution_order" text NOT NULL DEFAULT 'subdomain,slug,header,jwt',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "tenant_modules" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "module_key" text NOT NULL,
  "enabled" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "tenant_module_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "module_key" text NOT NULL,
  "config" text NOT NULL DEFAULT '{}',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "roles" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "permissions" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "role_permissions" (
  "role_id" text NOT NULL REFERENCES "roles"("id") ON DELETE cascade,
  "permission_id" text NOT NULL REFERENCES "permissions"("id") ON DELETE cascade,
  PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE "tenant_audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text REFERENCES "tenants"("id") ON DELETE set null,
  "actor" text NOT NULL DEFAULT 'system',
  "event" text NOT NULL,
  "payload" text NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO "tenants" ("id", "slug", "name", "subdomain", "is_active", "resolution_order")
VALUES ('tenant_legacy', 'legacy', 'GustoPOS Legacy', 'legacy', 1, 'subdomain,slug,header,jwt')
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "menu_item_ingredients" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "menu_item_bom_requirements" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "bom_components" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "print_jobs" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "tenant_id" text NOT NULL DEFAULT 'tenant_legacy';

UPDATE "staff" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "tables" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "inventory" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "menu_items" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "menu_item_ingredients" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "menu_item_bom_requirements" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "bom_items" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "bom_components" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "orders" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "order_items" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "auth_sessions" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "payments" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "app_settings" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "print_jobs" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "customers" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;
UPDATE "categories" SET "tenant_id" = 'tenant_legacy' WHERE "tenant_id" IS NULL;

ALTER TABLE "staff" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "tables" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "inventory" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "menu_items" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "menu_item_ingredients" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "menu_item_bom_requirements" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "bom_items" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "bom_components" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "orders" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "order_items" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "auth_sessions" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "payments" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "app_settings" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "print_jobs" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "customers" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';
ALTER TABLE "categories" ALTER COLUMN "tenant_id" SET DEFAULT 'tenant_legacy';

ALTER TABLE "app_settings" DROP CONSTRAINT IF EXISTS "app_settings_pkey";
ALTER TABLE "app_settings" ADD PRIMARY KEY ("tenant_id", "key");

CREATE INDEX IF NOT EXISTS "staff_tenant_id_idx" ON "staff" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tables_tenant_id_idx" ON "tables" ("tenant_id");
CREATE INDEX IF NOT EXISTS "inventory_tenant_id_idx" ON "inventory" ("tenant_id");
CREATE INDEX IF NOT EXISTS "menu_items_tenant_id_idx" ON "menu_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "menu_item_ingredients_tenant_id_idx" ON "menu_item_ingredients" ("tenant_id");
CREATE INDEX IF NOT EXISTS "menu_item_bom_requirements_tenant_id_idx" ON "menu_item_bom_requirements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "bom_items_tenant_id_idx" ON "bom_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "bom_components_tenant_id_idx" ON "bom_components" ("tenant_id");
CREATE INDEX IF NOT EXISTS "orders_tenant_id_idx" ON "orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "order_items_tenant_id_idx" ON "order_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "auth_sessions_tenant_id_idx" ON "auth_sessions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "payments_tenant_id_idx" ON "payments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "app_settings_tenant_id_idx" ON "app_settings" ("tenant_id");
CREATE INDEX IF NOT EXISTS "print_jobs_tenant_id_idx" ON "print_jobs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "customers_tenant_id_idx" ON "customers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "categories_tenant_id_idx" ON "categories" ("tenant_id");

CREATE OR REPLACE FUNCTION apply_tenant_id_rls(table_name text) RETURNS void AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
  EXECUTE format(
    'CREATE POLICY tenant_isolation_policy ON %I USING (tenant_id = COALESCE(current_setting(''app.current_tenant_id'', true), tenant_id)) WITH CHECK (tenant_id = COALESCE(current_setting(''app.current_tenant_id'', true), tenant_id))',
    table_name
  );
END;
$$ LANGUAGE plpgsql;

SELECT apply_tenant_id_rls('staff');
SELECT apply_tenant_id_rls('tables');
SELECT apply_tenant_id_rls('inventory');
SELECT apply_tenant_id_rls('menu_items');
SELECT apply_tenant_id_rls('menu_item_ingredients');
SELECT apply_tenant_id_rls('menu_item_bom_requirements');
SELECT apply_tenant_id_rls('bom_items');
SELECT apply_tenant_id_rls('bom_components');
SELECT apply_tenant_id_rls('orders');
SELECT apply_tenant_id_rls('order_items');
SELECT apply_tenant_id_rls('auth_sessions');
SELECT apply_tenant_id_rls('payments');
SELECT apply_tenant_id_rls('app_settings');
SELECT apply_tenant_id_rls('print_jobs');
SELECT apply_tenant_id_rls('customers');
SELECT apply_tenant_id_rls('categories');

DROP FUNCTION apply_tenant_id_rls(text);

CREATE OR REPLACE FUNCTION tenant_config_audit_trigger() RETURNS trigger AS $$
BEGIN
  INSERT INTO tenant_audit_logs (id, tenant_id, actor, event, payload, created_at)
  VALUES (
    'tal_' || md5(random()::text || clock_timestamp()::text),
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    'system',
    TG_TABLE_NAME || '.' || lower(TG_OP),
    json_build_object('new', to_jsonb(NEW), 'old', to_jsonb(OLD))::text,
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_modules_audit_trg ON tenant_modules;
CREATE TRIGGER tenant_modules_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON tenant_modules
FOR EACH ROW EXECUTE FUNCTION tenant_config_audit_trigger();

DROP TRIGGER IF EXISTS tenant_module_configs_audit_trg ON tenant_module_configs;
CREATE TRIGGER tenant_module_configs_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON tenant_module_configs
FOR EACH ROW EXECUTE FUNCTION tenant_config_audit_trigger();

DROP TRIGGER IF EXISTS tenants_audit_trg ON tenants;
CREATE TRIGGER tenants_audit_trg
AFTER INSERT OR UPDATE OR DELETE ON tenants
FOR EACH ROW EXECUTE FUNCTION tenant_config_audit_trigger();
