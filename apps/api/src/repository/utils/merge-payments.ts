/**
 * Pure helper for table merge/move. Given the order-item ids of the source
 * table's OPEN orders and the tenant's `payment_items` rows, returns the
 * distinct payment ids that belong to the current session — i.e. payments
 * linked to at least one open order item.
 *
 * Historical payments (items belonging to `paid`/`cancelled` orders from a
 * previous session on the same table) are naturally excluded because their
 * order-item ids are not part of the open set.
 */
export function collectCurrentSessionPaymentIds(
  openOrderItemIds: Iterable<number>,
  paymentItemRows: Array<{ paymentId: string; orderItemId: number }>,
): string[] {
  const openSet = new Set(openOrderItemIds);
  const paymentIds = new Set<string>();
  for (const row of paymentItemRows) {
    if (openSet.has(row.orderItemId)) {
      paymentIds.add(row.paymentId);
    }
  }
  return [...paymentIds];
}
