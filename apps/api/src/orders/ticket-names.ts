/**
 * Internal ticket names ("nome interno") — the short name a venue decides for
 * itself and prints on the PRODUCTION comande (cucina/pizzeria/bar).
 *
 * Two rules, both enforced here so printers, repositories and the kitchen
 * screen can never drift apart:
 *   - blank/whitespace/absent → the product's real `name` (today's behaviour);
 *   - the cashier station ticket, the receipt, the pre-bill and the public
 *     menu always keep the real `name`: the internal name is kitchen-facing
 *     only, so a customer-facing document never shows an abbreviation.
 */

/** Trim + collapse empty to `null` so the DB stores NULL, never `''`. */
export function normalizeTicketName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Name to print for an item on a station ticket.
 *
 * `stationKind` mirrors `print_stations.kind` ("production" | "cashier").
 */
export function resolveStationItemName(
  item: { name: string; ticketName?: string | null },
  stationKind: string,
): string {
  // Explicit allow-list: only production stations (cucina/pizzeria/bar) print
  // the internal name. The cashier ticket keeps the real name, and any
  // unexpected kind degrades to the real name instead of a kitchen-only alias.
  if (stationKind !== "production") return item.name;
  return item.ticketName?.trim() || item.name;
}
