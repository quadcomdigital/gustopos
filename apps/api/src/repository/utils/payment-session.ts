/**
 * Session boundary for table payments.
 *
 * `payments` rows are never deleted and `payments.table_id` never changes, so
 * without a boundary every split share ever recorded on a table would leak into
 * the next night's bill: `getTablePaymentStatus` would show old shares as the
 * current split, `closeTable` would find "all shares captured" and skip the
 * actual charge, and `markShareAsPaid` would pick an arbitrary pending row.
 *
 * A session is the span of the table's currently OPEN orders: it starts with the
 * earliest one. Payments recorded before that instant belong to a previous
 * session on the same table and must be ignored by the checkout.
 */

export interface SessionBoundPayment {
  createdAt: Date;
  shareIndex: number | null;
  reference: string | null;
}

/** Earliest creation instant (`orders.timestamp`) among the table's open orders. */
export function resolveSessionStartedAt(openOrders: Array<{ timestamp: Date }>): Date | null {
  let earliest: Date | null = null;
  for (const order of openOrders) {
    if (!earliest || order.timestamp.getTime() < earliest.getTime()) {
      earliest = order.timestamp;
    }
  }
  return earliest;
}

export function isPaymentInSession(
  payment: { createdAt: Date },
  sessionStartedAt: Date | null,
): boolean {
  if (!sessionStartedAt) return false;
  return payment.createdAt.getTime() >= sessionStartedAt.getTime();
}

/**
 * The split batch currently in force: the most recent persisted split of the
 * session (all its shares share the same `reference`).
 *
 * Re-splitting a table supersedes the previous split, so older batches must
 * never be counted: pending rows from a superseded batch are no longer payable
 * and must not block `closeTable`.
 */
export function selectSessionSplitBatch<T extends SessionBoundPayment>(
  payments: T[],
  sessionStartedAt: Date | null,
): T[] {
  const sessionShares = payments.filter(
    (payment) => payment.shareIndex !== null && isPaymentInSession(payment, sessionStartedAt),
  );
  if (sessionShares.length === 0) return [];

  let latest = sessionShares[0];
  for (const payment of sessionShares) {
    if (payment.createdAt.getTime() > latest.createdAt.getTime()) {
      latest = payment;
    }
  }

  return sessionShares
    .filter((payment) =>
      latest.reference === null ? payment.reference === null : payment.reference === latest.reference,
    )
    .sort((a, b) => (a.shareIndex ?? 0) - (b.shareIndex ?? 0));
}
