ALTER TABLE "categories" ADD COLUMN "print_areas" text DEFAULT '["kitchen"]' NOT NULL;
ALTER TABLE "menu_items" ADD COLUMN "print_areas" text DEFAULT '["kitchen"]' NOT NULL;
