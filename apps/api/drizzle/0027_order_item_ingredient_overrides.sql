ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "ingredient_overrides" text NOT NULL DEFAULT '[]';
