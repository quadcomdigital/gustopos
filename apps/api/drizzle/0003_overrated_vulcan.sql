CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"table_number" text NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"method" text NOT NULL,
	"paid_amount" numeric(12, 2) NOT NULL,
	"change_amount" numeric(12, 2) NOT NULL,
	"notes" text,
	"staff_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;