CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"staff_id" text,
	"staff_categories" jsonb DEFAULT '["orders","reservations","low_stock","printing"]'::jsonb NOT NULL,
	"consumer_categories" jsonb DEFAULT '["takeaway_status","group_order"]'::jsonb NOT NULL,
	"tracking_session_id" text,
	"group_session_id" text,
	"device_label" text,
	"user_agent" text,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tracking_session_id_public_takeaway_tracking_sessions_id_fk" FOREIGN KEY ("tracking_session_id") REFERENCES "public"."public_takeaway_tracking_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_group_session_id_group_order_sessions_id_fk" FOREIGN KEY ("group_session_id") REFERENCES "public"."group_order_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_tenant_endpoint_idx" ON "push_subscriptions" USING btree ("tenant_id","endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_staff_idx" ON "push_subscriptions" USING btree ("tenant_id","staff_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_tracking_idx" ON "push_subscriptions" USING btree ("tenant_id","tracking_session_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_group_idx" ON "push_subscriptions" USING btree ("tenant_id","group_session_id");