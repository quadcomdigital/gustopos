-- ═══════════════════════════════════════════════════════════════════
-- 0078: Per-station "own items only" ticket scope
--
-- When own_items_only = 1 the station ticket prints ONLY the items routed to
-- that station (items without a station assignment still print everywhere).
-- This lets a venue keep beverages off the kitchen comanda (and kitchen items
-- off the bar comanda) without losing the combined-ticket behaviour by default.
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "print_stations" ADD COLUMN "own_items_only" integer NOT NULL DEFAULT 0;
