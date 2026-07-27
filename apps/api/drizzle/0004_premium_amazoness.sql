ALTER TABLE "payments" ADD COLUMN "subtotal" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "surcharge_amount" numeric(12, 2) DEFAULT '0' NOT NULL;