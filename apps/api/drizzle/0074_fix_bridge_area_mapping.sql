-- ═══════════════════════════════════════════════════════════════════
-- 0074: Normalize print-bridge area mapping to station ids
--
-- Migration 0072 replaced the hard-coded print_areas enum with the
-- per-tenant print_stations registry and backfilled menu_items/categories,
-- but it did NOT touch print_bridges. Existing bridges therefore still carry
-- legacy enum keys (kitchen|pizzeria|bar|cashier) in areas/claimed_areas/
-- mappings while print_jobs are now routed by station id — so Go agents
-- claim nothing (or claim and fail with "no printer mapping configured").
--
-- This migration:
--  1. creates the missing Cassa station for tenants that used the legacy
--     `cashier` area (deterministic id, same formula as 0072/bootstrap);
--  2. translates legacy area keys -> station ids in `areas`/`claimed_areas`,
--     drops unresolvable values and de-duplicates;
--  3. resets `mappings` (and the `claimed_areas` queue boundary) for bridges
--     whose physical bindings were keyed by the legacy enum, since the
--     station-id key is authoritative and the admin must re-bind the printer
--     from Settings → Stampa.
--
-- Idempotent: re-running is a no-op.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Create the Cassa station where the legacy `cashier` area was used ──
INSERT INTO "print_stations" ("id", "tenant_id", "name", "kind", "sort_order", "is_default", "is_active")
SELECT DISTINCT
  'st_' || substr(md5(x."tenant_id" || ':cashier'), 1, 20),
  x."tenant_id",
  'Cassa',
  'cashier',
  3,
  0,
  1
FROM (
  SELECT "tenant_id" FROM "print_bridges"
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text("areas"::jsonb) e WHERE lower(e) = 'cashier')
       OR EXISTS (SELECT 1 FROM jsonb_array_elements_text("claimed_areas"::jsonb) e WHERE lower(e) = 'cashier')
       OR EXISTS (SELECT 1 FROM jsonb_array_elements("mappings"::jsonb) m WHERE lower(m->>'area') = 'cashier')
  UNION
  SELECT "tenant_id" FROM "menu_items" WHERE "print_areas" ILIKE '%cashier%'
  UNION
  SELECT "tenant_id" FROM "categories" WHERE "print_areas" ILIKE '%cashier%'
) x
WHERE NOT EXISTS (
  SELECT 1 FROM "print_stations" ps
  WHERE ps."tenant_id" = x."tenant_id"
    AND (ps."kind" = 'cashier' OR lower(ps."name") = 'cassa')
)
ON CONFLICT ("id") DO NOTHING;

-- ── 2. Normalize `areas`: legacy key -> station id, drop unknown, de-dup ──
UPDATE "print_bridges" pb
SET "areas" = COALESCE((
  SELECT jsonb_agg(mapped.val ORDER BY mapped.val)
  FROM (
    SELECT DISTINCT CASE
      WHEN lower(t.elem) IN ('kitchen', 'pizzeria', 'bar', 'cashier')
        THEN 'st_' || substr(md5(pb."tenant_id" || ':' || lower(t.elem)), 1, 20)
      ELSE t.elem
    END AS val
    FROM jsonb_array_elements_text(pb."areas"::jsonb) AS t(elem)
  ) mapped
  WHERE mapped.val IN (SELECT ps."id" FROM "print_stations" ps WHERE ps."tenant_id" = pb."tenant_id")
), '[]'::jsonb)::text;

-- ── 3. Bridges with legacy-keyed mappings: reset queue boundary + mappings.
--    The queue boundary is cleared too so the bridge does not claim jobs it
--    has no printer mapping for; the admin re-binds everything in Settings.
UPDATE "print_bridges" pb
SET "claimed_areas" = '[]'
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(pb."mappings"::jsonb) m
  WHERE lower(m->>'area') IN ('kitchen', 'pizzeria', 'bar', 'cashier')
);

UPDATE "print_bridges" pb
SET "mappings" = '[]'
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(pb."mappings"::jsonb) m
  WHERE lower(m->>'area') IN ('kitchen', 'pizzeria', 'bar', 'cashier')
);

-- ── 4. Normalize remaining `claimed_areas` (translate legacy keys, keep
--    only real station ids, de-duplicate). '[]' stays '[]'. ───────────────
UPDATE "print_bridges" pb
SET "claimed_areas" = COALESCE((
  SELECT jsonb_agg(mapped.val ORDER BY mapped.val)
  FROM (
    SELECT DISTINCT CASE
      WHEN lower(t.elem) IN ('kitchen', 'pizzeria', 'bar', 'cashier')
        THEN 'st_' || substr(md5(pb."tenant_id" || ':' || lower(t.elem)), 1, 20)
      ELSE t.elem
    END AS val
    FROM jsonb_array_elements_text(pb."claimed_areas"::jsonb) AS t(elem)
  ) mapped
  WHERE mapped.val IN (SELECT ps."id" FROM "print_stations" ps WHERE ps."tenant_id" = pb."tenant_id")
), '[]'::jsonb)::text;
