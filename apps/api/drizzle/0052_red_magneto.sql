CREATE TABLE "print_bridge_onboarding_secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"secret_hash" text NOT NULL,
	"suggested_bridge_id" text NOT NULL,
	"bound_bridge_id" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_staff_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "print_bridge_onboarding_secrets_tenant_idx" ON "print_bridge_onboarding_secrets" USING btree ("tenant_id","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "print_bridge_onboarding_secrets_hash_unique_idx" ON "print_bridge_onboarding_secrets" USING btree ("secret_hash");