-- Group-order carts are ephemeral (2h TTL) and the new shape requires a
-- non-null participant_id per line; clearing any in-flight rows avoids the
-- NOT NULL backfill failure on a busy dev DB.
DELETE FROM "group_order_cart_items";--> statement-breakpoint
ALTER TABLE "group_order_cart_items" DROP CONSTRAINT "group_order_cart_items_tenant_id_session_id_menu_item_id_pk";--> statement-breakpoint
ALTER TABLE "group_order_cart_items" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "group_order_cart_items" ADD COLUMN "participant_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "group_order_cart_items" ADD COLUMN "modifier_price_delta" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_order_cart_items" ADD COLUMN "selected_modifiers_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "group_order_cart_items" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "approval_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "reviewed_by_staff_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "group_session_id" text;--> statement-breakpoint
ALTER TABLE "group_order_cart_items" ADD CONSTRAINT "group_order_cart_items_participant_id_group_order_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."group_order_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_reviewed_by_staff_id_staff_id_fk" FOREIGN KEY ("reviewed_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_group_session_id_group_order_sessions_id_fk" FOREIGN KEY ("group_session_id") REFERENCES "public"."group_order_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "group_order_cart_items_session_participant_idx" ON "group_order_cart_items" USING btree ("tenant_id","session_id","participant_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_approval_idx" ON "orders" USING btree ("tenant_id","approval_status");