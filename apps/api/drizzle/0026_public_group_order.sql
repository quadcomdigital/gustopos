CREATE TABLE "group_order_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "tenant_slug" text NOT NULL,
  "join_code_hash" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "version" integer NOT NULL DEFAULT 0,
  "master_participant_id" text NOT NULL,
  "submitted_order_id" text,
  "submit_idempotency_key_hash" text,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "group_order_sessions_join_code_hash_idx" ON "group_order_sessions" ("join_code_hash");

CREATE TABLE "group_order_participants" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "session_id" text NOT NULL REFERENCES "group_order_sessions"("id") ON DELETE cascade,
  "display_name" text NOT NULL,
  "role" text NOT NULL DEFAULT 'guest',
  "participant_token_hash" text NOT NULL,
  "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "disconnected_at" timestamp with time zone
);

CREATE TABLE "group_order_cart_items" (
  "tenant_id" text NOT NULL DEFAULT 'tenant_legacy',
  "session_id" text NOT NULL REFERENCES "group_order_sessions"("id") ON DELETE cascade,
  "menu_item_id" text NOT NULL,
  "name" text NOT NULL,
  "price" numeric(12, 2) NOT NULL,
  "quantity" integer NOT NULL,
  "category" text NOT NULL,
  "ingredients_json" text NOT NULL DEFAULT '[]',
  "updated_by_participant_id" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "group_order_cart_items_tenant_id_session_id_menu_item_id_pk" PRIMARY KEY("tenant_id","session_id","menu_item_id")
);
