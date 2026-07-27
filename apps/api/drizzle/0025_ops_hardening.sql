ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "no_show_reason" text;

ALTER TABLE "delivery_orders"
  ADD COLUMN IF NOT EXISTS "status_changed_at" timestamp with time zone;

ALTER TABLE "delivery_orders"
  ADD COLUMN IF NOT EXISTS "assigned_at" timestamp with time zone;
