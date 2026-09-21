-- ═══════════════════════════════════════════════════════════════════
-- 0073: Production references (container/base counting)
-- A per-tenant catalog of production containers/bases (BUN, Piadina,
-- Panino, A piatto, …). Each menu category/product may carry a default
-- reference; a "main" modifier option may override it. The RIEPILOGO block
-- on production station tickets then counts only these containers so the
-- kitchen can prep containers and assemble.
--
-- Resolution per order line: modifier (lowest sort_order) > product > category.
-- Quantity is always 1 per sold unit.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "production_references" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "production_references_tenant_idx" ON "production_references" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "production_references_tenant_name_idx" ON "production_references" ("tenant_id", "name");

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "reference_id" text;
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "reference_id" text;
ALTER TABLE "menu_item_modifier_options" ADD COLUMN IF NOT EXISTS "reference_id" text;
ALTER TABLE "category_modifier_pool_options" ADD COLUMN IF NOT EXISTS "reference_id" text;

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_reference_id_production_references_id_fk"
  FOREIGN KEY ("reference_id") REFERENCES "production_references"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "menu_items"
  ADD CONSTRAINT "menu_items_reference_id_production_references_id_fk"
  FOREIGN KEY ("reference_id") REFERENCES "production_references"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "menu_item_modifier_options"
  ADD CONSTRAINT "menu_modifier_options_reference_id_production_references_id_fk"
  FOREIGN KEY ("reference_id") REFERENCES "production_references"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
ALTER TABLE "category_modifier_pool_options"
  ADD CONSTRAINT "category_modifier_pool_options_reference_id_production_references_id_fk"
  FOREIGN KEY ("reference_id") REFERENCES "production_references"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "categories_tenant_reference_idx" ON "categories" ("tenant_id", "reference_id");
CREATE INDEX IF NOT EXISTS "menu_items_tenant_reference_idx" ON "menu_items" ("tenant_id", "reference_id");
