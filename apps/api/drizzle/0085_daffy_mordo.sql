DROP INDEX "tables_tenant_number_idx";--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "is_active" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tables_tenant_number_idx" ON "tables" USING btree ("tenant_id","number") WHERE "tables"."is_active" = 1;