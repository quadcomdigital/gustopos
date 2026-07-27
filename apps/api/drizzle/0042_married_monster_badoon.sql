CREATE TABLE "inventory_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"inventory_id" text NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_audit" ADD CONSTRAINT "inventory_audit_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_audit_tenant_idx" ON "inventory_audit" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_audit_item_idx" ON "inventory_audit" USING btree ("inventory_id");