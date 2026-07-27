-- 0055_print_job_bridge_columns.sql
-- Bridge coupling + claim tracking on print_jobs + nullable ingredient_id on stock_movements.
-- This migration aligns the database with the print-bridge onboarding model that
-- lets registered bridges autonomously claim jobs for their claimed areas via polling,
-- and is safe to re-apply (every statement is IF NOT EXISTS / guarded).
--
-- Reconciliation: print_jobs may pre-date this file with no bridge_id, no claim columns.
-- That is fine — claimPrintJobsForBridge WHERE clause treats NULL bridgeId as a free
-- pool candidate. No backfill is required.

--> statement-breakpoint

-- 1. print_jobs: bridge_id FK to print_bridges (nullable, ON DELETE SET NULL so revoking a
--    bridge snapshot doesn't orphan claims), plus per-instance claim markers.
ALTER TABLE "print_jobs"
  ADD COLUMN IF NOT EXISTS "bridge_id" text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'print_jobs_bridge_id_print_bridges_id_fk'
  ) THEN
    ALTER TABLE "print_jobs"
      ADD CONSTRAINT "print_jobs_bridge_id_print_bridges_id_fk"
      FOREIGN KEY ("bridge_id") REFERENCES "print_bridges"("id")
      ON DELETE SET NULL;
  END IF;
END
$$;
ALTER TABLE "print_jobs"
  ADD COLUMN IF NOT EXISTS "claimed_by_instance_id" text;
ALTER TABLE "print_jobs"
  ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "print_jobs_bridge_id_idx"
  ON "print_jobs" ("bridge_id");
CREATE INDEX IF NOT EXISTS "print_jobs_claim_idx"
  ON "print_jobs" ("status", "bridge_id");

--> statement-breakpoint

-- 2. stock_movements.ingredient_id is now nullable: order-driven prep-item deductions
--    have no ingredient_id. Existing rows stay as-is; future prep-only movements write NULL.
ALTER TABLE "stock_movements"
  ALTER COLUMN "ingredient_id" DROP NOT NULL;

--> statement-breakpoint
