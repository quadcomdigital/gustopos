CREATE TABLE "bom_components" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bom_components_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bom_id" text NOT NULL,
	"component_type" text NOT NULL,
	"component_id" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bom_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"yield_quantity" numeric(12, 3) NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bom_components" ADD CONSTRAINT "bom_components_bom_id_bom_items_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_items"("id") ON DELETE cascade ON UPDATE no action;