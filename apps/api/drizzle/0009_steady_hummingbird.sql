CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"full_name_normalized" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone
);

CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "inventory" ADD COLUMN "category_id" text;
ALTER TABLE "bom_items" ADD COLUMN "category_id" text;
ALTER TABLE "menu_items" ADD COLUMN "category_id" text;

ALTER TABLE "orders" ADD COLUMN "order_type" text DEFAULT 'dine_in' NOT NULL;
ALTER TABLE "orders" ADD COLUMN "ticket_number" text;
ALTER TABLE "orders" ADD COLUMN "customer_name" text;
ALTER TABLE "orders" ADD COLUMN "customer_id" text;
ALTER TABLE "orders" ADD COLUMN "customer_phone" text;
ALTER TABLE "orders" ADD COLUMN "pickup_eta" timestamp with time zone;

ALTER TABLE "orders" ALTER COLUMN "table_number" DROP NOT NULL;

CREATE UNIQUE INDEX "customers_phone_unique_idx" ON "customers" ("phone") WHERE "phone" IS NOT NULL;
CREATE INDEX "customers_name_norm_idx" ON "customers" ("full_name_normalized");
CREATE INDEX "orders_customer_id_idx" ON "orders" ("customer_id");
