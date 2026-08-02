CREATE TABLE "fiscal_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" text NOT NULL,
	"result" text,
	"error" text,
	"bridge_id" text,
	"claimed_by_instance_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fiscal_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fiscal_progressive" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "fiscal_error" text;--> statement-breakpoint
ALTER TABLE "fiscal_jobs" ADD CONSTRAINT "fiscal_jobs_bridge_id_print_bridges_id_fk" FOREIGN KEY ("bridge_id") REFERENCES "public"."print_bridges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fiscal_jobs_tenant_status_type_idx" ON "fiscal_jobs" USING btree ("tenant_id","status","type");