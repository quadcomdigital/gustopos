-- 0057_remove_tipo_di_pane_modifier_groups.sql
-- Remove "Tipo di pane" and "Tipo pane" ModifierGroups and their options.
-- These are redundant now since container selection is handled via
-- isContainer + defaultContainerId on the product. Other modifier groups
-- (Formato, Topping, Tipologia, etc.) are preserved.
--
-- Idempotent: the DELETE is scoped to groups named exactly 'Tipo di pane' or 'Tipo pane'.

--> statement-breakpoint

DO $$
DECLARE
  group_ids TEXT[];
BEGIN
  -- Collect all group IDs to delete
  group_ids := ARRAY(
    SELECT id FROM menu_item_modifier_groups
    WHERE name IN ('Tipo di pane', 'Tipo pane')
  );

  IF array_length(group_ids, 1) IS NULL THEN
    RAISE NOTICE 'No Tipo di pane / Tipo pane modifier groups found — nothing to remove.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found % modifier group(s) to remove.', array_length(group_ids, 1);

  -- Delete option overrides (child table first)
  DELETE FROM menu_item_modifier_option_overrides
  WHERE option_id IN (
    SELECT id FROM menu_item_modifier_options
    WHERE group_id = ANY(group_ids)
  );

  -- Delete options
  DELETE FROM menu_item_modifier_options
  WHERE group_id = ANY(group_ids);

  -- Delete groups
  DELETE FROM menu_item_modifier_groups
  WHERE id = ANY(group_ids);

  RAISE NOTICE 'Removed % "Tipo di pane" modifier group(s) and their options.', array_length(group_ids, 1);
END;
$$;

--> statement-breakpoint
