CREATE TABLE "ghost_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"ghost_order_id" text NOT NULL,
	"cart_item_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"name" text NOT NULL,
	"base_price" numeric(12, 2) NOT NULL,
	"modifier_price_delta" numeric(12, 2) DEFAULT '0' NOT NULL,
	"quantity" integer NOT NULL,
	"round" integer,
	"notes" text,
	"ingredient_overrides" text DEFAULT '[]' NOT NULL,
	"selected_modifiers" text DEFAULT '[]' NOT NULL,
	"skip_kitchen_print" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ghost_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"context_key" text NOT NULL,
	"owner_staff_id" text NOT NULL,
	"order_type" text DEFAULT 'dine_in' NOT NULL,
	"table_id" text NOT NULL,
	"table_number" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"committed_order_id" text,
	"committed_at" timestamp with time zone,
	"committed_by_staff_id" text,
	"discarded_at" timestamp with time zone,
	"discarded_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ghost_order_items" ADD CONSTRAINT "ghost_order_items_ghost_order_id_ghost_orders_id_fk" FOREIGN KEY ("ghost_order_id") REFERENCES "public"."ghost_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_orders" ADD CONSTRAINT "ghost_orders_owner_staff_id_staff_id_fk" FOREIGN KEY ("owner_staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_orders" ADD CONSTRAINT "ghost_orders_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_orders" ADD CONSTRAINT "ghost_orders_committed_by_staff_id_staff_id_fk" FOREIGN KEY ("committed_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ghost_orders" ADD CONSTRAINT "ghost_orders_discarded_by_staff_id_staff_id_fk" FOREIGN KEY ("discarded_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ghost_order_items_tenant_draft_idx" ON "ghost_order_items" USING btree ("tenant_id","ghost_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ghost_orders_open_owner_table_idx" ON "ghost_orders" USING btree ("tenant_id","context_key","owner_staff_id") WHERE "ghost_orders"."status" = 'open';--> statement-breakpoint
CREATE INDEX "ghost_orders_tenant_status_idx" ON "ghost_orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "ghost_orders_tenant_table_idx" ON "ghost_orders" USING btree ("tenant_id","table_id");