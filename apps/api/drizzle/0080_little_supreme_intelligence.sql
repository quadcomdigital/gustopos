ALTER TABLE "category_modifier_pool_options" ADD COLUMN "price_multiplier" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "category_modifier_pool_options" ADD COLUMN "is_active" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_options" ADD COLUMN "price_multiplier" numeric(6, 3);