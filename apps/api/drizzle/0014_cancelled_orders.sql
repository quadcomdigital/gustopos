ALTER TABLE "orders"
ADD COLUMN "cancel_reason" text,
ADD COLUMN "cancelled_by_staff_id" text;

CREATE INDEX IF NOT EXISTS "orders_status_idx"
ON "orders" ("status");
