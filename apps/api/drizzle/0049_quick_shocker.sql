ALTER TABLE "stock_movements" ALTER COLUMN "ingredient_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "prep_item_id" text;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_prep_item_id_prep_items_id_fk" FOREIGN KEY ("prep_item_id") REFERENCES "public"."prep_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_items" DROP COLUMN "stock_quantity";--> statement-breakpoint