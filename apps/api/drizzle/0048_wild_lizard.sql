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
CREATE TABLE "menu_item_prep_requirements" (
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"menu_item_id" text NOT NULL,
	"prep_item_id" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	CONSTRAINT "menu_item_prep_requirements_menu_item_id_prep_item_id_pk" PRIMARY KEY("menu_item_id","prep_item_id")
);
--> statement-breakpoint
CREATE TABLE "prep_items" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"ingredient_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity_per_unit" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"stock_quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventory_unit_conversions" ADD CONSTRAINT "inventory_unit_conversions_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_prep_requirements" ADD CONSTRAINT "menu_item_prep_requirements_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_prep_requirements" ADD CONSTRAINT "menu_item_prep_requirements_prep_item_id_prep_items_id_fk" FOREIGN KEY ("prep_item_id") REFERENCES "public"."prep_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_items" ADD CONSTRAINT "prep_items_ingredient_id_inventory_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_unit_conversions_tenant_idx" ON "inventory_unit_conversions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_unit_conversions_inventory_idx" ON "inventory_unit_conversions" USING btree ("inventory_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_unit_conversions_unique_idx" ON "inventory_unit_conversions" USING btree ("tenant_id","inventory_id","from_unit");--> statement-breakpoint
CREATE INDEX "menu_item_prep_requirements_tenant_idx" ON "menu_item_prep_requirements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prep_items_tenant_idx" ON "prep_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "prep_items_ingredient_idx" ON "prep_items" USING btree ("ingredient_id");
ALTER TABLE "bom_items" ADD COLUMN "stock_quantity" numeric(12, 3) DEFAULT '0' NOT NULL;
ALTER TABLE "bom_items" ADD COLUMN "is_pre_batched" integer DEFAULT 0 NOT NULL;
