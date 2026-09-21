-- ═══════════════════════════════════════════════════════════════════
-- 0075: One-shot bridge commands (network discovery / direct test print)
--
-- The web UI can ask a specific agent to scan its LAN for network printers or
-- to print an identification ticket straight to an IP. The command is stored
-- on the bridge row and handed to the agent in the heartbeat response; the
-- agent executes it and posts an ack, which clears the column.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE "print_bridges" ADD COLUMN IF NOT EXISTS "command" text;
