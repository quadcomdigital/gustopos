-- ═══════════════════════════════════════════════════════════════════
-- 0071: Print-bridge diagnostics (agent logs + snapshot)
-- Adds remote visibility for print agents: a per-bridge log stream and a
-- last_error/diagnostics_at snapshot on the bridge row. Retention is pruned
-- server-side (7 days). See apps/print-agent-go local dashboard.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "print_bridges" ADD COLUMN IF NOT EXISTS "last_error" text;
ALTER TABLE "print_bridges" ADD COLUMN IF NOT EXISTS "diagnostics_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "print_bridge_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text DEFAULT 'tenant_legacy' NOT NULL,
  "bridge_id" text,
  "instance_id" text,
  "level" text NOT NULL,
  "component" text,
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "print_bridge_logs"
  ADD CONSTRAINT "print_bridge_logs_bridge_id_print_bridges_id_fk"
  FOREIGN KEY ("bridge_id") REFERENCES "print_bridges"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "print_bridge_logs_tenant_bridge_created_idx"
  ON "print_bridge_logs" ("tenant_id", "bridge_id", "created_at");
