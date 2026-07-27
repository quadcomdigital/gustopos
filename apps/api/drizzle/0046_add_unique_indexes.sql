CREATE UNIQUE INDEX "categories_tenant_name_scope_idx" ON "categories" USING btree ("tenant_id","name","scope");--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_users_tenant_email_idx" ON "consumer_users" USING btree ("tenant_id","email_normalized") WHERE "consumer_users"."email_normalized" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_users_tenant_phone_idx" ON "consumer_users" USING btree ("tenant_id","phone_normalized") WHERE "consumer_users"."phone_normalized" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_phone_idx" ON "customers" USING btree ("tenant_id","phone") WHERE "customers"."phone" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_tenant_name_idx" ON "customers" USING btree ("tenant_id","full_name_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_closures_tenant_date_idx" ON "fiscal_closures" USING btree ("tenant_id","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_points_tenant_customer_idx" ON "loyalty_points" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_tenant_name_idx" ON "menu_items" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_key_idx" ON "roles" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_tenant_pin_idx" ON "staff" USING btree ("tenant_id","pin");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_module_configs_tenant_key_idx" ON "tenant_module_configs" USING btree ("tenant_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_modules_tenant_key_idx" ON "tenant_modules" USING btree ("tenant_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_subdomain_idx" ON "tenants" USING btree ("subdomain") WHERE "tenants"."subdomain" IS NOT NULL;
