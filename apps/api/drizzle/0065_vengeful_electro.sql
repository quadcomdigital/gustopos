CREATE TABLE "menu_item_components" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"menu_item_id" text NOT NULL,
	"component_type" text NOT NULL,
	"component_id" text NOT NULL,
	"quantity" numeric(12, 6) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "menu_item_components_type_check" CHECK ("component_type" IN ('ingredient', 'prep')),
	CONSTRAINT "menu_item_components_quantity_check" CHECK ("quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_stock_impacts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"order_id" text NOT NULL,
	"order_item_id" integer NOT NULL,
	"component_type" text NOT NULL,
	"component_id" text NOT NULL,
	"quantity" numeric(12, 6) NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "order_stock_impacts_type_check" CHECK ("component_type" IN ('ingredient', 'prep')),
	CONSTRAINT "order_stock_impacts_quantity_check" CHECK ("quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "prep_item_components" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"prep_item_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	"quantity" numeric(12, 6) NOT NULL,
	CONSTRAINT "prep_item_components_quantity_check" CHECK ("quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "menu_item_components" ADD CONSTRAINT "menu_item_components_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stock_impacts" ADD CONSTRAINT "order_stock_impacts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stock_impacts" ADD CONSTRAINT "order_stock_impacts_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_item_components" ADD CONSTRAINT "prep_item_components_prep_item_id_prep_items_id_fk" FOREIGN KEY ("prep_item_id") REFERENCES "public"."prep_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_item_components" ADD CONSTRAINT "prep_item_components_ingredient_id_inventory_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."inventory"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_item_components_unique_idx" ON "menu_item_components" USING btree ("tenant_id","menu_item_id","component_type","component_id");--> statement-breakpoint
CREATE INDEX "menu_item_components_menu_idx" ON "menu_item_components" USING btree ("tenant_id","menu_item_id");--> statement-breakpoint
CREATE INDEX "menu_item_components_tenant_idx" ON "menu_item_components" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE public.menu_item_components ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.menu_item_components FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON public.menu_item_components;--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON public.menu_item_components USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));--> statement-breakpoint
CREATE INDEX "order_stock_impacts_order_idx" ON "order_stock_impacts" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "order_stock_impacts_item_idx" ON "order_stock_impacts" USING btree ("tenant_id","order_item_id");--> statement-breakpoint
CREATE INDEX "order_stock_impacts_tenant_idx" ON "order_stock_impacts" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE public.order_stock_impacts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.order_stock_impacts FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON public.order_stock_impacts;--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON public.order_stock_impacts USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));--> statement-breakpoint
CREATE UNIQUE INDEX "prep_item_components_unique_idx" ON "prep_item_components" USING btree ("tenant_id","prep_item_id","ingredient_id");--> statement-breakpoint
CREATE INDEX "prep_item_components_prep_idx" ON "prep_item_components" USING btree ("tenant_id","prep_item_id");--> statement-breakpoint
CREATE INDEX "prep_item_components_tenant_idx" ON "prep_item_components" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE public.prep_item_components ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.prep_item_components FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON public.prep_item_components;--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON public.prep_item_components USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')) WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));