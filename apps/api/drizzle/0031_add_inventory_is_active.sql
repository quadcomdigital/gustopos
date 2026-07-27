CREATE TABLE "category_modifier_pool_options" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"pool_id" text NOT NULL,
	"inventory_item_id" text NOT NULL,
	"price_delta" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_modifier_pools" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"value" integer NOT NULL,
	"min_order_amount" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_points" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"customer_id" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"total_redeemed" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"customer_id" text NOT NULL,
	"type" text NOT NULL,
	"points" integer NOT NULL,
	"order_id" text,
	"notes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_modifiers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"menu_item_id" text NOT NULL,
	"inventory_item_id" text NOT NULL,
	"price_delta" numeric(12, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "menu_item_modifiers_menu_item_id_inventory_item_id_pk" PRIMARY KEY("menu_item_id","inventory_item_id")
);
--> statement-breakpoint
CREATE TABLE "menu_item_modifier_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"menu_item_id" text NOT NULL,
	"name" text NOT NULL,
	"required" integer DEFAULT 0 NOT NULL,
	"min_selections" integer DEFAULT 0 NOT NULL,
	"max_selections" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_modifier_option_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"option_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_modifier_options" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"inventory_item_id" text,
	"price_delta" numeric(12, 2) DEFAULT '0' NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
ALTER TABLE "inventory" ADD COLUMN "unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "sale_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "is_active" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD COLUMN "quantity" numeric(12, 3) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD COLUMN "unit" text DEFAULT 'pz' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "selected_modifiers" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "custom_permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD CONSTRAINT "category_modifier_pool_options_pool_id_category_modifier_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."category_modifier_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD CONSTRAINT "category_modifier_pool_options_inventory_item_id_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_modifier_pools" ADD CONSTRAINT "category_modifier_pools_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifiers" ADD CONSTRAINT "menu_item_modifiers_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifiers" ADD CONSTRAINT "menu_item_modifiers_inventory_item_id_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_option_overrides" ADD CONSTRAINT "menu_item_modifier_option_overrides_option_id_menu_item_modifier_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."menu_item_modifier_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD CONSTRAINT "menu_item_modifier_options_group_id_menu_item_modifier_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."menu_item_modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD CONSTRAINT "menu_item_modifier_options_inventory_item_id_inventory_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ingredient_id_inventory_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;