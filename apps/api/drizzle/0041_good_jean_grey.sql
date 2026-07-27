ALTER TABLE "inventory" ALTER COLUMN "quantity" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "min_threshold" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "unit_cost" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "unit_cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "inventory" ALTER COLUMN "sale_price" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "previous_quantity" SET DATA TYPE numeric(12, 3);--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "new_quantity" SET DATA TYPE numeric(12, 3);