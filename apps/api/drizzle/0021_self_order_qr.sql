CREATE TABLE IF NOT EXISTS "self_order_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "table_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "is_active" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "self_order_sessions_table_id_fk" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "self_order_sessions_tenant_table_active_idx"
  ON "self_order_sessions" ("tenant_id", "table_id", "is_active");

CREATE INDEX IF NOT EXISTS "self_order_sessions_tenant_token_idx"
  ON "self_order_sessions" ("tenant_id", "token_hash");

INSERT INTO tenant_modules (id, tenant_id, module_key, enabled, created_at, updated_at)
SELECT
  'tm_' || md5(t.id || ':self_order_qr'),
  t.id,
  'self_order_qr',
  0,
  now(),
  now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_modules tm
  WHERE tm.tenant_id = t.id
    AND tm.module_key = 'self_order_qr'
);
