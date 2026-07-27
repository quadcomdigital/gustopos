CREATE TABLE "menu_item_bom_requirements" (
	"menu_item_id" text NOT NULL,
	"bom_id" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	CONSTRAINT "menu_item_bom_requirements_menu_item_id_bom_id_pk" PRIMARY KEY("menu_item_id","bom_id")
);
--> statement-breakpoint
ALTER TABLE "menu_item_bom_requirements" ADD CONSTRAINT "menu_item_bom_requirements_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_bom_requirements" ADD CONSTRAINT "menu_item_bom_requirements_bom_id_bom_items_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_items"("id") ON DELETE cascade ON UPDATE no action;