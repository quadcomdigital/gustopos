-- ═══════════════════════════════════════════════════════════════════
-- 0076: Virtual tables for takeaway/delivery "conti"
--
-- Each open takeaway/delivery order gets a hidden virtual table row so the
-- existing table payment/checkout stack (closeTable, split-bill, pay-items,
-- fiscal, refunds) can be reused to settle non-dine-in orders.
-- Virtual tables must be filtered out of the physical table map, table
-- management and self-order QR pickers.
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "tables" ADD COLUMN "is_virtual" integer NOT NULL DEFAULT 0;
