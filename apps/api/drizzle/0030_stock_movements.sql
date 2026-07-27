-- Add quantity and unit columns to menu_item_ingredients
ALTER TABLE "menu_item_ingredients" ADD COLUMN "quantity" numeric(12, 3) DEFAULT '1' NOT NULL;
ALTER TABLE "menu_item_ingredients" ADD COLUMN "unit" text DEFAULT 'pz' NOT NULL;

-- Create stock_movements table for audit trail
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"ingredient_id" text NOT NULL,
	"order_id" text,
	"movement_type" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"previous_quantity" numeric(12, 2) NOT NULL,
	"new_quantity" numeric(12, 2) NOT NULL,
	"notes" text,
	"staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredient_id_inventory_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
