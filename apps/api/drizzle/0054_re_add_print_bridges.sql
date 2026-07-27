-- 0054_re_add_print_bridges.sql
--
-- Purpose:
--   PR-5 (commit 3773f61) shipped app.repository + app.controller code
--   that references print_bridges and print_bridge_onboarding_secrets,
--   but the original PR-5 strip mistakenly removed those pgTable
--   exports from apps/api/src/db/schema.ts. Drizzle will now happily
--   generate select/insert/update SQL, but for any database that
--   predates migration 0050/0052/0053 the underlying relations do not
--   exist. This migration is idempotent and safe on databases where
--   these relations and columns are already present.
--
-- Reverse compatibility:
--   - All statements use CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS /
--     ALTER TABLE ... ADD COLUMN IF NOT EXISTS, so this migration can be
--     re-run without error.
--   - All shapes match migrations 0050 (print_bridges) and 0052
--     (print_bridge_onboarding_secrets), plus the print_jobs bridge
--     claim-metadata columns introduced in 0050 and 0053.
--
-- Apply via:
--   npm run db:migrate --workspace @gustopos/api

-- ----- print_bridges (mirrors 0050_nice_colossus.sql) -----
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
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "print_bridges_tenant_idx" ON "print_bridges" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "print_bridges_status_idx" ON "print_bridges" USING btree ("status");
--> statement-breakpoint

-- ----- print_bridge_onboarding_secrets (mirrors 0052_red_magneto.sql) -----
CREATE TABLE IF NOT EXISTS "print_bridge_onboarding_secrets" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "secret_hash" text NOT NULL,
  "suggested_bridge_id" text NOT NULL,
  "bound_bridge_id" text,
  "last_used_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_by_staff_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "print_bridge_onboarding_secrets_tenant_idx"
  ON "print_bridge_onboarding_secrets"
  USING btree ("tenant_id", "revoked_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "print_bridge_onboarding_secrets_hash_unique_idx"
  ON "print_bridge_onboarding_secrets"
  USING btree ("secret_hash");
--> statement-breakpoint

-- ----- print_jobs bridge claiming metadata (mirrors 0050, 0053) -----
-- declared in 0053 (0053_browser_bridge_instance_id.sql). Re-add idempotently
-- in case a tenant's database snapshot predates either.
ALTER TABLE "print_jobs"
  ADD COLUMN IF NOT EXISTS "bridge_id" text REFERENCES "print_bridges"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "print_jobs"
  ADD COLUMN IF NOT EXISTS "claimed_by_instance_id" text;
--> statement-breakpoint
ALTER TABLE "print_jobs"
  ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;
