CREATE TABLE IF NOT EXISTS "public_takeaway_tracking_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "order_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz,
  CONSTRAINT "public_takeaway_tracking_sessions_order_fk"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "public_takeaway_tracking_token_hash_idx"
  ON "public_takeaway_tracking_sessions" ("token_hash");
