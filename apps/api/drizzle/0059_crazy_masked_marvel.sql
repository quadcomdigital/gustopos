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
);
--> statement-breakpoint
ALTER TABLE "fiscal_exports" ADD COLUMN IF NOT EXISTS "csv_content" text;--> statement-breakpoint
ALTER TABLE "print_bridge_onboarding_secrets" ADD COLUMN IF NOT EXISTS "short_code_hash" text;--> statement-breakpoint
ALTER TABLE "print_bridge_onboarding_secrets" ADD COLUMN IF NOT EXISTS "short_code_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fiscal_closures_archive_tenant_date_idx" ON "fiscal_closures_archive" USING btree ("tenant_id","business_date");--> statement-breakpoint
DROP INDEX IF EXISTS "fiscal_closures_tenant_date_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "fiscal_closures_tenant_business_date_idx";--> statement-breakpoint
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
CREATE UNIQUE INDEX IF NOT EXISTS "print_bridge_onboarding_secrets_short_code_idx" ON "print_bridge_onboarding_secrets" USING btree ("short_code_hash") WHERE "print_bridge_onboarding_secrets"."short_code_hash" IS NOT NULL;