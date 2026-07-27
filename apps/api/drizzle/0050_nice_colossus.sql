CREATE TABLE "print_bridges" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"name" text NOT NULL,
	"host" text,
	"version" text,
	"status" text DEFAULT 'active' NOT NULL,
	"areas" text DEFAULT '[]' NOT NULL,
	"printers" text DEFAULT '[]' NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "print_jobs" ADD COLUMN "bridge_id" text;--> statement-breakpoint
CREATE INDEX "print_bridges_tenant_idx" ON "print_bridges" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "print_bridges_status_idx" ON "print_bridges" USING btree ("status");--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_bridge_id_print_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."print_bridges"("id") ON DELETE set null ON UPDATE no action;