ALTER TABLE "print_bridges" ADD COLUMN "mappings" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "print_bridges" ADD COLUMN "claimed_areas" text DEFAULT '[]' NOT NULL;