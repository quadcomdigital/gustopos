ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS claimed_by_instance_id text;
CREATE INDEX IF NOT EXISTS print_jobs_claimed_by_instance_idx ON print_jobs (claimed_by_instance_id);
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS claimed_at timestamp with time zone;
