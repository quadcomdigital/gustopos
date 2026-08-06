ALTER TABLE menu_item_modifier_options
  ADD COLUMN quantity NUMERIC(14,6) NOT NULL DEFAULT 1;

ALTER TABLE menu_item_modifier_options
  ADD COLUMN unit TEXT NOT NULL DEFAULT 'pz';
