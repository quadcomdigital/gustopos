CREATE UNIQUE INDEX "categories_tenant_name_scope_idx" ON "categories" USING btree ("tenant_id","name","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_users_tenant_email_idx" ON "consumer_users" USING btree ("tenant_id","email_normalized") WHERE "consumer_users"."email_normalized" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_users_tenant_phone_idx" ON "consumer_users" USING btree ("tenant_id","phone_normalized") WHERE "consumer_users"."phone_normalized" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_phone_idx" ON "customers" USING btree ("tenant_id","phone") WHERE "customers"."phone" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_name_idx" ON "customers" USING btree ("tenant_id","full_name_normalized");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fiscal_closures_archive" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "business_date" date NOT NULL,
  "closed_by_staff_id" text NOT NULL,
  "totals_json" text NOT NULL,
  "closed_at" timestamp with time zone NOT NULL,
  "notes" text,
  "archived_at" timestamp with time zone DEFAULT now() NOT NULL,
  "archive_reason" text DEFAULT 'duplicate_business_date' NOT NULL
);--> statement-breakpoint
DROP INDEX IF EXISTS "fiscal_closures_tenant_date_idx";--> statement-breakpoint
INSERT INTO "fiscal_closures_archive" ("id", "tenant_id", "business_date", "closed_by_staff_id", "totals_json", "closed_at", "notes", "archive_reason")
SELECT ranked."id", ranked."tenant_id", ranked."business_date", ranked."closed_by_staff_id", ranked."totals_json", ranked."closed_at", ranked."notes", 'duplicate_business_date'
FROM (
  SELECT fc.*, ROW_NUMBER() OVER (
    PARTITION BY fc."tenant_id", fc."business_date"
    ORDER BY fc."closed_at" DESC NULLS LAST, fc."id" DESC
  ) AS row_number
  FROM "fiscal_closures" fc
) ranked
WHERE ranked.row_number > 1
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
DELETE FROM "fiscal_closures" fc
USING (
  SELECT ranked."id"
  FROM (
    SELECT fc."id", ROW_NUMBER() OVER (
      PARTITION BY fc."tenant_id", fc."business_date"
      ORDER BY fc."closed_at" DESC NULLS LAST, fc."id" DESC
    ) AS row_number
    FROM "fiscal_closures" fc
  ) ranked
  WHERE ranked.row_number > 1
) duplicates
WHERE fc."id" = duplicates."id";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_closures_tenant_date_idx" ON "fiscal_closures" USING btree ("tenant_id","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_points_tenant_customer_idx" ON "loyalty_points" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_tenant_name_idx" ON "menu_items" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_key_idx" ON "roles" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_tenant_pin_idx" ON "staff" USING btree ("tenant_id","pin");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_module_configs_tenant_key_idx" ON "tenant_module_configs" USING btree ("tenant_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_modules_tenant_key_idx" ON "tenant_modules" USING btree ("tenant_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain") WHERE "tenants"."subdomain" IS NOT NULL;
