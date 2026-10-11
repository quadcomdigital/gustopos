CREATE TABLE "print_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"kind" text DEFAULT 'net' NOT NULL,
	"name" text NOT NULL,
	"ip" text,
	"port" integer,
	"vendor" text,
	"mac" text,
	"instance_id" text,
	"bridge_id" text,
	"is_active" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "print_endpoints" ADD CONSTRAINT "print_endpoints_bridge_id_print_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."print_bridges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "print_endpoints_tenant_idx" ON "print_endpoints" USING btree ("tenant_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "print_endpoints_net_unique_idx" ON "print_endpoints" USING btree ("tenant_id","ip","port") WHERE "print_endpoints"."kind" = 'net';--> statement-breakpoint
CREATE UNIQUE INDEX "print_endpoints_qz_unique_idx" ON "print_endpoints" USING btree ("tenant_id","instance_id","name") WHERE "print_endpoints"."kind" = 'qz';