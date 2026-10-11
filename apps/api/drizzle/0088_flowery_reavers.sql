ALTER TABLE "group_order_sessions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "group_order_sessions" ADD COLUMN "reviewed_by_staff_id" text;--> statement-breakpoint
ALTER TABLE "group_order_sessions" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "group_order_sessions" ADD CONSTRAINT "group_order_sessions_reviewed_by_staff_id_staff_id_fk" FOREIGN KEY ("reviewed_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;