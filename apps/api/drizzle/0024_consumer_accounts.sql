CREATE TABLE IF NOT EXISTS "consumer_users" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "full_name" text NOT NULL,
  "full_name_normalized" text NOT NULL,
  "email" text,
  "email_normalized" text,
  "phone" text,
  "phone_normalized" text,
  "password_hash" text NOT NULL,
  "is_active" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "consumer_users_tenant_email_idx"
  ON "consumer_users" ("tenant_id", "email_normalized")
  WHERE "email_normalized" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "consumer_users_tenant_phone_idx"
  ON "consumer_users" ("tenant_id", "phone_normalized")
  WHERE "phone_normalized" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "consumer_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "consumer_user_id" text NOT NULL,
  "refresh_token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz,
  CONSTRAINT "consumer_sessions_user_fk" FOREIGN KEY ("consumer_user_id") REFERENCES "consumer_users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "consumer_sessions_refresh_token_hash_idx"
  ON "consumer_sessions" ("refresh_token_hash");

CREATE TABLE IF NOT EXISTS "consumer_order_links" (
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "order_id" text NOT NULL,
  "consumer_user_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("tenant_id", "order_id", "consumer_user_id"),
  CONSTRAINT "consumer_order_links_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
  CONSTRAINT "consumer_order_links_user_fk" FOREIGN KEY ("consumer_user_id") REFERENCES "consumer_users"("id") ON DELETE CASCADE
);

INSERT INTO tenant_modules (id, tenant_id, module_key, enabled, created_at, updated_at)
SELECT
  'tm_' || md5(t.id || ':consumer_accounts'),
  t.id,
  'consumer_accounts',
  0,
  now(),
  now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_modules tm
  WHERE tm.tenant_id = t.id
    AND tm.module_key = 'consumer_accounts'
);

INSERT INTO tenant_modules (id, tenant_id, module_key, enabled, created_at, updated_at)
SELECT
  'tm_' || md5(t.id || ':loyalty_points'),
  t.id,
  'loyalty_points',
  0,
  now(),
  now()
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_modules tm
  WHERE tm.tenant_id = t.id
    AND tm.module_key = 'loyalty_points'
);
