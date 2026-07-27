CREATE TABLE "category_modifier_pool_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"pool_id" text NOT NULL,
	"category_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"payment_id" text NOT NULL,
	"order_item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" DROP CONSTRAINT "category_modifier_pool_options_inventory_item_id_inventory_id_fk";
--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ALTER COLUMN "inventory_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "category_modifier_pools" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD COLUMN "bom_id" text;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_categories" ADD CONSTRAINT "category_modifier_pool_categories_pool_id_category_modifier_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."category_modifier_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_categories" ADD CONSTRAINT "category_modifier_pool_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD CONSTRAINT "category_modifier_pool_options_inventory_item_id_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD CONSTRAINT "menu_item_modifier_options_bom_id_bom_items_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_items"("id") ON DELETE set null ON UPDATE no action;