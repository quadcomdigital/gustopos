-- ═══════════════════════════════════════════════════════════════════
-- 0068: stock_movements.ingredient_id nullable
-- Prep consumption/restoration movements reference prep_item_id and
-- legitimately have no ingredient_id. The Drizzle schema already models
-- the column as nullable; align the live database.
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "stock_movements" ALTER COLUMN "ingredient_id" DROP NOT NULL;
