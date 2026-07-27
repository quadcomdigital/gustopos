CREATE TABLE "print_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"area" text NOT NULL,
	"protocol" text NOT NULL,
	"status" text NOT NULL,
	"payload" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone
);

CREATE INDEX "print_jobs_order_idx" ON "print_jobs" ("order_id");
CREATE INDEX "print_jobs_status_idx" ON "print_jobs" ("status");
CREATE INDEX "print_jobs_area_idx" ON "print_jobs" ("area");
