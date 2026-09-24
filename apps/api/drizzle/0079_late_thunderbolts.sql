CREATE TABLE "prep_production_impacts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"production_id" text NOT NULL,
	"component_type" text NOT NULL,
	"component_id" text NOT NULL,
	"quantity" numeric(14, 6) NOT NULL,
	"unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prep_production_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"prep_id" text NOT NULL,
	"quantity" numeric(14, 6) NOT NULL,
	"unit" text NOT NULL,
	"staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_bridge_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"bridge_id" text,
	"instance_id" text,
	"level" text NOT NULL,
	"component" text,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_stations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'production' NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"own_items_only" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_references" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_item_bom_requirements" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_item_modifiers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "menu_item_prep_requirements" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prep_item_components" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "menu_item_bom_requirements" CASCADE;--> statement-breakpoint
DROP TABLE "menu_item_ingredients" CASCADE;--> statement-breakpoint
DROP TABLE "menu_item_modifiers" CASCADE;--> statement-breakpoint
DROP TABLE "menu_item_prep_requirements" CASCADE;--> statement-breakpoint
DROP TABLE "prep_item_components" CASCADE;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" DROP CONSTRAINT "menu_item_modifier_options_bom_id_bom_items_id_fk";
--> statement-breakpoint
ALTER TABLE "prep_items" DROP CONSTRAINT "prep_items_ingredient_id_inventory_id_fk";
--> statement-breakpoint
ALTER TABLE "prep_items" DROP CONSTRAINT "prep_items_bom_id_bom_items_id_fk";
--> statement-breakpoint
DROP INDEX "order_stock_impacts_order_idx";--> statement-breakpoint
DROP INDEX "order_stock_impacts_item_idx";--> statement-breakpoint
DROP INDEX "prep_items_ingredient_idx";--> statement-breakpoint
DROP INDEX "prep_items_bom_idx";--> statement-breakpoint
ALTER TABLE "bom_components" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bom_components" ALTER COLUMN "quantity" SET DATA TYPE numeric(14, 6);--> statement-breakpoint
ALTER TABLE "bom_items" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bom_items" ALTER COLUMN "yield_quantity" SET DATA TYPE numeric(14, 6);--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "quantity" SET DATA TYPE numeric(14, 6);--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "min_threshold" SET DATA TYPE numeric(14, 6);--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "unit_cost" SET DATA TYPE numeric(14, 6);--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "unit_cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "sale_price" SET DATA TYPE numeric(14, 6);--> statement-breakpoint
ALTER TABLE "inventory_unit_conversions" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "inventory_unit_conversions" ALTER COLUMN "factor" SET DATA TYPE numeric(14, 8);--> statement-breakpoint
ALTER TABLE "menu_item_components" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "menu_item_components" ALTER COLUMN "quantity" SET DATA TYPE numeric(14, 6);--> statement-breakpoint
ALTER TABLE "menu_item_components" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "menu_item_components" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "menu_items" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "menu_items" ALTER COLUMN "price" SET DATA TYPE numeric(14, 2);--> statement-breakpoint
ALTER TABLE "order_stock_impacts" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "order_stock_impacts" ALTER COLUMN "quantity" SET DATA TYPE numeric(14, 6);--> statement-breakpoint
ALTER TABLE "order_stock_impacts" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_stock_impacts" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "prep_items" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "prep_items" ALTER COLUMN "stock_quantity" SET DATA TYPE numeric(14, 6);--> statement-breakpoint
ALTER TABLE "prep_items" ALTER COLUMN "stock_quantity" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "bom_components" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "output_unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "station_id" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "reference_id" text;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD COLUMN "reference_id" text;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD COLUMN "component_type" text DEFAULT 'ingredient' NOT NULL;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD COLUMN "component_id" text;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD COLUMN "quantity" numeric(14, 6) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD COLUMN "unit" text DEFAULT 'pz' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "is_stock_tracked" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item_components" ADD COLUMN "unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "station_id" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "reference_id" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "is_jolly" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_groups" ADD COLUMN "multi_select_price_mode" text DEFAULT 'max' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD COLUMN "reference_id" text;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD COLUMN "component_type" text DEFAULT 'ingredient' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD COLUMN "component_id" text;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD COLUMN "quantity" numeric(14, 6) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD COLUMN "unit" text DEFAULT 'pz' NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "round" integer;--> statement-breakpoint
ALTER TABLE "prep_items" ADD COLUMN "source_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_items" ADD COLUMN "source_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_items" ADD COLUMN "input_quantity" numeric(14, 6) NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_items" ADD COLUMN "input_unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_items" ADD COLUMN "output_quantity" numeric(14, 6) NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_items" ADD COLUMN "output_unit" text NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_items" ADD COLUMN "is_active" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "print_bridges" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "print_bridges" ADD COLUMN "diagnostics_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "print_bridges" ADD COLUMN "command" text;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "zone" text;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "is_virtual" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_production_impacts" ADD CONSTRAINT "prep_production_impacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_production_impacts" ADD CONSTRAINT "prep_production_impacts_production_id_prep_production_runs_id_fk" FOREIGN KEY ("production_id") REFERENCES "public"."prep_production_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_production_runs" ADD CONSTRAINT "prep_production_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_production_runs" ADD CONSTRAINT "prep_production_runs_prep_id_prep_items_id_fk" FOREIGN KEY ("prep_id") REFERENCES "public"."prep_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_production_runs" ADD CONSTRAINT "prep_production_runs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_bridge_logs" ADD CONSTRAINT "print_bridge_logs_bridge_id_print_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."print_bridges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prep_production_impacts_tenant_production_idx" ON "prep_production_impacts" USING btree ("tenant_id","production_id");--> statement-breakpoint
CREATE INDEX "prep_production_runs_tenant_prep_idx" ON "prep_production_runs" USING btree ("tenant_id","prep_id");--> statement-breakpoint
CREATE INDEX "print_bridge_logs_tenant_bridge_created_idx" ON "print_bridge_logs" USING btree ("tenant_id","bridge_id","created_at");--> statement-breakpoint
CREATE INDEX "print_stations_tenant_idx" ON "print_stations" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "print_stations_tenant_name_idx" ON "print_stations" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "production_references_tenant_idx" ON "production_references" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "production_references_tenant_name_idx" ON "production_references" USING btree ("tenant_id","name");--> statement-breakpoint
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_station_id_print_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."print_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_reference_id_production_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."production_references"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD CONSTRAINT "category_modifier_pool_options_reference_id_production_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."production_references"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_unit_conversions" ADD CONSTRAINT "inventory_unit_conversions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_components" ADD CONSTRAINT "menu_item_components_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_station_id_print_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."print_stations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_reference_id_production_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."production_references"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD CONSTRAINT "menu_item_modifier_options_reference_id_production_references_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."production_references"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stock_impacts" ADD CONSTRAINT "order_stock_impacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_items" ADD CONSTRAINT "prep_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bom_components_tenant_bom_type_id_idx" ON "bom_components" USING btree ("tenant_id","bom_id","component_type","component_id");--> statement-breakpoint
CREATE INDEX "bom_components_tenant_bom_idx" ON "bom_components" USING btree ("tenant_id","bom_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bom_items_tenant_name_idx" ON "bom_items" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "bom_items_tenant_idx" ON "bom_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_tenant_name_idx" ON "menu_items" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "menu_items_tenant_idx" ON "menu_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "menu_items_tenant_station_idx" ON "menu_items" USING btree ("tenant_id","station_id");--> statement-breakpoint
CREATE INDEX "order_stock_impacts_tenant_order_idx" ON "order_stock_impacts" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "order_stock_impacts_tenant_item_idx" ON "order_stock_impacts" USING btree ("tenant_id","order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prep_items_tenant_name_idx" ON "prep_items" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "prep_items_tenant_source_idx" ON "prep_items" USING btree ("tenant_id","source_type","source_id");--> statement-breakpoint
ALTER TABLE "bom_items" DROP COLUMN "unit";--> statement-breakpoint
ALTER TABLE "bom_items" DROP COLUMN "is_container";--> statement-breakpoint
ALTER TABLE "inventory" DROP COLUMN "is_container";--> statement-breakpoint
ALTER TABLE "menu_items" DROP COLUMN "default_container_id";--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" DROP COLUMN "bom_id";--> statement-breakpoint
ALTER TABLE "prep_items" DROP COLUMN "ingredient_id";--> statement-breakpoint
ALTER TABLE "prep_items" DROP COLUMN "bom_id";--> statement-breakpoint
ALTER TABLE "prep_items" DROP COLUMN "quantity_per_unit";--> statement-breakpoint
ALTER TABLE "prep_items" DROP COLUMN "unit";