-- ═══════════════════════════════════════════════════════════════════
-- 0072: Dynamic print stations
-- Replaces the hard-coded print_areas enum (kitchen|bar|cashier) with a
-- per-tenant, named station registry. A product/category points to exactly
-- one station (station_id). Routing keys (print_jobs.area, bridge claimed
-- areas/mappings) now hold the station id.
--
-- `print_areas` columns are intentionally kept (deprecated) for one release
-- so the switch is revertible; they are dropped in a later migration.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "print_stations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'production',
  "is_default" integer NOT NULL DEFAULT 0,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "print_stations_tenant_idx" ON "print_stations" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "print_stations_tenant_name_idx" ON "print_stations" ("tenant_id", "name");

ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "station_id" text;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "station_id" text;

ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_station_id_print_stations_id_fk"
  FOREIGN KEY ("station_id") REFERENCES "print_stations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_station_id_print_stations_id_fk"
  FOREIGN KEY ("station_id") REFERENCES "print_stations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "menu_items_tenant_station_idx" ON "menu_items" ("tenant_id", "station_id");
CREATE INDEX IF NOT EXISTS "categories_tenant_station_idx" ON "categories" ("tenant_id", "station_id");

-- ── Seed one station per distinct legacy print area ────────────────────
-- Deterministic id (st_ + md5(tenant:area)) so the backfill below can map
-- legacy print_areas values to the seeded rows without a join table.
INSERT INTO "print_stations" ("id", "tenant_id", "name", "kind", "sort_order", "is_default", "is_active")
SELECT
  'st_' || substr(md5(x.tenant_id || ':' || x.area), 1, 20),
  x.tenant_id,
  CASE x.area
    WHEN 'kitchen' THEN 'Cucina'
    WHEN 'pizzeria' THEN 'Pizzeria'
    WHEN 'bar' THEN 'Bar'
    WHEN 'cashier' THEN 'Cassa'
    ELSE initcap(x.area)
  END,
  CASE WHEN x.area = 'cashier' THEN 'cashier' ELSE 'production' END,
  CASE x.area WHEN 'kitchen' THEN 0 WHEN 'pizzeria' THEN 1 WHEN 'bar' THEN 2 WHEN 'cashier' THEN 3 ELSE 9 END,
  0,
  1
FROM (
  SELECT DISTINCT tenant_id, lower(area) AS area
  FROM (
    SELECT tenant_id, jsonb_array_elements_text(print_areas::jsonb) AS area FROM menu_items
    UNION ALL
    SELECT tenant_id, jsonb_array_elements_text(print_areas::jsonb) AS area FROM categories
  ) raw
  WHERE area IS NOT NULL AND trim(area) <> ''
) x
ON CONFLICT ("id") DO NOTHING;

-- Tenants that only had empty/invalid areas still get a fallback station.
INSERT INTO "print_stations" ("id", "tenant_id", "name", "kind", "sort_order", "is_default", "is_active")
SELECT 'st_' || substr(md5(x.tenant_id || ':kitchen'), 1, 20), x.tenant_id, 'Cucina', 'production', 0, 1, 1
FROM (
  SELECT DISTINCT tenant_id FROM menu_items
  UNION
  SELECT DISTINCT tenant_id FROM categories
) x
WHERE NOT EXISTS (SELECT 1 FROM "print_stations" ps WHERE ps.tenant_id = x.tenant_id)
ON CONFLICT ("id") DO NOTHING;

-- ── Designate exactly one default station per tenant (lowest sort_order) ─
UPDATE "print_stations" ps
SET "is_default" = 1
WHERE ps."is_default" = 0
  AND ps."id" = (
    SELECT p2."id" FROM "print_stations" p2
    WHERE p2."tenant_id" = ps."tenant_id"
    ORDER BY p2."sort_order" ASC, p2."created_at" ASC, p2."id" ASC
    LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "print_stations" d
    WHERE d."tenant_id" = ps."tenant_id" AND d."is_default" = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS "print_stations_tenant_default_idx"
  ON "print_stations" ("tenant_id")
  WHERE "is_default" = 1;

-- ── Backfill station_id: first legacy area that maps to a seeded station,
--    otherwise the tenant default. ──────────────────────────────────────
UPDATE "menu_items" mi
SET "station_id" = COALESCE(
  (
    SELECT ps."id" FROM "print_stations" ps
    WHERE ps."tenant_id" = mi."tenant_id"
      AND ps."id" IN (
        SELECT 'st_' || substr(md5(mi."tenant_id" || ':' || lower(e)), 1, 20)
        FROM jsonb_array_elements_text(mi."print_areas"::jsonb) e
      )
    ORDER BY ps."sort_order" ASC
    LIMIT 1
  ),
  (
    SELECT ps."id" FROM "print_stations" ps
    WHERE ps."tenant_id" = mi."tenant_id" AND ps."is_default" = 1
    LIMIT 1
  )
)
WHERE mi."station_id" IS NULL;

UPDATE "categories" c
SET "station_id" = COALESCE(
  (
    SELECT ps."id" FROM "print_stations" ps
    WHERE ps."tenant_id" = c."tenant_id"
      AND ps."id" IN (
        SELECT 'st_' || substr(md5(c."tenant_id" || ':' || lower(e)), 1, 20)
        FROM jsonb_array_elements_text(c."print_areas"::jsonb) e
      )
    ORDER BY ps."sort_order" ASC
    LIMIT 1
  ),
  (
    SELECT ps."id" FROM "print_stations" ps
    WHERE ps."tenant_id" = c."tenant_id" AND ps."is_default" = 1
    LIMIT 1
  )
)
WHERE c."station_id" IS NULL;
