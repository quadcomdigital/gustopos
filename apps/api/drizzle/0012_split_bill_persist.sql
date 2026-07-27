ALTER TABLE "payments"
ADD COLUMN "reference" text;

CREATE INDEX IF NOT EXISTS "payments_reference_idx"
ON "payments" ("reference");
