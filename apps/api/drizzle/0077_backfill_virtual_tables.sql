-- ═══════════════════════════════════════════════════════════════════
-- 0077: Backfill virtual tables for open takeaway/delivery orders
--
-- Orders created before the virtual-conto support have table_number NULL and
-- therefore cannot be settled from the Tables map. Give every still-open
-- (not paid/cancelled) takeaway/delivery order a virtual table keyed by its
-- ticket (or id) so it becomes payable.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO "tables" ("id", "tenant_id", "number", "status", "current_order_id", "is_virtual")
SELECT
  'tbl_v_' || substr(md5(o.tenant_id || o.id), 1, 20),
  o.tenant_id,
  COALESCE(o.ticket_number, 'V-' || left(o.id, 12)),
  'occupied',
  o.id,
  1
FROM "orders" o
WHERE o.order_type IN ('takeaway', 'delivery')
  AND o.status NOT IN ('paid', 'cancelled')
  AND o.table_number IS NULL
ON CONFLICT ("tenant_id", "number") DO NOTHING;

UPDATE "orders" o
SET "table_number" = COALESCE(o.ticket_number, 'V-' || left(o.id, 12))
WHERE o.order_type IN ('takeaway', 'delivery')
  AND o.status NOT IN ('paid', 'cancelled')
  AND o.table_number IS NULL;
