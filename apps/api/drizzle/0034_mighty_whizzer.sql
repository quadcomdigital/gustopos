CREATE TABLE "supplier_ingredients" (
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"supplier_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"unit_cost" numeric(12, 4),
	"is_preferred" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "supplier_ingredients_tenant_id_supplier_id_ingredient_id_pk" PRIMARY KEY("tenant_id","supplier_id","ingredient_id")
);
--> statement-breakpoint
ALTER TABLE "supplier_ingredients" ADD CONSTRAINT "supplier_ingredients_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_ingredients" ADD CONSTRAINT "supplier_ingredients_ingredient_id_inventory_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;