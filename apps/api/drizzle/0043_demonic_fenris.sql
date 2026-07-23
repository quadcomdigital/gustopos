ALTER TABLE "bom_items" ADD COLUMN "stock_quantity" numeric(12, 3) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "is_pre_batched" integer DEFAULT 0 NOT NULL;