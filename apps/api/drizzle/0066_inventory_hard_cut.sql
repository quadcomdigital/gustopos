-- ═══════════════════════════════════════════════════════════════════
-- 0066: Inventory Hard-Cut Migration
-- Target: canonical ingredient | bom | prep model
-- Scope: tenant franks reset, schema refactor, production tables
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Drop legacy menu recipe tables ──────────────────────────────

DROP TABLE IF EXISTS public.menu_item_ingredients CASCADE;
DROP TABLE IF EXISTS public.menu_item_bom_requirements CASCADE;
DROP TABLE IF EXISTS public.menu_item_prep_requirements CASCADE;
DROP TABLE IF EXISTS public.prep_item_components CASCADE;
DROP TABLE IF EXISTS public.menu_item_modifiers CASCADE;

-- ─── 2. Alter inventory table ───────────────────────────────────────

-- Add FK to tenants
ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_tenant_id_fkey,
  ADD CONSTRAINT inventory_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add timestamps
ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Remove is_container
ALTER TABLE public.inventory DROP COLUMN IF EXISTS is_container;

-- ─── 3. Alter menu_items table ──────────────────────────────────────

-- Add FK to tenants
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add timestamps
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Remove default_container_id
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS default_container_id;

-- Add unique index on (tenant_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_tenant_name_idx
  ON public.menu_items (tenant_id, name);

-- Add tenant index
CREATE INDEX IF NOT EXISTS menu_items_tenant_idx
  ON public.menu_items (tenant_id);

-- Add FK to categories
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- ─── 4. Alter bom_items table ───────────────────────────────────────

-- Rename unit → output_unit
ALTER TABLE public.bom_items RENAME COLUMN unit TO output_unit;

-- Add FK to tenants
ALTER TABLE public.bom_items
  ADD CONSTRAINT bom_items_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add timestamps
ALTER TABLE public.bom_items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Remove is_container
ALTER TABLE public.bom_items DROP COLUMN IF EXISTS is_container;

-- Add unique index on (tenant_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS bom_items_tenant_name_idx
  ON public.bom_items (tenant_id, name);

-- Add tenant index
CREATE INDEX IF NOT EXISTS bom_items_tenant_idx
  ON public.bom_items (tenant_id);

-- ─── 5. Alter bom_components table ──────────────────────────────────

-- Add FK to tenants
ALTER TABLE public.bom_components
  ADD CONSTRAINT bom_components_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add timestamp
ALTER TABLE public.bom_components
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Add unique constraint on (tenant_id, bom_id, component_type, component_id)
CREATE UNIQUE INDEX IF NOT EXISTS bom_components_tenant_bom_type_id_idx
  ON public.bom_components (tenant_id, bom_id, component_type, component_id);

-- Add lookup index
CREATE INDEX IF NOT EXISTS bom_components_tenant_bom_idx
  ON public.bom_components (tenant_id, bom_id);

-- ─── 6. Alter prep_items table ──────────────────────────────────────

-- Add new columns for source model
ALTER TABLE public.prep_items
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS input_quantity numeric(14,6),
  ADD COLUMN IF NOT EXISTS input_unit text,
  ADD COLUMN IF NOT EXISTS output_quantity numeric(14,6),
  ADD COLUMN IF NOT EXISTS output_unit text,
  ADD COLUMN IF NOT EXISTS is_active integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Migrate existing data: ingredient-based preps
UPDATE public.prep_items
SET source_type = 'ingredient',
    source_id = ingredient_id,
    input_quantity = quantity_per_unit,
    input_unit = unit,
    output_quantity = 1,
    output_unit = unit
WHERE ingredient_id IS NOT NULL;

-- Migrate existing data: bom-based preps
UPDATE public.prep_items
SET source_type = 'bom',
    source_id = bom_id,
    input_quantity = quantity_per_unit,
    input_unit = unit,
    output_quantity = 1,
    output_unit = unit
WHERE bom_id IS NOT NULL;

-- Set defaults for any remaining nulls (shouldn't happen but safety)
UPDATE public.prep_items
SET source_type = 'ingredient',
    source_id = '',
    input_quantity = 1,
    input_unit = 'pz',
    output_quantity = 1,
    output_unit = 'pz'
WHERE source_type IS NULL;

-- Make new columns NOT NULL
ALTER TABLE public.prep_items
  ALTER COLUMN source_type SET NOT NULL,
  ALTER COLUMN source_id SET NOT NULL,
  ALTER COLUMN input_quantity SET NOT NULL,
  ALTER COLUMN input_unit SET NOT NULL,
  ALTER COLUMN output_quantity SET NOT NULL,
  ALTER COLUMN output_unit SET NOT NULL;

-- Add CHECK constraints
ALTER TABLE public.prep_items
  ADD CONSTRAINT prep_items_source_type_check
    CHECK (source_type IN ('ingredient', 'bom'));

-- Drop old columns
ALTER TABLE public.prep_items
  DROP COLUMN IF EXISTS ingredient_id,
  DROP COLUMN IF EXISTS bom_id,
  DROP COLUMN IF EXISTS quantity_per_unit;

-- Add FK to tenants
ALTER TABLE public.prep_items
  ADD CONSTRAINT prep_items_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Add unique index on (tenant_id, name)
CREATE UNIQUE INDEX IF NOT EXISTS prep_items_tenant_name_idx
  ON public.prep_items (tenant_id, name);

-- Add tenant index
CREATE INDEX IF NOT EXISTS prep_items_tenant_idx
  ON public.prep_items (tenant_id);

-- Add source lookup index
CREATE INDEX IF NOT EXISTS prep_items_tenant_source_idx
  ON public.prep_items (tenant_id, source_type, source_id);

-- ─── 7. Create/update menu_item_components table ────────────────────

CREATE TABLE IF NOT EXISTS public.menu_item_components (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_item_id    text NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  component_type  text NOT NULL,
  component_id    text NOT NULL,
  quantity        numeric(14,6) NOT NULL,
  unit            text NOT NULL DEFAULT 'pz',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS menu_item_components_unique_idx
  ON public.menu_item_components (tenant_id, menu_item_id, component_type, component_id);

CREATE INDEX IF NOT EXISTS menu_item_components_menu_idx
  ON public.menu_item_components (tenant_id, menu_item_id);

-- ─── 8. Create/update order_stock_impacts table ─────────────────────

CREATE TABLE IF NOT EXISTS public.order_stock_impacts (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id        text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id   integer NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  component_type  text NOT NULL,
  component_id    text NOT NULL,
  quantity        numeric(14,6) NOT NULL,
  unit            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_stock_impacts_tenant_order_idx
  ON public.order_stock_impacts (tenant_id, order_id);

CREATE INDEX IF NOT EXISTS order_stock_impacts_tenant_item_idx
  ON public.order_stock_impacts (tenant_id, order_item_id);

-- ─── 9. Alter inventory_unit_conversions table ──────────────────────

-- Add FK to tenants
ALTER TABLE public.inventory_unit_conversions
  ADD CONSTRAINT inventory_unit_conversions_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ─── 10. Remove bom_id from menu_item_modifier_options ──────────────

ALTER TABLE public.menu_item_modifier_options DROP COLUMN IF EXISTS bom_id;

-- ─── 11. Create production tables ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.prep_production_runs (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prep_id         text NOT NULL REFERENCES public.prep_items(id) ON DELETE RESTRICT,
  quantity        numeric(14,6) NOT NULL CHECK (quantity > 0),
  unit            text NOT NULL,
  staff_id        text REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prep_production_runs_tenant_prep_idx
  ON public.prep_production_runs (tenant_id, prep_id);

CREATE TABLE IF NOT EXISTS public.prep_production_impacts (
  id              text PRIMARY KEY,
  tenant_id       text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  production_id   text NOT NULL REFERENCES public.prep_production_runs(id) ON DELETE CASCADE,
  component_type  text NOT NULL,
  component_id    text NOT NULL,
  quantity        numeric(14,6) NOT NULL CHECK (quantity > 0),
  unit            text NOT NULL
);

CREATE INDEX IF NOT EXISTS prep_production_impacts_tenant_production_idx
  ON public.prep_production_impacts (tenant_id, production_id);

-- ─── 12. Add RLS policies for new tables ────────────────────────────

-- prep_production_runs
ALTER TABLE public.prep_production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_production_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.prep_production_runs;
CREATE POLICY tenant_isolation_policy ON public.prep_production_runs
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- prep_production_impacts
ALTER TABLE public.prep_production_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_production_impacts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.prep_production_impacts;
CREATE POLICY tenant_isolation_policy ON public.prep_production_impacts
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
