-- ═══════════════════════════════════════════════════════════════════
-- 0067: Inventory is_stock_tracked
-- Add per-ingredient untracked-stock flag. Default 1 (tracked) so all
-- existing ingredients keep current behavior; an ingredient flagged 0 is
-- not deducted by orders and is excluded from stock checks/alerts.
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "inventory" ADD COLUMN "is_stock_tracked" integer NOT NULL DEFAULT 1;
