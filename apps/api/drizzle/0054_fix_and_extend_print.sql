-- 0054_fix_and_extend_print.sql
-- Reconciliation + short-code onboarding columns for print-bridge scaffold.
-- Each statement is IF NOT EXISTS-guarded so this file is safe to re-run.

-- 1. print_bridges main table
CREATE TABLE IF NOT EXISTS "print_bridges" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "name" text NOT NULL,
  "host" text,
  "version" text,
  "status" text NOT NULL DEFAULT 'active',
  "areas" text NOT NULL DEFAULT '[]',
  "printers" text NOT NULL DEFAULT '[]',
  "mappings" text NOT NULL DEFAULT '[]',
  "claimed_areas" text NOT NULL DEFAULT '[]',
  "last_heartbeat_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "print_bridges_tenant_idx" ON "print_bridges" ("tenant_id");
CREATE INDEX IF NOT EXISTS "print_bridges_status_idx" ON "print_bridges" ("status");
--> statement-breakpoint

-- 2. print_bridge_onboarding_secrets table + 6-digit short-code columns
CREATE TABLE IF NOT EXISTS "print_bridge_onboarding_secrets" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "secret_hash" text NOT NULL,
  "suggested_bridge_id" text NOT NULL,
  "bound_bridge_id" text,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_by_staff_id" text,
  "short_code_hash" text,
  "short_code_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
-- Ensure the short-code columns exist as ALTER (CREATE TABLE IF NOT EXISTS is a no-op
-- when the table is already present on prod, so the columns may be missing there too).
-- Idempotent via IF NOT EXISTS — safe to re-run.
ALTER TABLE "print_bridge_onboarding_secrets"
  ADD COLUMN IF NOT EXISTS "short_code_hash" text;
ALTER TABLE "print_bridge_onboarding_secrets"
  ADD COLUMN IF NOT EXISTS "short_code_expires_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "print_bridge_onboarding_secrets_tenant_idx"
  ON "print_bridge_onboarding_secrets" ("tenant_id", "revoked_at");
CREATE UNIQUE INDEX IF NOT EXISTS "print_bridge_onboarding_secrets_hash_unique_idx"
  ON "print_bridge_onboarding_secrets" ("secret_hash");
-- Partial index lets verifyBridgeOrOnboardingSecret lookup short codes without scanning null rows.
CREATE UNIQUE INDEX IF NOT EXISTS "print_bridge_onboarding_secrets_short_code_idx"
  ON "print_bridge_onboarding_secrets" ("short_code_hash")
  WHERE "short_code_hash" IS NOT NULL;
--> statement-breakpoint

-- 3. prep_items
CREATE TABLE IF NOT EXISTS "prep_items" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "ingredient_id" text NOT NULL,
  "name" text NOT NULL,
  "quantity_per_unit" numeric(12, 3) NOT NULL,
  "unit" text NOT NULL,
  "stock_quantity" numeric(12, 3) NOT NULL DEFAULT '0',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "prep_items_tenant_idx" ON "prep_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "prep_items_ingredient_idx" ON "prep_items" ("ingredient_id");
--> statement-breakpoint

-- 4. inventory_unit_conversions
CREATE TABLE IF NOT EXISTS "inventory_unit_conversions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "inventory_id" text NOT NULL,
  "from_unit" text NOT NULL,
  "to_unit" text NOT NULL,
  "factor" numeric(12, 6) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "inventory_unit_conversions_tenant_idx"
  ON "inventory_unit_conversions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "inventory_unit_conversions_inventory_idx"
  ON "inventory_unit_conversions" ("inventory_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_unit_conversions_unique_idx"
  ON "inventory_unit_conversions" ("tenant_id", "inventory_id", "from_unit");
--> statement-breakpoint

-- 5. menu_item_prep_requirements (composite PK)
CREATE TABLE IF NOT EXISTS "menu_item_prep_requirements" (
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "menu_item_id" text NOT NULL,
  "prep_item_id" text NOT NULL,
  "quantity" numeric(12, 3) NOT NULL DEFAULT '1',
  PRIMARY KEY ("menu_item_id", "prep_item_id")
);
CREATE INDEX IF NOT EXISTS "menu_item_prep_requirements_tenant_idx"
  ON "menu_item_prep_requirements" ("tenant_id");
--> statement-breakpoint

-- 6. Add missing nullable FK on stock_movements (prepItemId column).
--    Constraint name follows Drizzle's auto-generated pattern: <table>_<col>_<reftable>_<refcol>_fk
--    so future drizzle-kit generate won't re-emit a duplicate with a different name.
ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "prep_item_id" text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_prep_item_id_prep_items_id_fk'
  ) THEN
    ALTER TABLE "stock_movements"
      ADD CONSTRAINT "stock_movements_prep_item_id_prep_items_id_fk"
      FOREIGN KEY ("prep_item_id") REFERENCES "prep_items"("id")
      ON DELETE CASCADE;
  END IF;
END
$$;
--> statement-breakpoint
