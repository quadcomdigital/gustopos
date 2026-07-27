CREATE TABLE "inventory_unit_conversions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"inventory_id" text NOT NULL,
	"from_unit" text NOT NULL,
	"to_unit" text NOT NULL,
	"factor" numeric(12, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bom_items" ALTER COLUMN "stock_quantity" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory_unit_conversions" ADD CONSTRAINT "inventory_unit_conversions_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_unit_conversions_tenant_idx" ON "inventory_unit_conversions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_unit_conversions_inventory_idx" ON "inventory_unit_conversions" USING btree ("inventory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_unit_conversions_unique_idx" ON "inventory_unit_conversions" USING btree ("tenant_id","inventory_id","from_unit");