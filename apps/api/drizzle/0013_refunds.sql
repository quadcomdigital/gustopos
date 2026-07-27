ALTER TABLE "payments"
ADD COLUMN "kind" text NOT NULL DEFAULT 'sale',
ADD COLUMN "refunded_payment_id" text,
ADD COLUMN "refund_reason" text;

CREATE INDEX IF NOT EXISTS "payments_kind_idx"
ON "payments" ("kind");

CREATE INDEX IF NOT EXISTS "payments_refunded_payment_id_idx"
ON "payments" ("refunded_payment_id");
