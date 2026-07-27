CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" text NOT NULL,
	"min_threshold" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_item_ingredients" (
	"menu_item_id" text NOT NULL,
	"ingredient_id" text NOT NULL,
	CONSTRAINT "menu_item_ingredients_menu_item_id_ingredient_id_pk" PRIMARY KEY("menu_item_id","ingredient_id")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"name" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"table_number" text NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"status" text NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"staff_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"pin" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"status" text NOT NULL,
	"current_order_id" text
);
--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_ingredients" ADD CONSTRAINT "menu_item_ingredients_ingredient_id_inventory_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tables_number_idx" ON "tables" USING btree ("number");