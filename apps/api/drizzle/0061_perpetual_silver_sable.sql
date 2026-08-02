CREATE INDEX "order_items_tenant_order_idx" ON "order_items" USING btree ("tenant_id","order_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_status_idx" ON "orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "orders_tenant_timestamp_idx" ON "orders" USING btree ("tenant_id","timestamp");--> statement-breakpoint
CREATE INDEX "payments_tenant_created_at_idx" ON "payments" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_tenant_refunded_payment_id_idx" ON "payments" USING btree ("tenant_id","refunded_payment_id");--> statement-breakpoint
CREATE INDEX "print_jobs_tenant_status_area_idx" ON "print_jobs" USING btree ("tenant_id","status","area");--> statement-breakpoint
CREATE INDEX "print_jobs_tenant_status_claimed_at_idx" ON "print_jobs" USING btree ("tenant_id","status","claimed_at");