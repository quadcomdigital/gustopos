CREATE TABLE IF NOT EXISTS "superadmin_users" (
  "id" text PRIMARY KEY NOT NULL,
  "username" text NOT NULL,
  "password_hash" text NOT NULL,
  "is_active" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_login_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "superadmin_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "superadmin_users"("id") ON DELETE cascade,
  "refresh_token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "superadmin_sessions_user_idx"
ON "superadmin_sessions" ("user_id");

CREATE INDEX IF NOT EXISTS "superadmin_sessions_refresh_idx"
ON "superadmin_sessions" ("refresh_token_hash");
