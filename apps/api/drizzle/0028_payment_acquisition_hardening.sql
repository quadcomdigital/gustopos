ALTER TABLE "payments"
ADD COLUMN "payment_status" text NOT NULL DEFAULT 'captured';

ALTER TABLE "payments"
ADD COLUMN "gateway_reference" text;

ALTER TABLE "payments"
ADD COLUMN "captured_at" timestamp with time zone;
