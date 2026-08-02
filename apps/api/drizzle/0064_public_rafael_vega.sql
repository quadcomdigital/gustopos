ALTER TABLE "prep_items" ALTER COLUMN "ingredient_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "prep_items" ADD COLUMN "bom_id" text;--> statement-breakpoint
ALTER TABLE "prep_items" ADD CONSTRAINT "prep_items_bom_id_bom_items_id_fk" FOREIGN KEY ("bom_id") REFERENCES "public"."bom_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prep_items_bom_idx" ON "prep_items" USING btree ("bom_id");