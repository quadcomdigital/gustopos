-- 0056_convert_container_modifiers.sql
-- Convert old-style MenuItemModifier entries for container ingredients (Bun, Piadina,
-- Panino, Piatto, etc.) into a ModifierGroup "Tipo pane" with proper ModifierOptions.
--
-- Background: products used to reference bread/container types (isContainer = 1) as flat
-- MenuItemModifier entries (Extra). The new architecture handles these via ModifierGroups
-- with inventoryItemId on each option, which allows proper stock deduction via the
-- isContainer flow in createOrder.
--
-- This migration is idempotent — it checks for existing "Tipo pane" groups per menu item
-- before creating new ones, and only modifies rows that reference container ingredients.

--> statement-breakpoint

DO $$
DECLARE
  container_ids TEXT[];
  rec RECORD;
  new_group_id TEXT;
  new_option_id TEXT;
  option_sort INTEGER;
  first_option_id TEXT;
  mod_rec RECORD;
BEGIN
  -- Step 1: Collect all container ingredient IDs
  container_ids := ARRAY(
    SELECT id FROM inventory WHERE is_container = 1
  );

  IF array_length(container_ids, 1) IS NULL THEN
    RAISE NOTICE 'No container ingredients found — nothing to migrate.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found % container ingredient(s): %', array_length(container_ids, 1), container_ids;

  -- Step 2: For each menu item that has MenuItemModifiers pointing to container ingredients,
  -- and that doesn't already have a "Tipo pane" group, create one and migrate the options.
  FOR rec IN
    SELECT DISTINCT mim.menu_item_id, mi.name AS menu_name
    FROM menu_item_modifiers mim
    JOIN menu_items mi ON mi.id = mim.menu_item_id
    WHERE mim.inventory_item_id = ANY(container_ids)
      AND NOT EXISTS (
        -- Skip if this menu item already has a "Tipo pane" group
        SELECT 1 FROM menu_item_modifier_groups mg
        WHERE mg.menu_item_id = mim.menu_item_id
          AND mg.name = 'Tipo pane'
      )
  LOOP
    new_group_id := 'mg_' || gen_random_uuid()::text;

    -- Create the ModifierGroup
    INSERT INTO menu_item_modifier_groups (id, tenant_id, menu_item_id, name, required, min_selections, max_selections, sort_order, created_at)
    VALUES (
      new_group_id,
      (SELECT tenant_id FROM menu_items WHERE id = rec.menu_item_id),
      rec.menu_item_id,
      'Tipo pane',
      1,   -- required
      1,   -- min_selections
      1,   -- max_selections
      0,   -- sort_order
      NOW()
    );

    RAISE NOTICE 'Created group % for menu item "%" (%)', new_group_id, rec.menu_name, rec.menu_item_id;

    -- Step 3: Create ModifierOptions for each container MenuItemModifier
    option_sort := 0;
    first_option_id := NULL;

    FOR mod_rec IN
      SELECT mim.inventory_item_id, mim.price_delta, inv.name AS ing_name, mim.sort_order
      FROM menu_item_modifiers mim
      JOIN inventory inv ON inv.id = mim.inventory_item_id
      WHERE mim.menu_item_id = rec.menu_item_id
        AND mim.inventory_item_id = ANY(container_ids)
      ORDER BY mim.sort_order ASC, mim.inventory_item_id ASC
    LOOP
      new_option_id := 'mo_' || gen_random_uuid()::text;

      INSERT INTO menu_item_modifier_options (id, tenant_id, group_id, name, inventory_item_id, price_delta, is_default, is_active, sort_order, created_at)
      VALUES (
        new_option_id,
        (SELECT tenant_id FROM menu_items WHERE id = rec.menu_item_id),
        new_group_id,
        mod_rec.ing_name,
        mod_rec.inventory_item_id,
        mod_rec.price_delta,
        0,   -- is_default (set below for the first one)
        1,   -- is_active
        option_sort,
        NOW()
      );

      IF first_option_id IS NULL THEN
        first_option_id := new_option_id;
      END IF;

      option_sort := option_sort + 1;
    END LOOP;

    -- Mark the first option as default
    IF first_option_id IS NOT NULL THEN
      UPDATE menu_item_modifier_options
      SET is_default = 1
      WHERE id = first_option_id;
    END IF;

    -- Step 4: Delete the old MenuItemModifier entries for container ingredients
    DELETE FROM menu_item_modifiers
    WHERE menu_item_id = rec.menu_item_id
      AND inventory_item_id = ANY(container_ids);

    RAISE NOTICE '  -> Migrated % options, deleted old modifiers for "%"', option_sort, rec.menu_name;
  END LOOP;

  RAISE NOTICE 'Migration complete.';
END;
$$;

--> statement-breakpoint
