ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_tenant_idx" ON "inventory" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_category_idx" ON "inventory" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_tenant_name_idx" ON "inventory" USING btree ("tenant_id","name");