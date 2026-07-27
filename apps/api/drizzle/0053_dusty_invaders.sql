ALTER TABLE "print_jobs" ADD COLUMN "claimed_by_instance_id" text;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD COLUMN "claimed_at" timestamp with time zone;